/**
 * 서비스 계층 — API route 가 부르는 유일한 진입점.
 *   읽기: 저장소에서 WorldState → views 로 응답 조립
 *   쓰기: 저장소에서 WorldState → domain/workflow 순수 함수 → 플래그 재계산(settle) → 저장 (낙관적 잠금 + 프로세스 내 직렬화)
 * AI 는 판단안 문장만 만든다. 상태 전이는 규칙 코드 · 사람(모의 회신) · 기한 감시로만 일어난다 (CLAUDE.md 규칙 10).
 */
import type {
  ApprovalCreateResponse,
  AssessmentCreateBody,
  AssessmentCreateResponse,
  AuditFilters,
  ClockResponse,
  EventResponse,
  MetaView,
  MutationResult,
  PresetId,
  ProposalFilters,
  ReplenishmentCreateResponse,
  ReplyBody,
  ReplyResponse,
  ScenarioResetResponse,
  TaskPatchBody,
  TaskPatchResponse,
} from '@/domain/api-types';
import { buildAssessmentBasis } from '@/domain/assessment';
import { assertReplenishmentDrafter, assertTaskActor } from '@/domain/permissions';
import type { MasilDataset } from '@/domain/dataset';
import { deadlineAt, kstDate, toMs } from '@/domain/dates';
import { DomainError } from '@/domain/errors';
import type { MasilFileKey } from '@/domain/files';
import type { ActorRole, ApproverRole, ContractDecision, CounterpartyReplyInput, IsoDate, ItemDecision, ReplyOutcome, SubjectType } from '@/domain/types';
import * as wf from '@/domain/workflow';
import { MODEL } from './ai/client';
import type { Assessor } from './ai/assessor';
import { buildPreset, checkScenario, CONTRACT_ID, isPresetId, presetInfo, PRESETS, settle } from './scenarios';
import type { WorldStore } from './store/types';
import * as V from './views';

export interface DatasetSource {
  dataset: MasilDataset;
  rowCounts: Record<MasilFileKey, number>;
  source: 'FILES' | 'DB';
}

export interface ServiceDeps {
  store: WorldStore;
  data: () => Promise<DatasetSource>;
  assessor: Assessor;
  /** meta.aiMode — 키가 있고 강제 모의가 아니면 LIVE */
  aiMode: 'LIVE' | 'MOCK';
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const APPROVER: ApproverRole[] = ['MARKETING_TEAM', 'MASIL_CEO', 'GROUP_CEO_BOARD', 'SCM'];
const ACTORS: ActorRole[] = [...APPROVER, 'CONTRACT_OFFICER', 'FINANCE', 'AGENCY', 'COREVIA', 'AI_AGENT', 'SYSTEM'];
const OUTCOMES: ReplyOutcome[] = ['APPROVED', 'APPROVED_WITH_CONDITIONS', 'REJECTED', 'INFO_REQUESTED'];
const ITEM_DECISIONS: ItemDecision[] = ['APPROVE', 'REJECT', 'HOLD', 'CONDITIONAL'];
const CONTRACT_DECISIONS: ContractDecision[] = ['RENEW_SAME', 'RENEGOTIATE', 'TERMINATE'];
const SUBJECT_TYPES: SubjectType[] = ['CONTRACT', 'EXPANSION_LINES', 'REPLENISHMENT'];

function bad(message: string, details?: unknown): never {
  throw new DomainError('VALIDATION', message, details);
}
function obj(x: unknown, what: string): Record<string, unknown> {
  if (!x || typeof x !== 'object' || Array.isArray(x)) bad(`${what}: 객체가 필요`);
  return x as Record<string, unknown>;
}
function str(o: Record<string, unknown>, k: string, required = true): string | undefined {
  const v = o[k];
  if (v === undefined || v === null || v === '') {
    if (required) bad(`필수값 누락: ${k}`, { field: k });
    return undefined;
  }
  if (typeof v !== 'string') bad(`${k} 는 문자열`, { field: k });
  return v;
}
function oneOf<T extends string>(v: string | undefined, list: readonly T[], k: string): T {
  if (!v || !list.includes(v as T)) bad(`${k} 값이 올바르지 않음: ${v ?? '(없음)'} — 허용: ${list.join(', ')}`, { field: k });
  return v as T;
}
function date(o: Record<string, unknown>, k: string, required = true): IsoDate | undefined {
  const v = str(o, k, required);
  if (v !== undefined && !DATE_RE.test(v)) bad(`${k} 는 YYYY-MM-DD`, { field: k });
  return v;
}

/** 프로세스 내 직렬화 — 같은 인스턴스의 쓰기를 한 줄로 (DB 쪽은 버전 확인으로 이중 보호) */
class Mutex {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.tail.then(fn, fn);
    this.tail = next.catch(() => undefined);
    return next;
  }
}

