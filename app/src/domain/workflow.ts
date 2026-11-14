/**
 * 상태 머신 · 워크플로 (ONTOLOGY 3절). 모든 함수는 순수하다: (state, 입력) → 새 state + 전이 목록.
 * - 허용되지 않은 전이는 DomainError('INVALID_TRANSITION', 409)로 막는다.
 * - 모든 상태 변경은 audit 에 1행 이상 남긴다 (누가 · 언제(simNow) · 근거 규칙 · 이전/이후 상태 · 이벤트 ID).
 * - AI 는 어떤 전이도 일으키지 않는다. APPROVED 류 전이는 requiredRole 의 회신으로만 (R-AUTH-05).
 * - 바뀐 상태가 다음 판단의 입력이 된다: 권한 재판정(R-AUTH-06), 배분 점검(R-CP-06), 계약 결과(R-PEN-01), 재고 권고(R-INV-03).
 * 2단계에서 DB 영속화는 이 상태를 테이블로 옮기고 같은 함수를 호출한다.
 */
import { assertCanReply, roleRank, routeContract, routeExpansionLine, routeReplenishment } from './authority';
import { simulateCash, isInWindows, type CashSimResult } from './cash';
import type { MasilDataset } from './dataset';
import { addBusinessDays, addDays, deadlineAt, isAfter, isOnOrAfter, isPastDeadline, kst, kstDate, minDate, toMs } from './dates';
import { daysLeft, deadlineLevel, internalDueAt } from './deadline';
import { DomainError } from './errors';
import { expectedPaymentDate, inventoryGate, replenishmentSuggestionsForLine } from './inventory';
import { krw } from './money';
import { penalty, renewalTerm } from './penalty';
import { assertTaskActor } from './permissions';
import { computePerformance, cpGrade, cpRefSignDiffers } from './performance';
import { PROPOSAL_ID, seedContract, SIM_START } from './seed';
import type {
  ActorKind,
  ActorRole,
  ApprovalReply,
  ApprovalRequest,
  ApprovalStatus,
  ApproverRole,
  Assessment,
  AuditLogEntry,
  CampaignPerformance,
  ContractDecision,
  ContractStatus,
  CounterpartyReplyInput,
  DeadlineLevel,
  DomainEvent,
  EventType,
  ExclusiveContract,
  ExpansionLine,
  ExpansionProposal,
  IsoDate,
  IsoDateTime,
  ItemDecision,
  LineFlag,
  LineStatus,
  Notice,
  NoticeReceipt,
  ReplenishmentRequest,
  ReplenishmentStatus,
  ReplyOutcome,
  Routing,
  RoutingReason,
  RuleId,
  SubjectType,
  Task,
} from './types';
import { ROLE_KO } from './types';

// ───────────────────────── 상태 ─────────────────────────

export interface WorldState {
  simNow: IsoDateTime;
  contract: ExclusiveContract;
  proposal: ExpansionProposal | null;
  lines: ExpansionLine[];
  approvals: ApprovalRequest[];
  replies: ApprovalReply[];
  tasks: Task[];
  notices: Notice[];
  receipts: NoticeReceipt[];
  replenishments: ReplenishmentRequest[];
  /** 판단안 (AI 또는 모의). 판단안은 상태를 바꾸지 않는다 — 기록과 승인요청 근거 연결만 */
  assessments: Assessment[];
  audit: AuditLogEntry[];
  events: DomainEvent[];
  /** 현재 유효한 자금 재전망 (FULL). 권한 판정(R-AUTH-03)의 입력 */
  forecast: CashSimResult;
  /** 누적된 조건 변경 (AR 회수일) */
  arDueOverrides: Record<string, IsoDate>;
  seq: Record<string, number>;
}

export type RoutingAction = 'ROUTING_UPDATED' | 'REAPPROVAL_REQUIRED' | 'POST_DEADLINE_REPORT' | 'KEEP_HIGHER_APPROVAL' | 'RESUBMIT_PENDING';

export interface RoutingChange {
  lineId: string;
  from: ApproverRole | null;
  to: ApproverRole;
  ruleId: RuleId;
  action: RoutingAction;
}

export interface WorkflowResult {
  state: WorldState;
  event: DomainEvent | null;
  transitions: AuditLogEntry[];
  createdTasks: Task[];
  createdApprovals: ApprovalRequest[];
  routingChanges: RoutingChange[];
}
export type EventResult = WorkflowResult & { event: DomainEvent };

// ───────────────────────── 전이 표 ─────────────────────────

const AUTO_RENEW_FROM: ContractStatus[] = ['ACTIVE', 'UNDER_REVIEW', 'PENDING_APPROVAL', 'REVIEW_BEFORE_DEADLINE', 'NOTICE_PENDING'];

export const CONTRACT_TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  ACTIVE: ['UNDER_REVIEW', 'AUTO_RENEWED'],
  UNDER_REVIEW: ['PENDING_APPROVAL', 'AUTO_RENEWED'],
  PENDING_APPROVAL: ['RENEWED_APPROVED', 'NOTICE_PENDING', 'REVIEW_BEFORE_DEADLINE', 'AUTO_RENEWED'],
  REVIEW_BEFORE_DEADLINE: ['PENDING_APPROVAL', 'AUTO_RENEWED'],
  NOTICE_PENDING: ['NOTICE_SENT', 'AUTO_RENEWED'],
  NOTICE_SENT: ['NOTICE_ACKNOWLEDGED', 'NOTICE_UNCONFIRMED'],
  NOTICE_ACKNOWLEDGED: ['NEGOTIATING', 'TERMINATING'],
  RENEWED_APPROVED: [],
  NEGOTIATING: [],
  TERMINATING: [],
  NOTICE_UNCONFIRMED: [],
  AUTO_RENEWED: [],
};

const LINE_OPEN: LineStatus[] = ['RECEIVED', 'VALIDATED', 'INFO_MISSING', 'PENDING_APPROVAL', 'ON_HOLD', 'REAPPROVAL_REQUIRED'];

export const LINE_TRANSITIONS: Record<LineStatus, readonly LineStatus[]> = {
  RECEIVED: ['VALIDATED', 'INFO_MISSING', 'AUTO_CONFIRMED'],
  INFO_MISSING: ['VALIDATED', 'AUTO_CONFIRMED'],
  VALIDATED: ['PENDING_APPROVAL', 'INFO_MISSING', 'AUTO_CONFIRMED'],
  PENDING_APPROVAL: ['APPROVED', 'CONDITIONALLY_APPROVED', 'REJECTED', 'ON_HOLD', 'AUTO_CONFIRMED'],
  ON_HOLD: ['PENDING_APPROVAL', 'AUTO_CONFIRMED'],
  APPROVED: ['REAPPROVAL_REQUIRED', 'CONFIRMED'],
  CONDITIONALLY_APPROVED: ['REAPPROVAL_REQUIRED', 'CONFIRMED'],
  REAPPROVAL_REQUIRED: ['PENDING_APPROVAL', 'AUTO_CONFIRMED'],
  REJECTED: ['CANCELLED'],
  CONFIRMED: [],
  CANCELLED: [],
  AUTO_CONFIRMED: [],
};