export class AouraService {
  private readonly lock = new Mutex();
  constructor(private readonly deps: ServiceDeps) {}

  // ───────────── 내부 ─────────────

  private async ds(): Promise<DatasetSource> {
    return this.deps.data();
  }

  /** 현재 상태 (비어 있으면 시드로 초기화) */
  private async current() {
    const got = await this.deps.store.read();
    if (got) return got;
    const { dataset } = await this.ds();
    const state = wf.initialState(dataset);
    const version = await this.deps.store.replace(state, 'SEED');
    return { state, version, preset: 'SEED' as PresetId };
  }

  private needsAssessment(s: wf.WorldState, r: wf.WorkflowResult): string[] {
    const ids = new Set<string>();
    for (const c of r.routingChanges) if (c.action === 'REAPPROVAL_REQUIRED' || c.action === 'RESUBMIT_PENDING' || c.action === 'ROUTING_UPDATED') ids.add(c.lineId);
    for (const t of r.transitions) {
      if (t.entityType === 'CONTRACT' && ['UNDER_REVIEW', 'REVIEW_BEFORE_DEADLINE', 'AUTO_RENEWED'].includes(t.toStatus)) ids.add(t.entityId);
      if (t.entityType === 'CONTRACT' && t.fromStatus === t.toStatus) ids.add(t.entityId);
      if (t.entityType === 'EXPANSION_LINE' && t.fromStatus === t.toStatus && t.ruleIds.includes('R-INV-03')) ids.add(t.entityId);
      if (t.entityType === 'TASK' && t.toStatus === 'DONE' && t.actorKind === 'MOCK') {
        const task = s.tasks.find((x) => x.id === t.entityId);
        if (task?.type === 'INFO_REQUEST') ids.add(task.subjectId);
      }
    }
    if (r.event?.type === 'EXPANSION_PROPOSAL_RECEIVED') {
      // 이번에 접수한 건 중 확정기한이 가장 이른 묶음
      const fresh = new Set(r.transitions.filter((t) => t.entityType === 'EXPANSION_LINE' && t.fromStatus === null).map((t) => t.entityId));
      const got = s.lines.filter((l) => fresh.has(l.id));
      const first = [...got].sort((a, b) => a.contractDeadline.localeCompare(b.contractDeadline))[0]?.contractDeadline;
      for (const l of got) if (l.contractDeadline === first) ids.add(l.id);
    }
    return [...ids];
  }

  private result(prev: wf.WorldState, next: wf.WorldState, r: wf.WorkflowResult, version: number): MutationResult {
    const needs = this.needsAssessment(next, r);
    return {
      transitions: V.auditRows(next, r.transitions),
      createdTasks: r.createdTasks,
      createdApprovals: r.createdApprovals,
      routingChanges: r.routingChanges,
      summary: {
        stateChanges: r.transitions.filter((t) => t.fromStatus !== null && t.fromStatus !== t.toStatus).length,
        createdTasks: r.createdTasks.length,
        createdApprovals: r.createdApprovals.length,
        routingChanges: r.routingChanges.length,
        needsAssessment: needs,
      },
      simNow: next.simNow,
      stateVersion: version,
    };
    void prev;
  }

  /** 쓰기: 순수 리듀서 실행 → 플래그 재계산 → 저장. 실패하면 아무것도 저장하지 않는다 (AC-1-07) */
  private mutate<R extends wf.WorkflowResult>(fn: (s: wf.WorldState, ds: MasilDataset) => R, opts: { expectedVersion?: number } = {}) {
    return this.lock.run(async () => {
      const cur = await this.current();
      if (opts.expectedVersion !== undefined && opts.expectedVersion !== cur.version) {
        throw new DomainError('CONFLICT', '판단안을 만드는 사이 상태가 바뀌었습니다 — 다시 만드세요', { expectedVersion: opts.expectedVersion, actual: cur.version });
      }
      const { dataset } = await this.ds();
      const r = fn(cur.state, dataset);
      const next = settle(r.state, dataset);
      const version = await this.deps.store.write(next, { expectedVersion: cur.version, prev: cur.state });
      return { r, prev: cur.state, next, version, ds: dataset, mr: this.result(cur.state, next, r, version) };
    });
  }

  private async read() {
    const cur = await this.current();
    const d = await this.ds();
    return { s: cur.state, ds: d.dataset, version: cur.version, preset: cur.preset, d };
  }

  // ───────────── 읽기 ─────────────

  async meta(): Promise<MetaView> {
    const { s, version, preset, d } = await this.read();
    return {
      workId: 'W02',
      simNow: s.simNow,
      aiMode: this.deps.aiMode,
      model: MODEL,
      cashForecastVersion: s.forecast.id,
      dataMode: 'API',
      persistence: this.deps.store.kind,
      rawSource: d.source,
      preset: preset ? presetInfo(preset) : null,
      stateVersion: version,
    };
  }
  async overview() {
    const { s, ds } = await this.read();
    return V.overview(s, ds);
  }
  async contract(id: string, terminateOn?: string) {
    const { s, ds } = await this.read();
    return V.contractView(s, ds, id, terminateOn);
  }
  async penalty(id: string, terminateOn: string | null) {
    const { s } = await this.read();
    if (id !== s.contract.id) throw new DomainError('NOT_FOUND', `전속계약 없음: ${id}`);
    if (!terminateOn) bad('필수값 누락: terminateOn');
    return V.penaltyView(s, terminateOn);
  }
  async proposal(id: string, f: ProposalFilters) {
    const { s, ds } = await this.read();
    return V.proposalView(s, ds, id, f);
  }
  async assessment(id: string) {
    const { s } = await this.read();
    const a = s.assessments.find((x) => x.id === id);
    if (!a) throw new DomainError('NOT_FOUND', `판단안 없음: ${id}`);
    return V.assessmentView(s, a);
  }
  async assessments(f: { subjectId?: string } = {}) {
    const { s } = await this.read();
    return s.assessments.filter((a) => !f.subjectId || a.subjectIds.includes(f.subjectId)).map((a) => V.assessmentView(s, a));
  }
  async approvals(f: { role?: string; status?: string }) {
    const { s, ds } = await this.read();
    return V.approvalsView(s, ds, f);
  }
  async approval(id: string) {
    const { s, ds } = await this.read();
    const a = s.approvals.find((x) => x.id === id);
    if (!a) throw new DomainError('NOT_FOUND', `승인요청 없음: ${id}`);
    return V.approvalView(s, ds, a);
  }
  async tasks(f: { role?: string; status?: string }) {
    const { s } = await this.read();
    return V.tasksView(s, f);
  }
  async influencers(includeReference: boolean) {
    const { s, ds } = await this.read();
    return V.influencers(s, ds, includeReference);
  }
  async inventory() {
    const { s, ds } = await this.read();
    return V.inventoryView(s, ds);
  }
  async cash(opts: { sensitivity?: boolean; version?: string }) {
    const { s, ds } = await this.read();
    return V.cashView(s, ds, opts);
  }
  async audit(f: AuditFilters) {
    const { s } = await this.read();
    return V.auditView(s, f);
  }
  async receivables() {
    const { s, ds } = await this.read();
    return V.receivablesView(s, ds);
  }
  async registry() {
    const { s, d } = await this.read();
    return V.registryView(s, d.rowCounts);
  }
  scenarios() {
    return PRESETS;
  }
  async scenarioCheck(id: string) {
    const { s } = await this.read();
    return checkScenario(id, s);
  }

  // ───────────── 쓰기 ─────────────

  /** BE-07 미리보기 — 저장 없이 같은 리듀서를 돌린다 (미리보기와 실제 이동의 transitions 가 같다) */
  async clockPreview(to: string): Promise<ClockResponse & { preview: true; passingDeadlines: { kind: string; id: string; deadline: string }[] }> {
    if (!to || Number.isNaN(Date.parse(to))) bad('to 는 ISO 시각 (예 2026-07-18T00:00:00+09:00)', { field: 'to' });
    const { s, ds, version } = await this.read();
    const r = wf.advanceClock(s, to);
    const next = settle(r.state, ds);
    const passing: { kind: string; id: string; deadline: string }[] = [];
    const between = (d: string) => toMs(deadlineAt(d)) >= toMs(s.simNow) && toMs(deadlineAt(d)) < toMs(to);
    if (between(s.contract.noticeDeadline)) passing.push({ kind: 'CONTRACT_NOTICE', id: s.contract.id, deadline: s.contract.noticeDeadline });
    for (const d of [...new Set(s.lines.map((l) => l.contractDeadline))].sort()) if (between(d)) passing.push({ kind: 'LINE_DEADLINE', id: d, deadline: d });
    for (const a of s.approvals) if (a.status === 'PENDING' && between(a.hardDeadline)) passing.push({ kind: 'APPROVAL', id: a.id, deadline: a.hardDeadline });
    for (const t of s.tasks) if (['OPEN', 'IN_PROGRESS'].includes(t.status) && toMs(t.dueAt) < toMs(to) && toMs(t.dueAt) >= toMs(s.simNow)) passing.push({ kind: 'TASK', id: t.id, deadline: t.dueAt });
    return { ...this.result(s, next, r, version), event: r.event, preview: true, passingDeadlines: passing };
  }