export const REPLENISHMENT_TRANSITIONS: Record<ReplenishmentStatus, readonly ReplenishmentStatus[]> = {
  DRAFT: ['SUBMITTED', 'REJECTED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'INFO_REQUESTED'],
  INFO_REQUESTED: ['SUBMITTED'],
  APPROVED: [],
  REJECTED: [],
};

function assertIn<S extends string>(kind: string, table: Record<S, readonly S[]>, from: S, to: S): void {
  if (!table[from].includes(to)) throw new DomainError('INVALID_TRANSITION', `${kind}: ${from} → ${to} 전이는 허용되지 않음`, { from, to });
}
export const assertContractTransition = (from: ContractStatus, to: ContractStatus) => assertIn('계약', CONTRACT_TRANSITIONS, from, to);
export const assertLineTransition = (from: LineStatus, to: LineStatus) => assertIn('기안 건', LINE_TRANSITIONS, from, to);

// ───────────────────────── 트랜잭션 도우미 ─────────────────────────

class Tx {
  readonly s: WorldState;
  readonly transitions: AuditLogEntry[] = [];
  readonly createdTasks: Task[] = [];
  readonly createdApprovals: ApprovalRequest[] = [];
  readonly routingChanges: RoutingChange[] = [];
  event: DomainEvent | null = null;

  constructor(state: WorldState) {
    this.s = structuredClone(state);
  }

  nextId(prefix: string, width = 3): string {
    const n = (this.s.seq[prefix] ?? 0) + 1;
    this.s.seq[prefix] = n;
    return `${prefix}-${String(n).padStart(width, '0')}`;
  }

  emit(type: EventType, payload: unknown, label: 'ORIGINAL' | 'MOCK', createdBy: ActorRole): DomainEvent {
    const ev: DomainEvent = { id: this.nextId('EVT'), type, payload, label, simAt: this.s.simNow, createdAt: this.s.simNow, createdBy };
    this.s.events.push(ev);
    this.event = ev;
    return ev;
  }

  audit(e: {
    entityType: string;
    entityId: string;
    from: string | null;
    to: string;
    actorRole: ActorRole;
    actorKind: ActorKind;
    ruleIds?: RuleId[];
    reason: string;
    snapshot?: Record<string, unknown>;
  }): void {
    const row: AuditLogEntry = {
      id: this.nextId('AUD', 4),
      entityType: e.entityType,
      entityId: e.entityId,
      fromStatus: e.from,
      toStatus: e.to,
      actorRole: e.actorRole,
      actorKind: e.actorKind,
      ruleIds: e.ruleIds ?? [],
      eventId: this.event?.id ?? null,
      reason: e.reason,
      simAt: this.s.simNow,
      createdAt: this.s.simNow,
      snapshot: e.snapshot ?? {},
    };
    this.s.audit.push(row);
    this.transitions.push(row);
  }

  setContract(to: ContractStatus, actorRole: ActorRole, actorKind: ActorKind, ruleIds: RuleId[], reason: string): void {
    const c = this.s.contract;
    assertContractTransition(c.status, to);
    const from = c.status;
    c.status = to;
    this.audit({ entityType: 'CONTRACT', entityId: c.id, from, to, actorRole, actorKind, ruleIds, reason, snapshot: { decision: c.decision, noticeDeadline: c.noticeDeadline } });
  }

  setLine(l: ExpansionLine, to: LineStatus, actorRole: ActorRole, actorKind: ActorKind, ruleIds: RuleId[], reason: string): void {
    assertLineTransition(l.status, to);
    const from = l.status;
    l.status = to;
    this.audit({
      entityType: 'EXPANSION_LINE',
      entityId: l.id,
      from,
      to,
      actorRole,
      actorKind,
      ruleIds,
      reason,
      snapshot: { requiredRole: l.routing?.requiredRole ?? null, settlementDate: l.settlementDate, flags: [...l.flags] },
    });
  }

  setApproval(a: ApprovalRequest, to: ApprovalStatus, actorRole: ActorRole, actorKind: ActorKind, ruleIds: RuleId[], reason: string): void {
    const from = a.status;
    a.status = to;
    this.audit({ entityType: 'APPROVAL_REQUEST', entityId: a.id, from, to, actorRole, actorKind, ruleIds, reason });
  }

  setReplenishment(r: ReplenishmentRequest, to: ReplenishmentStatus, actorRole: ActorRole, actorKind: ActorKind, ruleIds: RuleId[], reason: string): void {
    assertIn('보충요청', REPLENISHMENT_TRANSITIONS, r.status, to);
    const from = r.status;
    r.status = to;
    this.audit({ entityType: 'REPLENISHMENT', entityId: r.id, from, to, actorRole, actorKind, ruleIds, reason });
  }

  setTask(t: Task, to: Task['status'], actorRole: ActorRole, actorKind: ActorKind, reason: string, resultNote?: string): void {
    const from = t.status;
    t.status = to;
    if (resultNote !== undefined) t.resultNote = resultNote;
    this.audit({ entityType: 'TASK', entityId: t.id, from, to, actorRole, actorKind, reason });
  }

  addTask(t: Omit<Task, 'id' | 'status' | 'createdByEventId'>, ruleIds: RuleId[] = []): Task {
    const task: Task = { ...t, id: this.nextId('TSK'), status: 'OPEN', createdByEventId: this.event?.id ?? null };
    this.s.tasks.push(task);
    this.createdTasks.push(task);
    this.audit({ entityType: 'TASK', entityId: task.id, from: null, to: 'OPEN', actorRole: 'SYSTEM', actorKind: 'SYSTEM', ruleIds, reason: `작업 생성: ${task.type}` });
    return task;
  }

  addApproval(a: Omit<ApprovalRequest, 'id' | 'status'>, note?: string): ApprovalRequest {
    const req: ApprovalRequest = { ...a, id: this.nextId('APR'), status: 'PENDING' };
    this.s.approvals.push(req);
    this.createdApprovals.push(req);
    this.audit({
      entityType: 'APPROVAL_REQUEST',
      entityId: req.id,
      from: null,
      to: 'PENDING',
      actorRole: 'SYSTEM',
      actorKind: 'SYSTEM',
      ruleIds: [...new Set(req.routingReasons.map((r) => r.ruleId))],
      reason: `승인요청 생성 → ${req.requiredRole}${note ? ` · ${note}` : ''}`,
      snapshot: { subjectIds: req.subjectIds, proposed: req.proposed, version: req.version, supersedesId: req.supersedesId },
    });
    return req;
  }

  result(): WorkflowResult {
    return {
      state: this.s,
      event: this.event,
      transitions: this.transitions,
      createdTasks: this.createdTasks,
      createdApprovals: this.createdApprovals,
      routingChanges: this.routingChanges,
    };
  }
  eventResult(): EventResult {
    const r = this.result();
    if (!r.event) throw new Error('이벤트 없음');
    return r as EventResult;
  }
}

// ───────────────────────── 조회 도우미 ─────────────────────────

const perfCache = new WeakMap<MasilDataset, Record<string, CampaignPerformance>>();
function campaignPerf(ds: MasilDataset): Record<string, CampaignPerformance> {
  let p = perfCache.get(ds);
  if (!p) perfCache.set(ds, (p = computePerformance(ds, 'CAMPAIGN')));
  return p;
}

function findLine(s: WorldState, id: string): ExpansionLine {
  const l = s.lines.find((x) => x.id === id);
  if (!l) throw new DomainError('NOT_FOUND', `기안 건 없음: ${id}`);
  return l;
}
function findApproval(s: WorldState, id: string): ApprovalRequest {
  const a = s.approvals.find((x) => x.id === id);
  if (!a) throw new DomainError('NOT_FOUND', `승인요청 없음: ${id}`);
  return a;
}

/** 계약이 아직 결정되지 않았나 (R-CON-01) */
function contractUndecided(c: ExclusiveContract): boolean {
  return c.decision === null && c.status !== 'AUTO_RENEWED' && c.status !== 'RENEWED_APPROVED';
}

function proposalTotal(s: WorldState) {
  return s.proposal?.totalRequestedKrw ?? krw('SAMPLE', s.lines.reduce((a, l) => a + l.requestedKrw, 0));
}

function routeLine(s: WorldState, l: ExpansionLine): Routing {
  return routeExpansionLine(l, proposalTotal(s), s.forecast.breachWindows, s.forecast.id);
}

const FLAG_ORDER: LineFlag[] = [
  'OVER_10M',
  'IN_COVENANT_WINDOW',
  'SETTLEMENT_BEFORE_DEADLINE',
  'CONTRACT_PENDING',
  'CP_NEGATIVE',
  'CP_POSITIVE',
  'CP_REF_SIGN_DIFFERS',
  'INVENTORY_BELOW_MIN',
  'STOCKOUT_BEFORE_SETTLEMENT',
];

/** 기안 건 확인 — 권한 · 기한 · 성과 · 재고 · covenant · 계약 연결 플래그 (모두 코드 계산) */
export function lineFlags(s: WorldState, ds: MasilDataset, l: ExpansionLine): LineFlag[] {
  const f = new Set<LineFlag>();
  if (l.requestedKrw > 10_000_000) f.add('OVER_10M');
  if (isInWindows(l.settlementDate, s.forecast.breachWindows)) f.add('IN_COVENANT_WINDOW');
  if (l.settlementDate < l.contractDeadline) f.add('SETTLEMENT_BEFORE_DEADLINE');
  if (l.influencerId === s.contract.influencerId && contractUndecided(s.contract)) f.add('CONTRACT_PENDING');
  const p = campaignPerf(ds)[l.campaignId];
  if (p) {
    f.add(cpGrade(p));
    if (cpRefSignDiffers(p)) f.add('CP_REF_SIGN_DIFFERS');
  }
  for (const g of inventoryGate(ds, l, s.simNow).flags) f.add(g);
  return FLAG_ORDER.filter((x) => f.has(x));
}

export function contractRouting(s: WorldState) {
  return routeContract(s.contract);
}

// ───────────────────────── 권고 (규칙 기반, AI 아님) ─────────────────────────

export interface LineRecommendation {
  decision: Exclude<ItemDecision, 'HOLD'>;
  ruleIds: RuleId[];
  reasons: string[];
  condition?: string;
}

/**
 * 건 단위 권고 (R-CP-05 → R-INV-03 게이트). cpRefDef14 는 읽지 않는다 (플래그 CP_REF_SIGN_DIFFERS 는 참고 표시만).
 * inventoryGate=false 는 테스트 전용 (AC-4-03 확장 효과 확인).
 */
export function recommendLine(l: Pick<ExpansionLine, 'flags' | 'supplyOutlook' | 'inboundExpectedDate'>, opts: { inventoryGate?: boolean } = {}): LineRecommendation {
  const gate = opts.inventoryGate ?? true;
  if (l.flags.includes('CP_NEGATIVE')) {
    const reasons = ['확대 대상 캠페인의 실질 공헌이익(공식값, A05) ≤ 0 → 부결 권고'];
    const ruleIds: RuleId[] = ['R-CP-05'];
    if (l.flags.includes('CONTRACT_PENDING')) {
      reasons.push('같은 인플루언서의 전속계약 미결정 — 기안만 부결해도 계약은 자동 갱신될 수 있음(별도 승인요청)');
      ruleIds.push('R-CON-01');
    }
    return { decision: 'REJECT', ruleIds, reasons };
  }
  if (gate && l.flags.includes('STOCKOUT_BEFORE_SETTLEMENT')) {
    if (l.supplyOutlook === 'NO_SUPPLY') {
      return { decision: 'REJECT', ruleIds: ['R-INV-03', 'R-CP-05'], reasons: ['주력 SKU 집행일 전 품절 예상 · 보충 불가 → 부결 권고'] };
    }
    const after = l.inboundExpectedDate ? `${l.inboundExpectedDate} 입고 이후` : '기발주 입고 이후';
    return {
      decision: 'CONDITIONAL',
      ruleIds: ['R-INV-03', 'R-CP-05'],
      reasons: ['실질 공헌이익 양수지만 주력 SKU 가 집행일 전에 품절 예상 → 승인 불가, 조건부(집행일 조정) 권고'],
      condition: `집행일을 ${after}로 조정`,
    };
  }
  return { decision: 'APPROVE', ruleIds: ['R-CP-05'], reasons: ['확대 대상 캠페인의 실질 공헌이익(공식값, A05) > 0'] };
}

// ───────────────────────── 시드 ─────────────────────────

export function initialState(ds: MasilDataset, opts: { simNow?: IsoDateTime } = {}): WorldState {
  return {
    simNow: opts.simNow ?? SIM_START,
    contract: seedContract(),
    proposal: null,
    lines: [],
    approvals: [],
    replies: [],
    tasks: [],
    notices: [],
    receipts: [],
    replenishments: [],
    assessments: [],
    audit: [],
    events: [],
    forecast: simulateCash(ds, { id: 'CF-v1' }),
    arDueOverrides: {},
    seq: { CF: 1 },
  };
}

// ───────────────────────── 접수 · 확인 ─────────────────────────

/** S1-1 갱신 통보 접수: ACTIVE → UNDER_REVIEW (계약 담당, HUMAN) */
export function receiveRenewalNotice(s: WorldState): EventResult {
  const tx = new Tx(s);
  tx.emit('RENEWAL_NOTICE_RECEIVED', { contractId: s.contract.id }, 'ORIGINAL', 'CONTRACT_OFFICER');
  tx.setContract('UNDER_REVIEW', 'CONTRACT_OFFICER', 'HUMAN', ['R-AUTH-02'], '갱신 통보 접수 (inf001_exclusive_contract_notice.md)');
  return tx.eventResult();
}

/**
 * S1-1 확대 기안 접수 → 확인 도구 실행: 25건 RECEIVED → VALIDATED (권한 · 플래그 계산).
 * 기안은 원본 전체로만 접수한다 — 권한 판정의 기안 총액(R-AUTH-01)이 25건 합이므로 일부만 접수하면 권한 제약이 입력 범위로 사라진다(ONTOLOGY 9-2 ①, BE-20).
 */
export function receiveProposal(s: WorldState, ds: MasilDataset): EventResult {
  if (s.proposal) throw new DomainError('INVALID_TRANSITION', `기안이 이미 접수됨: ${s.proposal.id}`);
  const tx = new Tx(s);
  tx.emit('EXPANSION_PROPOSAL_RECEIVED', { proposalId: PROPOSAL_ID }, 'ORIGINAL', 'MARKETING_TEAM');
  const infOf = new Map(ds.campaigns.map((c) => [c.id, c.influencerId]));
  const total = ds.budgetPlan.reduce((a, p) => a + p.requestedKrw, 0);
  tx.s.proposal = {
    id: PROPOSAL_ID,
    submittedBy: 'MARKETING_TEAM',
    totalRequestedKrw: krw('SAMPLE', total),
    lineCount: ds.budgetPlan.length,
    expectedGmvTotalKrw: krw('SAMPLE', ds.budgetPlan.reduce((a, p) => a + p.expectedGmvKrw, 0)),
  };
  for (const p of ds.budgetPlan) {
    const l: ExpansionLine = {
      id: p.id,
      proposalId: PROPOSAL_ID,
      campaignId: p.campaignId,
      influencerId: infOf.get(p.campaignId) ?? '',
      requestedKrw: p.requestedKrw,
      expectedGmvKrw: p.expectedGmvKrw,
      settlementDate: p.settlementDate,
      contractDeadline: p.contractDeadline,
      status: 'RECEIVED',
      routing: null,
      flags: [],
      approvedByRole: null,
      approvalRequestId: null,
      supplyOutlook: 'UNKNOWN',
      inboundExpectedDate: null,
    };
    tx.s.lines.push(l);
    tx.audit({ entityType: 'EXPANSION_LINE', entityId: l.id, from: null, to: 'RECEIVED', actorRole: 'MARKETING_TEAM', actorKind: 'HUMAN', reason: '확대 기안 접수 (mkt_budget_plan_ms.csv)' });
    const missing = !l.influencerId || !l.settlementDate || !l.contractDeadline || !(l.requestedKrw > 0);
    if (missing) {
      tx.setLine(l, 'INFO_MISSING', 'SYSTEM', 'SYSTEM', [], '필수 입력 누락');
      continue;
    }
    l.routing = routeLine(tx.s, l);
    l.flags = lineFlags(tx.s, ds, l);
    tx.setLine(l, 'VALIDATED', 'SYSTEM', 'SYSTEM', [...new Set(l.routing.reasons.map((r) => r.ruleId))], `확인 완료 → 권한자 ${l.routing.requiredRole}`);
  }
  return tx.eventResult();
}

/** 확인 도구 재실행 — 시점(simNow)이 바뀌면 재고 게이트 · 계약 연결 플래그가 바뀐다 (상태 전이 없음) */
export function revalidateLines(s: WorldState, ds: MasilDataset): WorkflowResult {
  const tx = new Tx(s);
  for (const l of tx.s.lines) if (l.routing) l.flags = lineFlags(tx.s, ds, l);
  return tx.result();
}

// ───────────────────────── 승인요청 생성 ─────────────────────────

/** S1-4 계약 승인요청 (R-AUTH-02). UNDER_REVIEW → PENDING_APPROVAL */
export function requestContractApproval(s: WorldState, input: { proposedDecision: ContractDecision; assessmentId?: string }): WorkflowResult {
  const tx = new Tx(s);
  const c = tx.s.contract;
  if (c.status !== 'UNDER_REVIEW') throw new DomainError('INVALID_TRANSITION', `계약 상태 ${c.status} 에서는 상신할 수 없음 (재상신은 RESUBMIT 작업)`);
  const r = routeContract(c);
  tx.addApproval({
    subjectType: 'CONTRACT',
    subjectIds: [c.id],
    requiredRole: r.requiredRole,
    alsoReportTo: r.alsoReportTo,
    routingReasons: r.reasons,
    assessmentId: input.assessmentId ?? null,
    proposed: [{ itemId: c.id, decision: input.proposedDecision }],
    internalDueAt: internalDueAt('CONTRACT_APPROVAL', c.noticeDeadline),
    hardDeadline: c.noticeDeadline,
    version: 1,
    supersedesId: null,
  });
  tx.setContract('PENDING_APPROVAL', 'SYSTEM', 'SYSTEM', ['R-AUTH-02'], `권한자 ${r.requiredRole} 에게 상신`);
  return tx.result();
}

function mergeReasons(lines: ExpansionLine[]): RoutingReason[] {
  const seen = new Set<string>();
  const out: RoutingReason[] = [];
  for (const l of lines) {
    for (const r of l.routing?.reasons ?? []) {
      const k = r.ruleId === 'R-AUTH-01' ? 'R-AUTH-01' : `${r.ruleId}|${r.text}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

/** A-11 묶음 = requiredRole × contractDeadline × subjectType. 권한 서열 높은 묶음부터 생성 */
function createLineRequests(
  tx: Tx,
  lines: ExpansionLine[],
  proposed: Record<string, string>,
  opts: { assessmentId?: string | null; supersedesId?: string | null; version?: number; keepPending?: boolean },
): void {
  const groups = new Map<string, ExpansionLine[]>();
  for (const l of lines) {
    if (!l.routing) throw new DomainError('INVALID_TRANSITION', `${l.id}: 확인(라우팅) 전에는 상신할 수 없음`);
    const k = `${l.routing.requiredRole}|${l.contractDeadline}`;
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  const ordered = [...groups.values()].sort(
    (a, b) => roleRank(b[0]!.routing!.requiredRole) - roleRank(a[0]!.routing!.requiredRole) || a[0]!.contractDeadline.localeCompare(b[0]!.contractDeadline) || a[0]!.id.localeCompare(b[0]!.id),
  );
  for (const g of ordered) {
    g.sort((a, b) => a.id.localeCompare(b.id));
    const role = g[0]!.routing!.requiredRole;
    const deadline = g[0]!.contractDeadline;
    const req = tx.addApproval({
      subjectType: 'EXPANSION_LINES',
      subjectIds: g.map((l) => l.id),
      requiredRole: role,
      alsoReportTo: [...new Set(g.flatMap((l) => l.routing!.alsoReportTo))],
      routingReasons: mergeReasons(g),
      assessmentId: opts.assessmentId ?? null,
      proposed: g.map((l) => ({ itemId: l.id, decision: proposed[l.id] ?? 'APPROVE' })),
      internalDueAt: internalDueAt('LINE_APPROVAL', deadline),
      hardDeadline: deadline,
      version: opts.version ?? 1,
      supersedesId: opts.supersedesId ?? null,
    });
    for (const l of g) {
      const prevReq = l.approvalRequestId ?? null;
      l.approvalRequestId = req.id;
      if (opts.keepPending) {
        // R-AUTH-06 RESUBMIT_PENDING: 건은 PENDING_APPROVAL 그대로 — 같은 상태 이력 1행만 (BE-02, 이력 연속성)
        tx.audit({ entityType: 'EXPANSION_LINE', entityId: l.id, from: l.status, to: l.status, actorRole: 'SYSTEM', actorKind: 'SYSTEM', ruleIds: ['R-AUTH-06'], reason: `${prevReq ?? '-'} 대체 → ${req.id} 재상신 (${role})` });
      } else {
        tx.setLine(l, 'PENDING_APPROVAL', 'SYSTEM', 'SYSTEM', [...new Set(l.routing!.reasons.map((r) => r.ruleId))], `${req.id} 로 ${role} 에게 상신`);
      }
    }
  }
}

/** S1-4 기안 건 승인요청 (R-AUTH-01/03). VALIDATED | ON_HOLD | REAPPROVAL_REQUIRED → PENDING_APPROVAL */
export function requestLineApproval(s: WorldState, input: { lineIds: string[]; proposed: Record<string, string>; assessmentId?: string }): WorkflowResult {
  const tx = new Tx(s);
  const lines = input.lineIds.map((id) => findLine(tx.s, id));
  for (const l of lines) assertLineTransition(l.status, 'PENDING_APPROVAL');
  createLineRequests(tx, lines, input.proposed, { assessmentId: input.assessmentId ?? null });
  return tx.result();
}

// ───────────────────────── 회신 (MOCK) ─────────────────────────

/** 요청을 번호 대신 의미(대상 종류 · 권한자 · 포함 대상)로 찾는다 — 모의 회신 · 프리셋 재생 (BE-05) */
export interface RequestTarget {
  subjectType: SubjectType;
  requiredRole?: ApproverRole;
  /** 이 대상 ID 들을 모두 포함하는 요청 */
  includes?: string[];
}

export interface ReplyInput {
  /** 요청 번호. 없으면 target 으로 대기(PENDING) 요청을 찾는다 */
  requestId?: string;
  target?: RequestTarget;
  respondentRole: ApproverRole;
  outcome: ReplyOutcome;
  itemDecisions?: ApprovalReply['itemDecisions'];
  decision?: ContractDecision;
  reason: string;
  infoRequest?: ApprovalReply['infoRequest'];
}

const DECISION_TO_STATUS: Record<ItemDecision, LineStatus> = {
  APPROVE: 'APPROVED',
  CONDITIONAL: 'CONDITIONALLY_APPROVED',
  REJECT: 'REJECTED',
  HOLD: 'ON_HOLD',
};

/**
 * 권한자 회신 처리 (R-AUTH-05). requiredRole 이 아니면 422, 이미 처리된 요청이면 409.
 * 검증은 상태를 바꾸기 전에 모두 끝낸다 → 실패 시 아무것도 바뀌지 않는다.
 */
/** target 에 맞는 대기 요청 (여럿이면 가장 최근) */
export function findPendingRequest(s: WorldState, t: RequestTarget): ApprovalRequest {
  const hit = s.approvals.filter(
    (a) => a.status === 'PENDING' && a.subjectType === t.subjectType && (!t.requiredRole || a.requiredRole === t.requiredRole) && (t.includes ?? []).every((x) => a.subjectIds.includes(x)),
  );
  const r = hit.at(-1);
  if (!r) throw new DomainError('NOT_FOUND', `대기 중 승인요청 없음: ${t.subjectType}${t.requiredRole ? ` · ${t.requiredRole}` : ''}${t.includes?.length ? ` · ${t.includes.join(',')}` : ''}`);
  return r;
}

export function replyToApproval(s: WorldState, ds: MasilDataset, input0: ReplyInput): EventResult {
  if (!input0.requestId && !input0.target) throw new DomainError('VALIDATION', '회신 대상 요청(requestId 또는 target)이 없음');
  const input = { ...input0, requestId: input0.requestId ?? findPendingRequest(s, input0.target!).id };
  const req0 = findApproval(s, input.requestId);
  assertCanReply(input.respondentRole, req0);
  if (req0.status !== 'PENDING') throw new DomainError('INVALID_TRANSITION', `${req0.id} 는 이미 ${req0.status} — 회신할 수 없음`);
  if (isPastDeadline(s.simNow, req0.hardDeadline)) throw new DomainError('INVALID_TRANSITION', `${req0.id} 원본 기한(${req0.hardDeadline}) 경과`);

  const tx = new Tx(s);
  const req = findApproval(tx.s, input.requestId);
  const reply: ApprovalReply = {
    id: tx.nextId('RPY'),
    requestId: req.id,
    respondentRole: input.respondentRole,
    outcome: input.outcome,
    itemDecisions: input.itemDecisions ?? [],
    ...(input.decision ? { decision: input.decision } : {}),
    reason: input.reason,
    ...(input.infoRequest ? { infoRequest: input.infoRequest } : {}),
    simAt: tx.s.simNow,
    label: 'MOCK',
  };
  tx.emit('APPROVAL_REPLY', reply, 'MOCK', input.respondentRole);
  tx.s.replies.push(reply);
  const actor = input.respondentRole;

  if (req.subjectType === 'CONTRACT') replyContract(tx, req, reply);
  else if (req.subjectType === 'EXPANSION_LINES') replyLines(tx, req, reply);
  else replyReplenishment(tx, req, reply);

  tx.setApproval(req, input.outcome, actor, 'MOCK', ['R-AUTH-05'], `${actor} 회신: ${input.reason}`);
  void ds;
  return tx.eventResult();
}

function replyContract(tx: Tx, req: ApprovalRequest, reply: ApprovalReply): void {
  const c = tx.s.contract;
  const actor = reply.respondentRole;
  if (c.status !== 'PENDING_APPROVAL') throw new DomainError('INVALID_TRANSITION', `계약 상태 ${c.status} — 회신 반영 불가`);
  if (reply.outcome === 'APPROVED' || reply.outcome === 'APPROVED_WITH_CONDITIONS') {
    const decision = (reply.decision ?? req.proposed[0]?.decision) as ContractDecision | undefined;
    if (!decision) throw new DomainError('INFO_MISSING', '계약 승인 회신에 결정(decision)이 없음');
    c.decision = decision;
    if (decision === 'RENEW_SAME') {
      tx.setContract('RENEWED_APPROVED', actor, 'MOCK', ['R-AUTH-02'], '권한자 승인을 거친 동일 조건 갱신');
      return;
    }
    tx.setContract('NOTICE_PENDING', actor, 'MOCK', ['R-AUTH-02'], `${decision === 'TERMINATE' ? '해지' : '조건변경'} 통보 승인`);
    tx.addTask({ type: 'SEND_NOTICE', subjectType: 'CONTRACT', subjectId: c.id, ownerRole: 'CONTRACT_OFFICER', dueAt: internalDueAt('SEND_NOTICE', c.noticeDeadline), instruction: `${decision} 통보 발송` }, ['R-DL-04']);
    tx.addTask({ type: 'DOCUMENT_CONDITIONS', subjectType: 'CONTRACT', subjectId: c.id, ownerRole: 'CONTRACT_OFFICER', dueAt: internalDueAt('SEND_NOTICE', c.noticeDeadline), instruction: reply.reason }, ['R-DL-04']);
    return;
  }
  // REJECTED | INFO_REQUESTED → 기한 전 재검토 (미갱신 확정 아님 — BPMN '아니오')
  tx.setContract('REVIEW_BEFORE_DEADLINE', actor, 'MOCK', ['R-DL-02'], `${reply.outcome}: ${reply.reason} — 기한 전 재검토 (미갱신 확정 아님)`);
  const review = internalDueAt('CONTRACT_APPROVAL', c.noticeDeadline);
  if (reply.infoRequest || reply.outcome === 'INFO_REQUESTED') {
    const due = deadlineAt(minDate(addDays(kstDate(tx.s.simNow), 3), addDays(c.noticeDeadline, -2)));
    tx.addTask({
      type: 'INFO_REQUEST',
      subjectType: 'CONTRACT',
      subjectId: c.id,
      ownerRole: 'CONTRACT_OFFICER',
      dueAt: due,
      instruction: reply.infoRequest ? `[${reply.infoRequest.target}] ${reply.infoRequest.question}` : reply.reason,
    });
  }
  tx.addTask({ type: 'REVIEW_BEFORE_DEADLINE', subjectType: 'CONTRACT', subjectId: c.id, ownerRole: 'CONTRACT_OFFICER', dueAt: review, instruction: '기한 전 재검토 — 방치하면 7/17 경과 시 자동 갱신(권한 미경유 체결)' }, ['R-DL-02']);
  tx.addTask({ type: 'RESUBMIT', subjectType: 'CONTRACT', subjectId: c.id, ownerRole: 'CONTRACT_OFFICER', dueAt: review }, ['R-DL-04']);
}

function replyLines(tx: Tx, req: ApprovalRequest, reply: ApprovalReply): void {
  const actor = reply.respondentRole;
  const lines = req.subjectIds.map((id) => findLine(tx.s, id));
  // 사전 검증 (권한 상향된 건은 하위 권한자의 회신으로 확정 불가 — R-AUTH-05/06)
  for (const l of lines) {
    if (l.status !== 'PENDING_APPROVAL' || l.approvalRequestId !== req.id) throw new DomainError('INVALID_TRANSITION', `${l.id} 는 ${req.id} 의 대기 건이 아님 (${l.status})`);
    if (l.routing && roleRank(l.routing.requiredRole) > roleRank(actor)) {
      throw new DomainError('FORBIDDEN_ROLE', `권한 없음: ${l.id} 은(는) ${ROLE_KO[l.routing.requiredRole]}만 결정할 수 있습니다 (권한자 변경 — R-AUTH-06)`);
    }
  }
  const decisions = new Map<string, { decision: ItemDecision; condition?: string }>();
  for (const l of lines) {
    const explicit = reply.itemDecisions.find((d) => d.itemId === l.id);
    let d: ItemDecision;
    if (explicit) d = explicit.decision;
    else if (reply.outcome === 'REJECTED') d = 'REJECT';
    else if (reply.outcome === 'INFO_REQUESTED') d = 'HOLD';
    else d = (req.proposed.find((p) => p.itemId === l.id)?.decision as ItemDecision | undefined) ?? 'APPROVE';
    if (d === 'CONDITIONAL' && !explicit?.condition) throw new DomainError('INFO_MISSING', `${l.id}: 조건부 승인에는 조건 문구가 필요`);
    decisions.set(l.id, { decision: d, ...(explicit?.condition ? { condition: explicit.condition } : {}) });
  }
  // BE-08: 회신 유형과 건별 결정이 서로 맞아야 한다 (상태를 바꾸기 전에 검증 → 실패 시 상태 불변)
  const hasConditional = [...decisions.values()].some((d) => d.decision === 'CONDITIONAL');
  if (reply.outcome === 'APPROVED' && hasConditional) throw new DomainError('VALIDATION', '조건부(CONDITIONAL) 건이 있으면 회신 유형은 APPROVED_WITH_CONDITIONS 여야 함');
  if (reply.outcome === 'APPROVED_WITH_CONDITIONS' && !hasConditional) throw new DomainError('VALIDATION', 'APPROVED_WITH_CONDITIONS 회신에는 조건부(CONDITIONAL) 건이 하나 이상 있어야 함');
  let decided = false;
  for (const l of lines) {
    const { decision, condition } = decisions.get(l.id)!;
    const gateNote = decision === 'APPROVE' && l.flags.includes('STOCKOUT_BEFORE_SETTLEMENT') ? ' [재고 게이트 위반 표시: 집행일 전 품절 예상]' : '';
    tx.setLine(l, DECISION_TO_STATUS[decision], actor, 'MOCK', ['R-AUTH-05'], `${actor} 회신 ${decision}${condition ? ` (조건: ${condition})` : ''}${gateNote}`);
    if (decision === 'APPROVE' || decision === 'CONDITIONAL') l.approvedByRole = actor;
    if (decision !== 'HOLD') decided = true;
    if (decision === 'CONDITIONAL') {
      tx.addTask({ type: 'RESCHEDULE_CAMPAIGN', subjectType: 'EXPANSION_LINE', subjectId: l.id, ownerRole: 'MARKETING_TEAM', dueAt: internalDueAt('LINE_APPROVAL', l.contractDeadline), instruction: condition ?? '' });
    }
    if (decision === 'HOLD') {
      tx.addTask({ type: 'REVIEW_BEFORE_DEADLINE', subjectType: 'EXPANSION_LINE', subjectId: l.id, ownerRole: 'MARKETING_TEAM', dueAt: internalDueAt('LINE_APPROVAL', l.contractDeadline), instruction: `보류 — 기한(${l.contractDeadline}) 경과 시 자동 확정(철회 불가)` }, ['R-DL-01']);
    }
  }
  if (decided && req.alsoReportTo.length > 0) {
    tx.addTask({ type: 'REPORT_TO_GROUP', subjectType: 'APPROVAL_REQUEST', subjectId: req.id, ownerRole: actor, dueAt: deadlineAt(req.hardDeadline), instruction: `그룹 보고 (${req.alsoReportTo.join(', ')})` }, ['R-AUTH-01']);
  }
}

function replyReplenishment(tx: Tx, req: ApprovalRequest, reply: ApprovalReply): void {
  const actor = reply.respondentRole;
  const reqs = req.subjectIds.map((id) => {
    const r = tx.s.replenishments.find((x) => x.id === id);
    if (!r) throw new DomainError('NOT_FOUND', `보충요청 없음: ${id}`);
    return r;
  });
  const to: ReplenishmentStatus = reply.outcome === 'REJECTED' ? 'REJECTED' : reply.outcome === 'INFO_REQUESTED' ? 'INFO_REQUESTED' : 'APPROVED';
  for (const r of reqs) {
    tx.setReplenishment(r, to, actor, 'MOCK', ['R-AUTH-04', 'R-AUTH-05'], `${actor} 회신: ${reply.reason}`);
    if (to === 'REJECTED') r.closedBy = 'APPROVER';
  }
  const lineIds = new Set(reqs.map((r) => r.triggerLineId).filter((x): x is string => !!x));
  for (const id of lineIds) {
    const l = findLine(tx.s, id);
    if (to === 'REJECTED') l.supplyOutlook = 'NO_SUPPLY';
    tx.audit({ entityType: 'EXPANSION_LINE', entityId: l.id, from: l.status, to: l.status, actorRole: 'SYSTEM', actorKind: 'SYSTEM', ruleIds: ['R-INV-03'], reason: `보충요청 ${to} → 공급 전망 ${l.supplyOutlook} (다음 권고에 반영)` });
  }
}

// ───────────────────────── 작업 · 외부 회신 ─────────────────────────

const OPEN_TASK: Task['status'][] = ['OPEN', 'IN_PROGRESS', 'OVERDUE'];
const CONTRACT_DECISION_SET: readonly string[] = ['RENEW_SAME', 'RENEGOTIATE', 'TERMINATE'];

/** 작업 완료. 일부 작업은 다른 엔티티 전이를 일으킨다 (ONTOLOGY 3-4) */
export function completeTask(s: WorldState, ds: MasilDataset, taskId: string, input: { resultNote?: string; payload?: Record<string, unknown>; actorRole?: ActorRole }): WorkflowResult {
  const tx = new Tx(s);
  const t = tx.s.tasks.find((x) => x.id === taskId);
  if (!t) throw new DomainError('NOT_FOUND', `작업 없음: ${taskId}`);
  // 담당 역할 검사 (CLAUDE.md 규칙 10). actorRole 이 없으면 담당 역할이 한 것으로 본다 — 프리셋 재생 · 도메인 테스트용. API 는 actorRole 을 필수로 받는다
  if (input.actorRole !== undefined) assertTaskActor(t, input.actorRole);
  if (!OPEN_TASK.includes(t.status)) throw new DomainError('INVALID_TRANSITION', `작업 ${t.id} 는 이미 ${t.status}`);
  // BE-18 (A-35): SCM 보충 검토 작업은 회신이 보충요청 전이를 일으키므로 완료만 따로 할 수 없다 — SCM 보충 검토 회신(scmReview)으로만 닫힌다
  if (t.ownerRole === 'SCM' && (t.type === 'REPLENISHMENT_REVIEW' || t.type === 'INFO_REQUEST')) {
    throw new DomainError('INVALID_TRANSITION', `SCM 보충 검토 회신으로 닫습니다 (S-07 · S-09 [보충 검토 회신]) — 작업 ${t.id} 는 PATCH 로 완료할 수 없음`);
  }
  const c = tx.s.contract;

  if (t.type === 'SEND_NOTICE') {
    if (isPastDeadline(tx.s.simNow, c.noticeDeadline)) throw new DomainError('INVALID_TRANSITION', '통보 기한 경과 — 발송 기록 불가');
    if (!c.decision) throw new DomainError('INVALID_TRANSITION', '승인된 결정 없음');
    const notice: Notice = { id: tx.nextId('NTC'), contractId: c.id, decision: c.decision, sentAt: tx.s.simNow, channel: 'DOCUMENT', label: 'MOCK' };
    tx.s.notices.push(notice);
    tx.setTask(t, 'DONE', t.ownerRole, 'HUMAN', '통보 발송', input.resultNote ?? '');
    tx.setContract('NOTICE_SENT', 'CONTRACT_OFFICER', 'HUMAN', ['R-EXT-01'], `통보 발송 기록 ${notice.id} (수령 미확인)`);
    tx.addTask({ type: 'CONFIRM_RECEIPT', subjectType: 'CONTRACT', subjectId: c.id, ownerRole: 'CONTRACT_OFFICER', dueAt: internalDueAt('CONFIRM_RECEIPT', c.noticeDeadline) }, ['R-EXT-01']);
    return tx.result();
  }

  if (t.type === 'RESUBMIT' && t.subjectType === 'CONTRACT') {
    const prev = [...tx.s.approvals].reverse().find((a) => a.subjectType === 'CONTRACT');
    if (!prev) throw new DomainError('NOT_FOUND', '이전 계약 승인요청 없음');
    // 근거 판단안: 지정한 것, 없으면 그 시점 최신 계약 판단안 (S3-2 재판단 → S3-3 재상신). 검증은 상태 변경 전에 끝낸다
    const asmId = input.payload?.assessmentId as string | undefined;
    const asm = asmId !== undefined ? tx.s.assessments.find((a) => a.id === asmId) : [...tx.s.assessments].reverse().find((a) => a.subjectType === 'CONTRACT');
    if (asmId !== undefined && !asm) throw new DomainError('NOT_FOUND', `판단안 없음: ${asmId}`);
    if (asm && asm.subjectType !== 'CONTRACT') throw new DomainError('VALIDATION', `${asm.id} 은(는) 계약 판단안이 아님 — 재상신 근거로 쓸 수 없음`, { field: 'payload.assessmentId' });
    // BE-22: 계약 판단안이 하나도 없으면 재상신하지 않는다 — 근거 없이, 그것도 반려된 권고를 그대로 실어 올리는 경로를 두지 않는다 (ONTOLOGY 1-3 ApprovalRequest 4)
    if (!asm) throw new DomainError('INFO_MISSING', '근거 판단안이 없습니다 — 판단안을 만든 뒤 재상신하세요', { field: 'payload.assessmentId' });
    const asmDecision = asm.alternatives.find((x) => x.id === asm.recommendation.alternativeId)?.decision;
    // 권고 결정: ① 상신자(계약 담당)가 직접 지정 ② 근거 판단안의 권고. 이전 요청의 권고는 복사하지 않는다
    const explicit = input.payload?.proposedDecision as string | undefined;
    const proposedDecision = (explicit ?? asmDecision) as ContractDecision | undefined;
    if (!proposedDecision || !CONTRACT_DECISION_SET.includes(proposedDecision)) {
      throw new DomainError('VALIDATION', `재상신할 계약 결정이 없음 (${explicit ?? asm.recommendation.alternativeId})`, { field: 'payload.proposedDecision' });
    }
    // 상신자 지정은 숨기지 않는다 — 판단안 권고와 다르면 proposedSource = SUBMITTER, 같아도 지정 사실은 이력 사유에 남긴다
    const asmContractDecision = asmDecision && CONTRACT_DECISION_SET.includes(asmDecision) ? asmDecision : null;
    const differs = explicit !== undefined && explicit !== asmContractDecision;
    const submitterNote =
      explicit === undefined
        ? undefined
        : differs
          ? `상신자 지정 결정 ${explicit} — 근거 판단안 ${asm.id} 권고 ${asmContractDecision ?? '없음'} 와 다름`
          : `상신자 지정 결정 ${explicit} — 근거 판단안 ${asm.id} 권고와 같음`;
    tx.setTask(t, 'DONE', t.ownerRole, 'HUMAN', '재상신', input.resultNote ?? '');
    if (prev.status === 'PENDING') tx.setApproval(prev, 'SUPERSEDED', 'SYSTEM', 'SYSTEM', ['R-AUTH-06'], '재상신으로 대체');
    const r = routeContract(c);
    const created = tx.addApproval(
      {
        subjectType: 'CONTRACT',
        subjectIds: [c.id],
        requiredRole: r.requiredRole,
        alsoReportTo: r.alsoReportTo,
        routingReasons: r.reasons,
        assessmentId: asm.id,
        proposed: [{ itemId: c.id, decision: proposedDecision }],
        internalDueAt: internalDueAt('CONTRACT_APPROVAL', c.noticeDeadline),
        hardDeadline: c.noticeDeadline,
        version: prev.version + 1,
        supersedesId: prev.id,
        ...(differs ? { proposedSource: 'SUBMITTER' as const } : {}),
      },
      submitterNote,
    );
    // BE-23: 재검토는 재상신을 위한 준비 — 재상신이 끝나면 열린 「기한 전 재검토」를 닫는다. 사람이 완료를 기록한 것이 아니므로 DONE 이 아니라 CANCELLED (ONTOLOGY 3-4).
    // 이미 DONE 인 것은 그대로 둔다. 「승인조건 문서화」 등 사람이 실제로 해야 하는 작업은 닫지 않는다
    for (const rv of tx.s.tasks) {
      if (rv.type !== 'REVIEW_BEFORE_DEADLINE' || rv.subjectType !== 'CONTRACT' || rv.subjectId !== c.id || !OPEN_TASK.includes(rv.status)) continue;
      const reason = `재상신 완료로 종료 — 재검토 결과는 재상신 요청 ${created.id} · 근거 판단안 ${asm.id}`;
      tx.setTask(rv, 'CANCELLED', 'SYSTEM', 'SYSTEM', reason, reason);
    }
    tx.setContract('PENDING_APPROVAL', 'SYSTEM', 'SYSTEM', ['R-AUTH-02'], `재상신 v${prev.version + 1} (supersedes ${prev.id})`);
    return tx.result();
  }

  tx.setTask(t, 'DONE', t.ownerRole, 'HUMAN', `작업 완료: ${t.type}`, input.resultNote ?? '');
  if (t.type === 'RESCHEDULE_CAMPAIGN' && typeof input.payload?.settlementDate === 'string') {
    applyLineTerms(tx, ds, { lineId: t.subjectId, settlementDate: input.payload.settlementDate });
  }
  return tx.result();
}

/** 작업 시작 (OPEN | OVERDUE → IN_PROGRESS). 다른 엔티티 전이는 없다 */
export function startTask(s: WorldState, taskId: string, actorRole: ActorRole): WorkflowResult {
  const tx = new Tx(s);
  const t = tx.s.tasks.find((x) => x.id === taskId);
  if (!t) throw new DomainError('NOT_FOUND', `작업 없음: ${taskId}`);
  assertTaskActor(t, actorRole);
  if (t.status !== 'OPEN' && t.status !== 'OVERDUE') throw new DomainError('INVALID_TRANSITION', `작업 ${t.id}: ${t.status} → IN_PROGRESS 전이는 허용되지 않음`);
  tx.setTask(t, 'IN_PROGRESS', actorRole, 'HUMAN', '작업 시작');
  return tx.result();
}

/** 작업 취소 — 사유 필수. 연결 엔티티 상태는 바꾸지 않는다 (기한 감시는 그대로 돈다) */
export function cancelTask(s: WorldState, taskId: string, input: { actorRole: ActorRole; reason: string }): WorkflowResult {
  if (!input.reason?.trim()) throw new DomainError('VALIDATION', '작업 취소에는 사유가 필요');
  const tx = new Tx(s);
  const t = tx.s.tasks.find((x) => x.id === taskId);
  if (!t) throw new DomainError('NOT_FOUND', `작업 없음: ${taskId}`);
  assertTaskActor(t, input.actorRole);
  if (!OPEN_TASK.includes(t.status)) throw new DomainError('INVALID_TRANSITION', `작업 ${t.id} 는 이미 ${t.status}`);
  tx.setTask(t, 'CANCELLED', input.actorRole, 'HUMAN', `작업 취소: ${input.reason}`, input.reason);
  return tx.result();
}

// ───────────────────────── 판단안 기록 · 승인요청 연결 ─────────────────────────

export type AssessmentDraft = Omit<Assessment, 'id' | 'version'>;

/**
 * 판단안 기록. 판단안은 어떤 엔티티의 상태도 바꾸지 않는다 (AI 는 전이를 일으키지 않음 — ONTOLOGY 3-1).
 * - id = ASM-nnn, version = 같은 대상(subjectType + subjectIds)의 이전 판단안 수 + 1
 * - 이력: ASSESSMENT null → CREATED (actorKind = AI 또는 MOCK)
 * - 판단안 ID 가 비어 있는 대기 중 승인요청(같은 종류, 대상이 판단안 대상에 모두 포함)에 판단안 ID 를 채운다 (예: ② 재판정으로 자동 생성된 APR-004)
 */
export function recordAssessment(s: WorldState, draft: AssessmentDraft): WorkflowResult & { assessment: Assessment } {
  const tx = new Tx(s);
  const key = (a: { subjectType: string; subjectIds: string[] }) => `${a.subjectType}|${[...a.subjectIds].sort().join(',')}`;
  const version = tx.s.assessments.filter((a) => key(a) === key(draft)).length + 1;
  const assessment: Assessment = { ...draft, id: tx.nextId('ASM'), version };
  tx.s.assessments.push(assessment);
  tx.audit({
    entityType: 'ASSESSMENT',
    entityId: assessment.id,
    from: null,
    to: 'CREATED',
    actorRole: 'AI_AGENT',
    actorKind: assessment.aiMode === 'LIVE' ? 'AI' : 'MOCK',
    ruleIds: [...new Set(assessment.ruleResults.map((r) => r.ruleId))],
    reason: `판단안 v${version} (${assessment.subjectType}: ${assessment.subjectIds.join(', ')}) — 권고 ${assessment.recommendation.alternativeId}${assessment.fallbackReason ? ` · 모의 대체: ${assessment.fallbackReason}` : ''}`,
    snapshot: { aiMode: assessment.aiMode, model: assessment.model, subjectIds: assessment.subjectIds },
  });
  const ids = new Set(assessment.subjectIds);
  for (const a of tx.s.approvals) {
    if (a.status !== 'PENDING' || a.assessmentId !== null || a.subjectType !== assessment.subjectType) continue;
    if (!a.subjectIds.every((x) => ids.has(x))) continue;
    a.assessmentId = assessment.id;
    tx.audit({ entityType: 'APPROVAL_REQUEST', entityId: a.id, from: a.status, to: a.status, actorRole: 'SYSTEM', actorKind: 'SYSTEM', ruleIds: [], reason: `근거 판단안 ${assessment.id} 연결` });
  }
  return { ...tx.result(), assessment };
}

/**
 * 판단안 → 승인요청 (S-03/S-04 [승인 요청 만들기]). 권한자는 규칙 엔진이 정한다 (AI 아님).
 * - 계약: 판단안 권고 대안의 결정 (권고가 없으면 VALIDATION)
 * - 기안 건: 판단안의 규칙 권고(proposedDecisions)로 권한자별 묶음 (A-11)
 */
export function requestApprovalFromAssessment(s: WorldState, assessmentId: string): WorkflowResult {
  const a = s.assessments.find((x) => x.id === assessmentId);
  if (!a) throw new DomainError('NOT_FOUND', `판단안 없음: ${assessmentId}`);
  if (a.subjectType === 'CONTRACT') {
    const alt = a.alternatives.find((x) => x.id === a.recommendation.alternativeId);
    const decision = alt?.decision as ContractDecision | undefined;
    if (!decision || !['RENEW_SAME', 'RENEGOTIATE', 'TERMINATE'].includes(decision)) {
      throw new DomainError('VALIDATION', `${a.id}: 상신할 계약 결정이 없음 (권고 ${a.recommendation.alternativeId})`);
    }
    return requestContractApproval(s, { proposedDecision: decision, assessmentId: a.id });
  }
  if (a.subjectType === 'EXPANSION_LINES') {
    const proposed = Object.fromEntries((a.proposedDecisions ?? []).map((p) => [p.itemId, p.decision]));
    return requestLineApproval(s, { lineIds: a.subjectIds, proposed, assessmentId: a.id });
  }
  throw new DomainError('INVALID_TRANSITION', '보충요청 상신은 SCM 회신(추가 발주 필요)으로 만들어진다');
}

/** S1-6 / S3-3 상대방 수령확인 (E1). NOTICE_SENT → NOTICE_ACKNOWLEDGED → NEGOTIATING | TERMINATING */
export function recordNoticeReceipt(s: WorldState, input: { evidence: string }): EventResult {
  const tx = new Tx(s);
  const c = tx.s.contract;
  const notice = tx.s.notices.at(-1);
  if (c.status !== 'NOTICE_SENT' || !notice) throw new DomainError('INVALID_TRANSITION', `계약 상태 ${c.status} — 수령확인 기록 불가`);
  tx.emit('COUNTERPARTY_REPLY', { from: 'AGENCY', kind: 'NOTICE_RECEIPT', noticeId: notice.id, evidence: input.evidence }, 'MOCK', 'AGENCY');
  const receipt: NoticeReceipt = { id: tx.nextId('RCP'), noticeId: notice.id, receivedAt: tx.s.simNow, evidence: input.evidence, label: 'MOCK' };
  tx.s.receipts.push(receipt);
  tx.setContract('NOTICE_ACKNOWLEDGED', 'AGENCY', 'MOCK', ['R-EXT-01'], `수령확인 ${receipt.id}: ${input.evidence}`);
  tx.setContract(c.decision === 'TERMINATE' ? 'TERMINATING' : 'NEGOTIATING', 'SYSTEM', 'SYSTEM', ['R-EXT-01'], '수령확인 후 결정별 진행 — 자동 갱신 차단됨');
  for (const t of tx.s.tasks) {
    if ((t.type === 'CONFIRM_RECEIPT' || t.type === 'RENOTIFY') && OPEN_TASK.includes(t.status)) tx.setTask(t, 'DONE', 'CONTRACT_OFFICER', 'HUMAN', '수령확인됨', receipt.id);
  }
  return tx.eventResult();
}

export type { CounterpartyReplyInput };

/** S3-2 에이전시 정보 회신 — 열린 계약 INFO_REQUEST 작업을 결과와 함께 닫는다 (정보 제공 · 정보 부족 · 거절) */
export function recordCounterpartyReply(s: WorldState, input: CounterpartyReplyInput): EventResult {
  if (input.outcome === 'RECEIPT_CONFIRMED') return recordNoticeReceipt(s, { evidence: input.note });
  const tx = new Tx(s);
  tx.emit('COUNTERPARTY_REPLY', input, 'MOCK', input.from);
  const t = tx.s.tasks.find((x) => x.type === 'INFO_REQUEST' && x.subjectType === 'CONTRACT' && OPEN_TASK.includes(x.status));
  if (!t) throw new DomainError('NOT_FOUND', '열린 정보 요청 작업 없음');
  tx.setTask(t, 'DONE', input.from, 'MOCK', `${input.from} 회신 (${input.outcome})`, `${input.outcome}: ${input.note}`);
  if (input.outcome === 'INFO_PROVIDED') {
    // 정보 제공 — 성과 피 조건을 모의 회신 문구로 기록 (숫자 산식이 아니므로 권한 판정 금액은 계속 하한)
    tx.s.contract.performanceFeeTerms = input.note;
    tx.audit({ entityType: 'CONTRACT', entityId: tx.s.contract.id, from: tx.s.contract.status, to: tx.s.contract.status, actorRole: input.from, actorKind: 'MOCK', ruleIds: ['R-AUTH-02'], reason: `성과 피 조건 회신 (모의): ${input.note}` });
  }
  return tx.eventResult();
}

/**
 * S-02 외부 회신 단일 입구 — 상대(에이전시 · SCM · Corevia) × 결과(수령확인 · 정보 제공 · 정보 부족 · 거절).
 * 상대별로 맞는 업무 함수로 보낸다. 맞지 않는 조합은 VALIDATION(422).
 */
export function counterpartyReply(s: WorldState, ds: MasilDataset, input: CounterpartyReplyInput): EventResult {
  if (input.from === 'AGENCY') {
    if (input.outcome === 'RECEIPT_CONFIRMED') return recordNoticeReceipt(s, { evidence: input.note });
    return recordCounterpartyReply(s, input);
  }
  if (input.outcome === 'RECEIPT_CONFIRMED') throw new DomainError('VALIDATION', `${input.from} 회신에는 수령확인이 없음 (통보 수령확인은 에이전시)`);
  if (input.from === 'SCM') return scmReview(s, ds, { ...input, from: 'SCM' });
  return coreviaReply(s, input);
}

/** Corevia(공급사) 회신 — SCM 이 연 정보 요청(입고일 등)을 닫고 입고 예정일을 연결 건에 기록 */
function coreviaReply(s: WorldState, input: CounterpartyReplyInput): EventResult {
  const tx = new Tx(s);
  tx.emit('COUNTERPARTY_REPLY', input, 'MOCK', 'COREVIA');
  const t = tx.s.tasks.find((x) => x.type === 'INFO_REQUEST' && x.ownerRole === 'SCM' && OPEN_TASK.includes(x.status));
  if (!t) throw new DomainError('NOT_FOUND', '열린 SCM 정보 요청 작업 없음');
  tx.setTask(t, 'DONE', 'COREVIA', 'MOCK', `Corevia 회신 (${input.outcome})`, `${input.outcome}: ${input.note}`);
  if (input.outcome === 'INFO_PROVIDED' && input.inboundExpectedDate && t.subjectType === 'EXPANSION_LINE') {
    const l = findLine(tx.s, t.subjectId);
    l.inboundExpectedDate = input.inboundExpectedDate;
    tx.audit({ entityType: 'EXPANSION_LINE', entityId: l.id, from: l.status, to: l.status, actorRole: 'COREVIA', actorKind: 'MOCK', ruleIds: ['R-INV-03'], reason: `입고 예정 ${input.inboundExpectedDate} (Corevia 모의 회신)` });
  }
  return tx.eventResult();
}

/** 원본 공백 중 현재 상태에서 아직 열린 것 (ONTOLOGY 6절) */
export function openGaps(s: WorldState): string[] {
  const g: string[] = ['G-01'];
  if (s.contract.performanceFeeTerms === null) g.push('G-02');
  if (s.receipts.length === 0) g.push('G-03');
  g.push('G-04');
  if (s.replenishments.length === 0 || s.lines.some((l) => l.supplyOutlook === 'UNKNOWN' && l.flags.includes('INVENTORY_BELOW_MIN'))) g.push('G-08');
  if (s.contract.feePaymentSchedule === null) g.push('G-09');
  return g;
}

// ───────────────────────── 조건 변경 · 권한 재판정 (R-AUTH-06) ─────────────────────────

const APPROVED_LIKE: LineStatus[] = ['APPROVED', 'CONDITIONALLY_APPROVED'];
const CLOSED_CONFIRMED: LineStatus[] = ['CONFIRMED', 'AUTO_CONFIRMED'];

/** 권한 재판정 계획 (순수). 상향 · 하향 · 기한 전/후에 따라 처리 방식을 정한다 */
export function rerouteAll(lines: readonly ExpansionLine[], next: (l: ExpansionLine) => Routing, simNow: IsoDateTime): (RoutingChange & { routing: Routing })[] {
  const out: (RoutingChange & { routing: Routing })[] = [];
  for (const l of lines) {
    if (!l.routing) continue;
    const routing = next(l);
    const from = l.routing.requiredRole;
    const to = routing.requiredRole;
    const ruleId: RuleId = routing.reasons[0]?.ruleId ?? 'R-AUTH-06';
    if (from === to) {
      out.push({ lineId: l.id, from, to, ruleId, action: 'ROUTING_UPDATED', routing });
      continue;
    }
    const up = roleRank(to) > roleRank(from);
    const approver = l.approvedByRole ?? null;
    const past = isPastDeadline(simNow, l.contractDeadline);
    let action: RoutingAction = 'ROUTING_UPDATED';
    if (up) {
      const lowerApproval = approver === null || roleRank(approver) < roleRank(to);
      if (APPROVED_LIKE.includes(l.status) && lowerApproval) action = past ? 'POST_DEADLINE_REPORT' : 'REAPPROVAL_REQUIRED';
      else if (CLOSED_CONFIRMED.includes(l.status) && lowerApproval) action = 'POST_DEADLINE_REPORT';
      else if (l.status === 'PENDING_APPROVAL') action = 'RESUBMIT_PENDING';
    } else if (approver !== null && roleRank(approver) >= roleRank(to)) {
      action = 'KEEP_HIGHER_APPROVAL';
    }
    out.push({ lineId: l.id, from, to, ruleId, action, routing });
  }
  return out;
}

function applyReroute(tx: Tx, ds: MasilDataset, only?: Set<string>): void {
  const s = tx.s;
  const plan = rerouteAll(
    s.lines.filter((l) => !only || only.has(l.id)),
    (l) => routeLine(s, l),
    s.simNow,
  );
  const reapprove: { line: ExpansionLine; prevRequestId: string | null; decision: string }[] = [];
  const resubmitRequests = new Set<string>();
  for (const p of plan) {
    const l = findLine(s, p.lineId);
    l.routing = p.routing;
    l.flags = lineFlags(s, ds, l);
    if (p.from === p.to) continue;
    tx.routingChanges.push({ lineId: p.lineId, from: p.from, to: p.to, ruleId: p.ruleId, action: p.action });
    tx.audit({
      entityType: 'EXPANSION_LINE',
      entityId: l.id,
      from: l.status,
      to: l.status,
      actorRole: 'SYSTEM',
      actorKind: 'SYSTEM',
      ruleIds: ['R-AUTH-06', p.ruleId],
      reason: `권한 재판정 ${p.from} → ${p.to} [재전망 ${s.forecast.id}] (${p.action})`,
      snapshot: { from: p.from, to: p.to, forecastRunId: s.forecast.id },
    });
    if (p.action === 'REAPPROVAL_REQUIRED') {
      const decision = l.status === 'CONDITIONALLY_APPROVED' ? 'CONDITIONAL' : 'APPROVE';
      const prevApprover = l.approvedByRole;
      tx.setLine(l, 'REAPPROVAL_REQUIRED', 'SYSTEM', 'SYSTEM', ['R-AUTH-06', 'R-AUTH-03'], `권한자 상향 ${p.from} → ${p.to}: ${prevApprover ?? '-'} 의 승인(${l.approvalRequestId ?? '-'}) 효력 상실`);
      l.approvedByRole = null;
      reapprove.push({ line: l, prevRequestId: l.approvalRequestId ?? null, decision });
    } else if (p.action === 'POST_DEADLINE_REPORT') {
      tx.addTask(
        { type: 'POST_DEADLINE_REPORT', subjectType: 'EXPANSION_LINE', subjectId: l.id, ownerRole: p.to, dueAt: deadlineAt(addDays(kstDate(s.simNow), 7)), instruction: `기한 경과 확정 건의 권한자 상향(${p.from} → ${p.to}) — 되돌릴 수 없어 사후 보고` },
        ['R-AUTH-06', 'R-DL-01'],
      );
    } else if (p.action === 'RESUBMIT_PENDING' && l.approvalRequestId) {
      resubmitRequests.add(l.approvalRequestId);
    }
  }
  for (const r of reapprove) {
    const prevVersion = r.prevRequestId ? (s.approvals.find((a) => a.id === r.prevRequestId)?.version ?? 0) : 0;
    createLineRequests(tx, [r.line], { [r.line.id]: r.decision }, { supersedesId: r.prevRequestId, version: prevVersion + 1 });
  }
  for (const reqId of resubmitRequests) {
    const old = findApproval(s, reqId);
    if (old.status !== 'PENDING') continue;
    tx.setApproval(old, 'SUPERSEDED', 'SYSTEM', 'SYSTEM', ['R-AUTH-06'], '권한 재판정으로 대체');
    const lines = old.subjectIds.map((id) => findLine(s, id)).filter((l) => l.status === 'PENDING_APPROVAL' && l.approvalRequestId === old.id);
    const proposed = Object.fromEntries(old.proposed.map((p) => [p.itemId, p.decision]));
    createLineRequests(tx, lines, proposed, { supersedesId: old.id, version: old.version + 1, assessmentId: old.assessmentId, keepPending: true });
  }
}

/** ② 조건 변경: AR 회수 지연 (MOCK) → 재전망 v(n+1) → 모든 건 권한 재판정 */
export function arCollectionDelayed(s: WorldState, ds: MasilDataset, input: { arId: string; newDueDate: IsoDate }): EventResult {
  if (!ds.ar.some((a) => a.id === input.arId)) throw new DomainError('NOT_FOUND', `AR 없음: ${input.arId}`);
  const tx = new Tx(s);
  tx.emit('AR_COLLECTION_DELAYED', input, 'MOCK', 'FINANCE');
  tx.s.arDueOverrides[input.arId] = input.newDueDate;
  const n = (tx.s.seq.CF ?? 1) + 1;
  tx.s.seq.CF = n;
  const prev = tx.s.forecast;
  tx.s.forecast = simulateCash(ds, { id: `CF-v${n}`, arDueOverrides: { ...tx.s.arDueOverrides }, inputsVersion: [tx.event!.id], createdAt: tx.s.simNow });
  tx.audit({
    entityType: 'CASH_FORECAST',
    entityId: tx.s.forecast.id,
    from: prev.id,
    to: tx.s.forecast.id,
    actorRole: 'SYSTEM',
    actorKind: 'SYSTEM',
    ruleIds: ['R-CASH-01', 'R-CASH-03'],
    reason: `재전망: 하회 구간 ${fmtWindows(prev.breachWindows)} → ${fmtWindows(tx.s.forecast.breachWindows)}`,
    snapshot: { breachWindows: tx.s.forecast.breachWindows, minClosing: tx.s.forecast.minClosing },
  });
  applyReroute(tx, ds);
  applyReplenishmentReroute(tx);
  return tx.eventResult();
}

/**
 * BE-09 (선택) 보충요청 권한 재판정 — 재전망 뒤 지급일이 새 하회 구간에 들어가면 R-AUTH-04 → R-AUTH-03 상향.
 * 대기(PENDING) 승인요청은 SUPERSEDED + 새 권한자에게 재상신(version + 1). 하향이면 기존 상위 권한자 요청을 유지한다(R-AUTH-06).
 * 초안(DRAFT)은 권한자 표시만 갱신한다.
 */
function applyReplenishmentReroute(tx: Tx): void {
  const s = tx.s;
  for (const r of s.replenishments) {
    if (r.status !== 'DRAFT') continue;
    const to = routeReplenishment({ expectedPaymentDate: r.expectedPaymentDate }, s.forecast.breachWindows, s.forecast.id).requiredRole;
    if (to === r.requiredRole) continue;
    tx.audit({ entityType: 'REPLENISHMENT', entityId: r.id, from: r.status, to: r.status, actorRole: 'SYSTEM', actorKind: 'SYSTEM', ruleIds: ['R-AUTH-06', 'R-AUTH-04'], reason: `권한 재판정 ${r.requiredRole} → ${to} [재전망 ${s.forecast.id}]` });
    r.requiredRole = to;
  }
  for (const old of s.approvals.filter((a) => a.subjectType === 'REPLENISHMENT' && a.status === 'PENDING')) {
    const reqs = old.subjectIds.map((id) => s.replenishments.find((x) => x.id === id)).filter((x): x is ReplenishmentRequest => !!x);
    if (reqs.length === 0) continue;
    const routing = routeReplenishment({ expectedPaymentDate: reqs[0]!.expectedPaymentDate }, s.forecast.breachWindows, s.forecast.id);
    if (roleRank(routing.requiredRole) <= roleRank(old.requiredRole)) continue;
    tx.setApproval(old, 'SUPERSEDED', 'SYSTEM', 'SYSTEM', ['R-AUTH-06'], `권한 재판정 ${old.requiredRole} → ${routing.requiredRole} [재전망 ${s.forecast.id}]`);
    const neu = tx.addApproval({ ...old, requiredRole: routing.requiredRole, routingReasons: routing.reasons, version: old.version + 1, supersedesId: old.id });
    for (const r of reqs) {
      r.requiredRole = routing.requiredRole;
      tx.audit({ entityType: 'REPLENISHMENT', entityId: r.id, from: r.status, to: r.status, actorRole: 'SYSTEM', actorKind: 'SYSTEM', ruleIds: ['R-AUTH-06', 'R-AUTH-03'], reason: `${old.id} 대체 → ${neu.id} 재상신 (${routing.requiredRole})` });
    }
  }
}

const fmtWindows = (w: { start: string; end: string }[]) => (w.length ? w.map((x) => `${x.start}~${x.end}`).join(', ') : '없음');

function applyLineTerms(tx: Tx, ds: MasilDataset, input: { lineId: string; settlementDate?: IsoDate; requestedKrw?: number }): void {
  if (input.settlementDate === undefined && input.requestedKrw === undefined) {
    throw new DomainError('INFO_MISSING', `${input.lineId}: 바꿀 값(집행일 · 요청액)이 없음`);
  }
  const l = findLine(tx.s, input.lineId);
  const before = { settlementDate: l.settlementDate, requestedKrw: l.requestedKrw as number };
  if (input.settlementDate !== undefined) l.settlementDate = input.settlementDate;
  if (input.requestedKrw !== undefined) {
    l.requestedKrw = krw('SAMPLE', input.requestedKrw);
    if (tx.s.proposal) tx.s.proposal.totalRequestedKrw = krw('SAMPLE', tx.s.lines.reduce((a, x) => a + x.requestedKrw, 0));
  }
  tx.audit({
    entityType: 'EXPANSION_LINE',
    entityId: l.id,
    from: l.status,
    to: l.status,
    actorRole: 'MARKETING_TEAM',
    actorKind: 'MOCK',
    ruleIds: ['R-AUTH-06'],
    reason: `기안 조건 변경 ${JSON.stringify(before)} → ${JSON.stringify({ settlementDate: l.settlementDate, requestedKrw: l.requestedKrw })}`,
  });
  applyReroute(tx, ds, input.requestedKrw !== undefined ? undefined : new Set([l.id]));
}

/** 조건 변경: 기안 금액/집행일 정정 (MOCK) → 해당 건 권한 재판정 (요청액이 바뀌면 총액이 바뀌므로 전 건) */
export function changeLineTerms(s: WorldState, ds: MasilDataset, input: { lineId: string; settlementDate?: IsoDate; requestedKrw?: number }): EventResult {
  if (input.settlementDate === undefined && input.requestedKrw === undefined) {
    throw new DomainError('INFO_MISSING', `${input.lineId}: 바꿀 값(집행일 · 요청액)이 없음`);
  }
  const tx = new Tx(s);
  tx.emit('LINE_TERMS_CHANGED', input, 'MOCK', 'MARKETING_TEAM');
  applyLineTerms(tx, ds, input);
  return tx.eventResult();
}

// ───────────────────────── ④ 재고 보충 (R-INV-04 · R-AUTH-04) ─────────────────────────

const G08 = '기발주 SPO 가 in_transit_qty 에 포함됐는가? in_transit 입고일은? (G-08)';

/** 보충요청 초안 — 주력 SKU 중 안전재고 min 미달 SKU 만. 지급일 = 오늘 + 25일 (A-19) */
export function draftReplenishment(s: WorldState, ds: MasilDataset, input: { triggerLineId: string; skuIds?: string[] }): WorkflowResult {
  const tx = new Tx(s);
  const l = findLine(tx.s, input.triggerLineId);
  const today = kstDate(tx.s.simNow);
  const pay = expectedPaymentDate(today);
  const all = replenishmentSuggestionsForLine(ds, l.campaignId);
  if (all.length === 0) throw new DomainError('VALIDATION', `${l.id}: 안전재고 min 미달 주력 SKU 가 없어 보충 제안 대상이 아님 (R-INV-04)`);
  const unknownSku = (input.skuIds ?? []).filter((k) => !all.some((x) => x.skuId === k));
  if (unknownSku.length) throw new DomainError('VALIDATION', `보충 제안 대상이 아닌 SKU: ${unknownSku.join(', ')} (min 미달 주력 SKU 만)`);
  if (tx.s.replenishments.some((r) => r.triggerLineId === l.id && r.status === 'DRAFT')) throw new DomainError('INVALID_TRANSITION', `${l.id}: 검토 중인 보충요청 초안이 이미 있음`);
  const suggestions = input.skuIds?.length ? all.filter((x) => input.skuIds!.includes(x.skuId)) : all;
  for (const sg of suggestions) {
    const routing = routeReplenishment({ expectedPaymentDate: pay }, tx.s.forecast.breachWindows, tx.s.forecast.id);
    const r: ReplenishmentRequest = {
      id: tx.nextId('RPL'),
      skuId: sg.skuId,
      triggerLineId: l.id,
      avg4wDemand: sg.avg4wDemand,
      coverWeeks: sg.coverWeeks ?? 0,
      targetQty: sg.targetQty,
      suggestedQty: sg.suggestedQty,
      finalQty: sg.finalQty,
      unitCostKrw: sg.unitCostKrw,
      amountKrw: sg.amountKrw,
      neededBy: l.settlementDate,
      expectedPaymentDate: pay,
      requiredRole: routing.requiredRole,
      status: 'DRAFT',
      openQuestions: [G08],
    };
    tx.s.replenishments.push(r);
    tx.audit({ entityType: 'REPLENISHMENT', entityId: r.id, from: null, to: 'DRAFT', actorRole: 'SYSTEM', actorKind: 'SYSTEM', ruleIds: ['R-INV-04', routing.reasons[0]!.ruleId], reason: `보충 제안 ${sg.skuId} ${sg.finalQty}EA → 권한자 ${routing.requiredRole}` });
  }
  l.supplyOutlook = 'UNKNOWN';
  // A-27: 정보 요청 · 보충 검토 기한 = min(생성일 + 3일, 확정기한 − 2일)
  const due = deadlineAt(minDate(addDays(today, 3), addDays(l.contractDeadline, -2)));
  tx.addTask({ type: 'REPLENISHMENT_REVIEW', subjectType: 'EXPANSION_LINE', subjectId: l.id, ownerRole: 'SCM', dueAt: due, instruction: `보충 제안 검토: ${suggestions.map((x) => `${x.skuId} ${x.finalQty}`).join(', ')}` }, ['R-INV-04']);
  tx.addTask({ type: 'INFO_REQUEST', subjectType: 'EXPANSION_LINE', subjectId: l.id, ownerRole: 'SCM', dueAt: due, instruction: G08 }, ['R-INV-02']);
  return tx.result();
}

/** ④ SCM 회신 — S-02 외부 회신 양식(CounterpartyReplyInput)에서 from = 'SCM' */
export type ScmReviewInput = CounterpartyReplyInput & { from: 'SCM' };

/**
 * ④ SCM 회신 (MOCK)
 *  - 정보 제공 + 추가 발주 불필요(replenishmentNeeded=false) → 보충 REJECTED · 공급 전망 INBOUND_CONFIRMED (+입고 예정일)
 *  - 정보 제공 + 추가 발주 필요(true) → SUBMITTED + 승인요청(SCM 또는 covenant 구간이면 GCB)
 *  - 정보 부족 → 초안 유지, 정보 요청 작업만 결과와 함께 닫음 (G-08 미해결)
 *  - 거절(보충 불가) → 보충 REJECTED · 공급 전망 NO_SUPPLY → 연결 건 권고가 부결로 바뀜
 */
export function scmReview(s: WorldState, ds: MasilDataset, input: ScmReviewInput): EventResult {
  if (input.outcome === 'RECEIPT_CONFIRMED') throw new DomainError('VALIDATION', 'SCM 회신에는 수령확인이 없음');
  if (input.outcome === 'INFO_PROVIDED' && input.replenishmentNeeded === undefined) {
    throw new DomainError('VALIDATION', 'SCM 정보 제공 회신에는 추가 발주 필요 여부(replenishmentNeeded)가 필요');
  }
  const tx = new Tx(s);
  tx.emit('COUNTERPARTY_REPLY', input, 'MOCK', 'SCM');
  const drafts = tx.s.replenishments.filter((r) => r.status === 'DRAFT');
  if (drafts.length === 0) throw new DomainError('NOT_FOUND', '검토할 보충요청 초안 없음');
  const closeTypes: Task['type'][] = input.outcome === 'INSUFFICIENT' ? ['INFO_REQUEST'] : ['REPLENISHMENT_REVIEW', 'INFO_REQUEST'];
  for (const t of tx.s.tasks) {
    if (t.ownerRole === 'SCM' && closeTypes.includes(t.type) && OPEN_TASK.includes(t.status)) tx.setTask(t, 'DONE', 'SCM', 'MOCK', `SCM 회신 (${input.outcome})`, `${input.outcome}: ${input.note}`);
  }
  const lineIds = [...new Set(drafts.map((r) => r.triggerLineId).filter((x): x is string => !!x))];
  if (input.outcome === 'INSUFFICIENT') return tx.eventResult();
  if (input.outcome === 'REJECTED') {
    for (const r of drafts) {
      tx.setReplenishment(r, 'REJECTED', 'SCM', 'MOCK', ['R-INV-04'], `보충 불가: ${input.note}`);
      r.closedBy = 'SCM_NO_SUPPLY';
    }
    for (const id of lineIds) {
      const l = findLine(tx.s, id);
      l.supplyOutlook = 'NO_SUPPLY';
      tx.audit({ entityType: 'EXPANSION_LINE', entityId: l.id, from: l.status, to: l.status, actorRole: 'SCM', actorKind: 'MOCK', ruleIds: ['R-INV-03'], reason: 'SCM 보충 불가 → 공급 전망 NO_SUPPLY (다음 권고에 반영)' });
    }
    return tx.eventResult();
  }
  if (input.replenishmentNeeded === false) {
    for (const r of drafts) {
      tx.setReplenishment(r, 'REJECTED', 'SCM', 'MOCK', ['R-INV-04'], `불필요: ${input.note}`);
      r.closedBy = 'SCM_NOT_NEEDED';
    }
    for (const id of lineIds) {
      const l = findLine(tx.s, id);
      l.supplyOutlook = 'INBOUND_CONFIRMED';
      l.inboundExpectedDate = input.inboundExpectedDate ?? null;
      tx.audit({ entityType: 'EXPANSION_LINE', entityId: l.id, from: l.status, to: l.status, actorRole: 'SCM', actorKind: 'MOCK', ruleIds: ['R-INV-03'], reason: `공급 전망 INBOUND_CONFIRMED${l.inboundExpectedDate ? ` · 입고 ${l.inboundExpectedDate}` : ''} (다음 권고에 반영)` });
    }
    return tx.eventResult();
  }
  for (const r of drafts) tx.setReplenishment(r, 'SUBMITTED', 'SCM', 'MOCK', ['R-INV-04'], `추가 발주 필요: ${input.note}`);
  const routing = routeReplenishment({ expectedPaymentDate: drafts[0]!.expectedPaymentDate }, tx.s.forecast.breachWindows, tx.s.forecast.id);
  const trigger = lineIds[0] ? findLine(tx.s, lineIds[0]) : null;
  const hard = trigger?.contractDeadline ?? drafts[0]!.neededBy;
  tx.addApproval({
    subjectType: 'REPLENISHMENT',
    subjectIds: drafts.map((r) => r.id),
    requiredRole: routing.requiredRole,
    alsoReportTo: [],
    routingReasons: routing.reasons,
    assessmentId: null,
    proposed: drafts.map((r) => ({ itemId: r.id, decision: 'APPROVE' })),
    internalDueAt: internalDueAt('LINE_APPROVAL', hard),
    hardDeadline: hard,
    version: 1,
    supersedesId: null,
  });
  void ds;
  return tx.eventResult();
}

// ───────────────────────── 기한 감시 (ONTOLOGY 3-6) ─────────────────────────

/**
 * 시점 이동. 순서: ① 작업 OVERDUE ② 수령확인 재통보(E1) ③ 기안 건 기한 ④ 계약 기한 ⑤ 승인요청 EXPIRED. 모두 SYSTEM 이력.
 * 시점을 되돌리는 이동은 허용하지 않는다.
 */
export function advanceClock(s: WorldState, to: IsoDateTime): EventResult {
  if (toMs(to) < toMs(s.simNow)) throw new DomainError('CLOCK_BACKWARD', `시점은 앞으로만 이동: ${s.simNow} → ${to}`);
  const tx = new Tx(s);
  const from = tx.s.simNow;
  tx.s.simNow = to;
  tx.emit('CLOCK_ADVANCED', { from, to }, 'MOCK', 'SYSTEM');
  const st = tx.s;
  const c = st.contract;

  // ① 작업 OVERDUE
  for (const t of st.tasks) if ((t.status === 'OPEN' || t.status === 'IN_PROGRESS') && isAfter(to, t.dueAt)) tx.setTask(t, 'OVERDUE', 'SYSTEM', 'SYSTEM', `기한 ${t.dueAt} 경과`);

  // ② 재통보 (R-EXT-01): 수령 미확인 + [발송 후 2영업일 | 기한 당일 09:00] 중 먼저
  const notice = st.notices.at(-1);
  if (c.status === 'NOTICE_SENT' && notice && !st.receipts.some((r) => r.noticeId === notice.id)) {
    const twoBd = kst(addBusinessDays(kstDate(notice.sentAt), 2), notice.sentAt.slice(11, 19));
    const dayOf = kst(c.noticeDeadline, '09:00:00');
    const trigger = toMs(twoBd) < toMs(dayOf) ? twoBd : dayOf;
    const exists = st.tasks.some((t) => t.type === 'RENOTIFY' && t.subjectId === c.id);
    if (!exists && isOnOrAfter(to, trigger)) {
      tx.addTask({ type: 'RENOTIFY', subjectType: 'CONTRACT', subjectId: c.id, ownerRole: 'CONTRACT_OFFICER', dueAt: deadlineAt(c.noticeDeadline), instruction: `${notice.id} 수령 미확인 — 재통보` }, ['R-EXT-01']);
    }
  }

  // ③ 기안 건 기한 (R-DL-01)
  for (const l of st.lines) {
    if (!isPastDeadline(to, l.contractDeadline)) continue;
    if (APPROVED_LIKE.includes(l.status)) tx.setLine(l, 'CONFIRMED', 'SYSTEM', 'SYSTEM', ['R-DL-01'], `확정기한 ${l.contractDeadline} 도래 — 승인 건 확정`);
    else if (l.status === 'REJECTED') tx.setLine(l, 'CANCELLED', 'SYSTEM', 'SYSTEM', ['R-DL-01'], `확정기한 ${l.contractDeadline} 도래 — 부결 건 취소`);
    else if (LINE_OPEN.includes(l.status)) {
      tx.setLine(l, 'AUTO_CONFIRMED', 'SYSTEM', 'SYSTEM', ['R-DL-01'], `미결로 확정기한 ${l.contractDeadline} 경과 — 자동 확정(묵시적 승인, 철회 불가)`);
      tx.addTask(
        { type: 'POST_DEADLINE_REPORT', subjectType: 'EXPANSION_LINE', subjectId: l.id, ownerRole: l.routing?.requiredRole ?? 'MASIL_CEO', dueAt: deadlineAt(addDays(l.contractDeadline, 7)), instruction: '기한 경과 자동 확정 건 사후 보고' },
        ['R-DL-01'],
      );
    }
  }

  // ④ 계약 기한 (R-DL-02 · R-EXT-01)
  if (isPastDeadline(to, c.noticeDeadline)) {
    const due = deadlineAt(addDays(c.noticeDeadline, 7));
    if (AUTO_RENEW_FROM.includes(c.status)) {
      tx.setContract('AUTO_RENEWED', 'SYSTEM', 'SYSTEM', ['R-DL-02', 'R-AUTH-02'], `통보 기한 ${c.noticeDeadline} 경과 · 유효 통보 없음 → 미통보 자동 갱신 = 권한 미경유 체결 (정책)`);
      tx.addTask({ type: 'INCIDENT_AUTO_RENEWAL', subjectType: 'CONTRACT', subjectId: c.id, ownerRole: 'GROUP_CEO_BOARD', dueAt: due, instruction: '권한 미경유 체결 사고 기록 · 후속 대응 (해지는 위약금 R-PEN-01 이 붙는 새 결정)' }, ['R-DL-02']);
    } else if (c.status === 'NOTICE_SENT') {
      tx.setContract('NOTICE_UNCONFIRMED', 'SYSTEM', 'SYSTEM', ['R-EXT-01'], '기한까지 수령 미확인 — 통보 효력 미확인 (자동 갱신 · 통보 완료 어느 쪽으로도 처리하지 않음, A-14)');
      for (const owner of ['GROUP_CEO_BOARD', 'CONTRACT_OFFICER'] as const) {
        tx.addTask({ type: 'ESCALATE_NOTICE_UNCONFIRMED', subjectType: 'CONTRACT', subjectId: c.id, ownerRole: owner, dueAt: due, instruction: '통보 수령 미확인 에스컬레이션 — 자동 갱신 · 통보 완료 어느 쪽으로도 처리하지 않음 (A-14)' }, ['R-EXT-01']);
      }
    }
  }

  // ⑤ 승인요청 EXPIRED
  for (const a of st.approvals) if (a.status === 'PENDING' && isPastDeadline(to, a.hardDeadline)) tx.setApproval(a, 'EXPIRED', 'SYSTEM', 'SYSTEM', ['R-DL-01'], `원본 기한 ${a.hardDeadline} 경과 · 미회신`);

  return tx.eventResult();
}

// ───────────────────────── 다음 판단의 입력 (조회) ─────────────────────────

export function deadlineView(s: WorldState): { contract: { deadline: IsoDate; daysLeft: number; level: DeadlineLevel } } {
  return { contract: { deadline: s.contract.noticeDeadline, daysLeft: daysLeft(s.simNow, s.contract.noticeDeadline), level: deadlineLevel(s.simNow, s.contract.noticeDeadline) } };
}

/** 계약 상태가 다음 판단에 주는 결과 — 갱신(자동 · 승인)이면 1년 고정 피 확정 · 해지 시 위약금 (FULL) */
export function contractConsequences(s: WorldState, terminateOn?: IsoDate): { renewed: boolean; committedTermKrw: number | null; renewalTerm: { start: IsoDate; end: IsoDate }; penaltyKrw: number | null } {
  const c = s.contract;
  const renewed = c.status === 'AUTO_RENEWED' || c.status === 'RENEWED_APPROVED';
  const term = renewalTerm(c);
  return {
    renewed,
    committedTermKrw: renewed ? c.fixedFeeAnnualKrw : null,
    renewalTerm: term,
    penaltyKrw: terminateOn === undefined ? null : renewed ? penalty(c, terminateOn).amountKrw : 0,
  };
}

/** 계약 결정 대상 subjectType 목록 (API 편의) */
export const SUBJECT_TYPES: SubjectType[] = ['CONTRACT', 'EXPANSION_LINES', 'REPLENISHMENT'];