  async advanceClock(to: string): Promise<ClockResponse> {
    if (!to || Number.isNaN(Date.parse(to))) bad('to 는 ISO 시각 (예 2026-07-18T00:00:00+09:00)', { field: 'to' });
    const m = await this.mutate((s) => wf.advanceClock(s, to));
    return { ...m.mr, event: m.r.event! };
  }

  async postEvent(body0: unknown): Promise<EventResponse> {
    const body = obj(body0, '요청');
    const type = str(body, 'type')!;
    const p = obj(body.payload ?? {}, 'payload');
    const today = (s: wf.WorldState) => kstDate(s.simNow);
    const notPast = (s: wf.WorldState, d: string | undefined, k: string) => {
      if (d && d < today(s)) bad('기준시각 이전 사건은 넣을 수 없습니다', { field: k, simNow: s.simNow });
    };
    let run: (s: wf.WorldState, ds: MasilDataset) => wf.EventResult;
    switch (type) {
      case 'RENEWAL_NOTICE_RECEIVED': {
        const id = str(p, 'contractId')!;
        run = (s) => {
          if (id !== s.contract.id) throw new DomainError('NOT_FOUND', `전속계약 없음: ${id}`);
          return wf.receiveRenewalNotice(s);
        };
        break;
      }
      case 'EXPANSION_PROPOSAL_RECEIVED': {
        const id = str(p, 'proposalId')!;
        // BE-20: 범위 선택 없음 — 일부 접수는 기안 총액(R-AUTH-01)을 낮춰 권한 제약을 없앨 수 있다
        if (p.lineIds !== undefined) bad('기안은 25건 전체로 접수합니다 (권한 판정 기안 총액 — R-AUTH-01)', { field: 'lineIds' });
        run = (s, ds) => {
          if (id !== 'PROP-2026-07') throw new DomainError('NOT_FOUND', `확대 기안 없음: ${id}`);
          return wf.receiveProposal(s, ds);
        };
        break;
      }
      case 'AR_COLLECTION_DELAYED': {
        const arId = str(p, 'arId')!;
        const newDueDate = date(p, 'newDueDate')!;
        run = (s, ds) => {
          notPast(s, newDueDate, 'newDueDate');
          return wf.arCollectionDelayed(s, ds, { arId, newDueDate });
        };
        break;
      }
      case 'LINE_TERMS_CHANGED': {
        const lineId = str(p, 'lineId')!;
        const settlementDate = date(p, 'settlementDate', false);
        const rk = p.requestedKrw;
        if (rk !== undefined && (typeof rk !== 'number' || !Number.isInteger(rk) || rk <= 0)) bad('requestedKrw 는 양의 정수(원)', { field: 'requestedKrw' });
        if (settlementDate === undefined && rk === undefined) bad('요청액 · 집행일 중 하나 이상 필요', { field: 'settlementDate' });
        run = (s, ds) => {
          notPast(s, settlementDate, 'settlementDate');
          return wf.changeLineTerms(s, ds, { lineId, ...(settlementDate ? { settlementDate } : {}), ...(rk !== undefined ? { requestedKrw: rk as number } : {}) });
        };
        break;
      }
      case 'COUNTERPARTY_REPLY': {
        const input: CounterpartyReplyInput = {
          from: oneOf(str(p, 'from'), ['AGENCY', 'SCM', 'COREVIA'] as const, 'from'),
          outcome: oneOf(str(p, 'outcome'), ['RECEIPT_CONFIRMED', 'INFO_PROVIDED', 'INSUFFICIENT', 'REJECTED'] as const, 'outcome'),
          note: str(p, 'note', false) ?? '',
          label: 'MOCK',
        };
        const inbound = date(p, 'inboundExpectedDate', false);
        if (inbound) input.inboundExpectedDate = inbound;
        if (p.replenishmentNeeded !== undefined) {
          if (typeof p.replenishmentNeeded !== 'boolean') bad('replenishmentNeeded 는 true/false', { field: 'replenishmentNeeded' });
          input.replenishmentNeeded = p.replenishmentNeeded;
        }
        run = (s, ds) => wf.counterpartyReply(s, ds, input);
        break;
      }
      case 'APPROVAL_REPLY': {
        const requestId = str(p, 'requestId')!;
        const r = await this.reply(requestId, p);
        return { ...r, needsAssessment: r.summary.needsAssessment };
      }
      case 'CLOCK_ADVANCED': {
        const r = await this.advanceClock(str(p, 'to')!);
        return { ...r, needsAssessment: r.summary.needsAssessment };
      }
      default:
        bad(`알 수 없는 사건 유형: ${type}`, { field: 'type' });
    }
    const m = await this.mutate((s, ds) => run(s, ds));
    return { ...m.mr, event: m.r.event!, needsAssessment: m.mr.summary.needsAssessment };
  }

  async createAssessment(body0: unknown): Promise<AssessmentCreateResponse> {
    const body = obj(body0, '요청');
    const subjectType = oneOf(str(body, 'subjectType'), SUBJECT_TYPES, 'subjectType');
    const ids = body.subjectIds;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === 'string')) bad('subjectIds 는 문자열 배열', { field: 'subjectIds' });
    const req: AssessmentCreateBody = { subjectType, subjectIds: ids as string[] };
    // 근거는 현재 상태에서 결정적으로 계산 → AI(또는 모의)가 문장만 → 같은 버전일 때만 기록
    const { s, ds, version } = await this.read();
    const basis = buildAssessmentBasis(s, ds, req);
    const draft = await this.deps.assessor.assess(basis, { createdAt: s.simNow });
    const m = await this.mutate((st) => wf.recordAssessment(st, draft), { expectedVersion: version });
    const a = (m.r as ReturnType<typeof wf.recordAssessment>).assessment;
    return { ...m.mr, assessment: V.assessmentView(m.next, m.next.assessments.find((x) => x.id === a.id)!) };
  }

  async createApprovalRequests(body0: unknown): Promise<ApprovalCreateResponse> {
    const body = obj(body0, '요청');
    const assessmentId = str(body, 'assessmentId')!;
    const m = await this.mutate((s) => wf.requestApprovalFromAssessment(s, assessmentId));
    return { ...m.mr, requests: m.r.createdApprovals };
  }

  async reply(requestId: string, body0: unknown): Promise<ReplyResponse> {
    const b = obj(body0, '요청');
    const respondentRole = oneOf(str(b, 'respondentRole'), APPROVER, 'respondentRole');
    const outcome = oneOf(str(b, 'outcome'), OUTCOMES, 'outcome');
    const reason = str(b, 'reason', false) ?? '';
    if ((outcome === 'REJECTED' || outcome === 'INFO_REQUESTED') && !reason.trim()) bad(outcome === 'REJECTED' ? '반려에는 사유가 필요' : '정보 요청에는 질문이 필요', { field: 'reason' });
    const conditions = str(b, 'conditions', false);
    let itemDecisions: ReplyBody['itemDecisions'];
    if (b.itemDecisions !== undefined) {
      if (!Array.isArray(b.itemDecisions)) bad('itemDecisions 는 배열', { field: 'itemDecisions' });
      itemDecisions = (b.itemDecisions as unknown[]).map((x, i) => {
        const o = obj(x, `itemDecisions[${i}]`);
        const decision = oneOf(str(o, 'decision'), ITEM_DECISIONS, `itemDecisions[${i}].decision`);
        const condition = str(o, 'condition', false) ?? (decision === 'CONDITIONAL' ? conditions : undefined);
        return { itemId: str(o, 'itemId')!, decision, ...(condition ? { condition } : {}) };
      });
    }
    const decision = b.decision === undefined ? undefined : oneOf(str(b, 'decision'), CONTRACT_DECISIONS, 'decision');
    let infoRequest: ReplyBody['infoRequest'];
    if (b.infoRequest !== undefined) {
      const o = obj(b.infoRequest, 'infoRequest');
      infoRequest = { target: oneOf(str(o, 'target'), ACTORS, 'infoRequest.target'), question: str(o, 'question')! };
    }
    const input: wf.ReplyInput = { requestId, respondentRole, outcome, reason, ...(itemDecisions ? { itemDecisions } : {}), ...(decision ? { decision } : {}), ...(infoRequest ? { infoRequest } : {}) };
    const m = await this.mutate((s, ds) => wf.replyToApproval(s, ds, input));
    const ev = m.r.event as { payload: unknown } | null;
    return { ...m.mr, event: m.r.event!, reply: ev!.payload as ReplyResponse['reply'], request: m.next.approvals.find((a) => a.id === requestId)! };
  }

  /**
   * 작업 시작 · 완료 · 취소. actorRole(요청한 사람의 현재 역할)은 필수 — 없으면 422 VALIDATION.
   * 작업의 담당 역할이 아니면 도메인(assertTaskActor)이 422 FORBIDDEN_ROLE 로 거부하고 아무것도 저장하지 않는다 (CLAUDE.md 규칙 10).
   */
  async patchTask(id: string, body0: unknown): Promise<TaskPatchResponse> {
    const b = obj(body0, '요청');
    const status = oneOf(str(b, 'status'), ['IN_PROGRESS', 'DONE', 'CANCELLED'] as const, 'status');
    const actorRole = oneOf(str(b, 'actorRole'), ACTORS, 'actorRole');
    const resultNote = str(b, 'resultNote', false);
    const payload = b.payload === undefined ? undefined : obj(b.payload, 'payload');
    if (payload?.settlementDate !== undefined && (typeof payload.settlementDate !== 'string' || !DATE_RE.test(payload.settlementDate))) bad('payload.settlementDate 는 YYYY-MM-DD', { field: 'payload.settlementDate' });
    const body: TaskPatchBody = { status, actorRole, ...(resultNote ? { resultNote } : {}), ...(payload ? { payload } : {}) };
    const m = await this.mutate((s, ds) => {
      const t = s.tasks.find((x) => x.id === id);
      if (!t) throw new DomainError('NOT_FOUND', `작업 없음: ${id}`);
      if (body.status === 'IN_PROGRESS') return wf.startTask(s, id, actorRole);
      if (body.status === 'CANCELLED') return wf.cancelTask(s, id, { actorRole, reason: body.resultNote ?? '' });
      assertTaskActor(t, actorRole);
      if (t.type === 'RESCHEDULE_CAMPAIGN' && typeof body.payload?.settlementDate === 'string' && body.payload.settlementDate < kstDate(s.simNow)) bad('기준시각 이전 날짜로 집행일을 바꿀 수 없습니다', { field: 'payload.settlementDate' });
      return wf.completeTask(s, ds, id, { actorRole, ...(body.resultNote ? { resultNote: body.resultNote } : {}), ...(body.payload ? { payload: body.payload } : {}) });
    });
    return { ...m.mr, task: V.taskView(m.next.tasks.find((x) => x.id === id)!) };
  }

  /** 보충요청 초안 — actorRole 필수, SCM 만 (SCREEN_SPEC S-09). 아니면 422 FORBIDDEN_ROLE, 상태 불변 */
  async createReplenishment(body0: unknown): Promise<ReplenishmentCreateResponse> {
    const b = obj(body0, '요청');
    const actorRole = oneOf(str(b, 'actorRole'), ACTORS, 'actorRole');
    assertReplenishmentDrafter(actorRole);
    const triggerLineId = str(b, 'triggerLineId')!;
    const skuIds = b.skuIds;
    if (skuIds !== undefined && (!Array.isArray(skuIds) || !skuIds.every((x) => typeof x === 'string'))) bad('skuIds 는 문자열 배열', { field: 'skuIds' });
    const m = await this.mutate((s, ds) => wf.draftReplenishment(s, ds, { triggerLineId, ...(skuIds ? { skuIds: skuIds as string[] } : {}) }));
    const before = new Set(m.prev.replenishments.map((r) => r.id));
    return { ...m.mr, replenishments: m.next.replenishments.filter((r) => !before.has(r.id)) };
  }

  /** S-13 초기화 후 재생 — 운영 상태만 바꾼다(원본 적재 테이블은 그대로) */
  async resetScenario(id: string): Promise<ScenarioResetResponse> {
    if (!isPresetId(id)) throw new DomainError('NOT_FOUND', `시연 프리셋 없음: ${id}`);
    return this.lock.run(async () => {
      const { dataset } = await this.ds();
      const state = buildPreset(id, dataset);
      const version = await this.deps.store.replace(state, id);
      return { preset: presetInfo(id), simNow: state.simNow, replayedEvents: state.events, stateVersion: version };
    });
  }
}

export { CONTRACT_ID };
