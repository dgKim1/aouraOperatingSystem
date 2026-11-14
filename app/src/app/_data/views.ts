/**
 * 화면 데이터 경계 (1단계). 화면(page.tsx)은 이 파일의 함수만 호출한다.
 *
 * 각 함수는 SCREEN_SPEC 4절의 API 하나에 대응한다 (함수 위 주석). 2단계에서는 몸통을
 * `fetch('/api/…')` 로 바꾸고 반환 타입(_data/types.ts)은 유지한다.
 *
 * 원칙: 숫자 · 판정은 백엔드 도메인 함수(src/domain)의 결과만 쓴다. 여기서 하는 일은
 *   ① 도메인 결과를 응답 모양으로 옮기고 ② 출처 라벨 · 스케일을 붙이고 ③ 표시용 묶음(필터 · 정렬 · 그룹 합계)을 만드는 것.
 *   ③ 중 "그룹 합계 · 경고 목록 구성"은 원래 API 가 할 일이라 2단계에서 백엔드로 옮긴다 (보고서에 요청으로 적음).
 */
import 'server-only';
import { cookies } from 'next/headers';
import { routeReplenishment } from '@/domain/authority';
import { simulateCash, type CashSimResult } from '@/domain/cash';
import { kstDate } from '@/domain/dates';
import { daysLeft, deadlineLevel, decisionNeededBy, internalDueAt } from '@/domain/deadline';
import { expectedArrivalDate, expectedPaymentDate, inventoryGate, replenishmentSuggestionsForLine, skuCoverTable } from '@/domain/inventory';
import { MOCK_REPLY_DATASET } from '@/domain/mockReplies';
import { penalty } from '@/domain/penalty';
import { computePerformance, influencerShares, rankBy, requestShareRemaining, totalPerformance } from '@/domain/performance';
import { CONTRACT_REFS } from '@/domain/seed';
import type {
  ActorRole,
  ApprovalRequest,
  ApproverRole,
  Assessment,
  AuditLogEntry,
  CampaignPerformance,
  ExpansionLine,
  LineFlag,
  RuleId,
  Sourced,
  SourceLabel,
  SourceRef,
} from '@/domain/types';
import { ROLE_KO } from '@/domain/types';
import * as wf from '@/domain/workflow';
import { MASIL_FILES } from '@/server/raw/loader';
import { CONTRACT_STATUS_KO, LINE_STATUS_KO, TASK_TYPE_KO, decisionText } from '@/components/labels';
import { ASSUMPTIONS, CLAIMS, GAPS, INCONSISTENCIES } from './registry';
import type {
  AlertView,
  ApprovalItemView,
  ApprovalView,
  ContractSummary,
  ContractView,
  CostStep,
  CovenantWindowView,
  DeadlineGroup,
  InfluencerPerfRow,
  LineView,
  MetaView,
  Money,
  Num,
  OverviewView,
  PendingApprovalCard,
  ProposalView,
  ReferenceFlagView,
  RegistryView,
  Severity,
  TaskView,
  TimelineItem,
  Txt,
} from './types';
import { DEFAULT_PRESET, PRESETS, dataset, isPresetId, rawTables, worldFor, type PresetId } from './world';

// ───────────────────────── 시연 세션 (역할 · 프리셋) ─────────────────────────

export const ROLE_COOKIE = 'aoura-role';
export const PRESET_COOKIE = 'aoura-preset';

export interface DemoRole {
  id: string;
  actorRole: ActorRole;
  label: string;
  mock: boolean;
}

/** SCREEN_SPEC 0-1 역할 전환 목록 */
export const DEMO_ROLES: DemoRole[] = [
  { id: 'MARKETING_TEAM', actorRole: 'MARKETING_TEAM', label: '마케팅팀', mock: false },
  { id: 'MASIL_CEO', actorRole: 'MASIL_CEO', label: 'Masil 대표', mock: false },
  { id: 'GROUP_CEO_BOARD', actorRole: 'GROUP_CEO_BOARD', label: '그룹 CEO/이사회', mock: false },
  { id: 'SCM', actorRole: 'SCM', label: 'SCM', mock: false },
  { id: 'CONTRACT_OFFICER', actorRole: 'CONTRACT_OFFICER', label: '계약 담당', mock: false },
  { id: 'AGENCY', actorRole: 'AGENCY', label: '에이전시(모의)', mock: true },
  { id: 'SCM_REPLY', actorRole: 'SCM', label: 'SCM 회신(모의)', mock: true },
];

export async function getSession(): Promise<{ role: DemoRole; presetId: PresetId }> {
  const c = await cookies();
  const roleId = c.get(ROLE_COOKIE)?.value;
  const role = DEMO_ROLES.find((r) => r.id === roleId) ?? DEMO_ROLES[0]!;
  const p = c.get(PRESET_COOKIE)?.value;
  return { role, presetId: isPresetId(p) ? p : DEFAULT_PRESET };
}

async function world(): Promise<wf.WorldState> {
  return worldFor((await getSession()).presetId);
}

// ───────────────────────── 출처 도우미 ─────────────────────────

const F = MASIL_FILES;
const POLICY = '00_common/approval_authority_policy.md';
const CALC = '00_common/calculation_definitions.md';
const COVENANT = '02_masil/financials/covenant_terms_ms.md';
const PERF_REFS: SourceRef[] = [{ file: F.orders }, { file: F.returns }, { file: F.adSpend }, { file: F.costMaster }];
const PERF_ASSUMPTIONS = ['A-01', 'A-02', 'A-03', 'A-04', 'A-05', 'A-06'];

function money<S extends 'FULL' | 'SAMPLE'>(scale: S, value: number, label: SourceLabel, refs: SourceRef[], method?: string, assumptionIds?: string[]): Money<S> {
  return { value, label, refs, scale, ...(method ? { method } : {}), ...(assumptionIds?.length ? { assumptionIds } : {}) };
}
function num(value: number, label: SourceLabel, refs: SourceRef[], method?: string, assumptionIds?: string[]): Num {
  return { value, label, refs, scale: 'NONE', ...(method ? { method } : {}), ...(assumptionIds?.length ? { assumptionIds } : {}) };
}
function txt(value: string, label: SourceLabel, refs: SourceRef[], method?: string, assumptionIds?: string[]): Txt {
  return { value, label, refs, scale: 'NONE', ...(method ? { method } : {}), ...(assumptionIds?.length ? { assumptionIds } : {}) };
}

const roleKo = (r: ActorRole) => ROLE_KO[r];
const fmt = (n: number) => n.toLocaleString('ko-KR');
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

// ───────────────────────── 캐시된 도메인 결과 ─────────────────────────

let campaignPerfCache: Record<string, CampaignPerformance> | null = null;
function campaignPerf(): Record<string, CampaignPerformance> {
  campaignPerfCache ??= computePerformance(dataset(), 'CAMPAIGN');
  return campaignPerfCache;
}
let v1Cache: CashSimResult | null = null;
/** 최초 재전망 v1 (UI-08: 조건 변경 전후 비교용) */
function forecastV1(): CashSimResult {
  v1Cache ??= simulateCash(dataset(), { id: 'CF-v1' });
  return v1Cache;
}

/** 미결 상태 = 기한 경과 시 자동 확정되는 상태 (도메인 전이 표에서 읽음) */
const lineIsOpen = (l: ExpansionLine) => wf.LINE_TRANSITIONS[l.status].includes('AUTO_CONFIRMED');
/** 계약이 기한 경과 시 자동 갱신으로 갈 수 있는 상태 (도메인 전이 표에서 읽음) */
const contractCanAutoRenew = (s: wf.WorldState) => wf.CONTRACT_TRANSITIONS[s.contract.status].includes('AUTO_RENEWED');

function influencerName(id: string): string {
  return dataset().influencers.find((i) => i.id === id)?.name ?? id;
}

// ───────────────────────── GET /api/meta ─────────────────────────

export async function getMeta(): Promise<MetaView> {
  const { presetId } = await getSession();
  const s = worldFor(presetId);
  return {
    workId: 'W02',
    simNow: s.simNow,
    // 1단계에는 AI 호출 경로가 없다 → 항상 모의 (2단계에서 키 유무 · 호출 실패로 판정)
    aiMode: 'MOCK',
    model: 'claude-opus-5-5',
    cashForecastVersion: s.forecast.id,
    dataMode: 'PREVIEW',
    preset: PRESETS.find((p) => p.id === presetId)!,
  };
}

// ───────────────────────── 경고 (SCREEN_SPEC 0-3) ─────────────────────────

const SEVERITY_ORDER: Record<Severity, number> = { DANGER: 0, WARNING: 1, INFO: 2 };

function levelToSeverity(level: string): Severity {
  return level === 'DANGER' || level === 'PASSED' ? 'DANGER' : level === 'WARNING' ? 'WARNING' : 'INFO';
}

function previousRoleOf(s: wf.WorldState, lineId: string): { from: ApproverRole; reason: string } | null {
  const row = [...s.audit].reverse().find((a) => a.entityId === lineId && a.ruleIds.includes('R-AUTH-06') && typeof a.snapshot.from === 'string');
  if (!row) return null;
  return { from: row.snapshot.from as ApproverRole, reason: row.reason };
}

function buildAlerts(s: wf.WorldState): AlertView[] {
  const ds = dataset();
  const c = s.contract;
  const out: AlertView[] = [];
  const cLevel = deadlineLevel(s.simNow, c.noticeDeadline);
  const cDays = daysLeft(s.simNow, c.noticeDeadline);
  const cDeadline = md(c.noticeDeadline);

  // 자동 갱신 경고
  if (contractCanAutoRenew(s) && (cLevel === 'WARNING' || cLevel === 'DANGER')) {
    out.push({
      id: 'AL-AUTO-RENEWAL',
      kind: 'AUTO_RENEWAL',
      severity: 'DANGER',
      title: `통보 없이 ${cDeadline} 이 지나면 연 ${fmt(c.fixedFeeAnnualKrw)}원 계약이 권한 승인 없이 체결됩니다`,
      detail: `계약 상태: ${CONTRACT_STATUS_KO[c.status]} · 남은 ${cDays}일. 미통보 자동 갱신도 체결로 본다 (정책).`,
      nextAction: { text: '그룹 CEO/이사회 승인 → 계약 담당 통보 발송', href: `/contracts/${c.id}`, role: 'GROUP_CEO_BOARD' },
      ruleIds: ['R-DL-02', 'R-AUTH-02'],
      label: 'ORIGINAL',
      subjectIds: [c.id],
    });
  }
  if (c.status === 'AUTO_RENEWED') {
    out.push({
      id: 'AL-AUTO-RENEWED',
      kind: 'AUTO_RENEWAL',
      severity: 'DANGER',
      title: '전속계약이 자동 갱신되었습니다 — 권한 미경유 체결',
      detail: `통보 기한 ${c.noticeDeadline} 경과 · 유효 통보 없음. 해지는 위약금(R-PEN-01)이 붙는 새 결정입니다.`,
      nextAction: { text: '그룹 CEO/이사회 사고 대응 작업 확인', href: '/tasks', role: 'GROUP_CEO_BOARD' },
      ruleIds: ['R-DL-02'],
      label: 'ORIGINAL',
      subjectIds: [c.id],
    });
  }

  // 수령 미확인 (E1)
  if (c.status === 'NOTICE_SENT' || c.status === 'NOTICE_UNCONFIRMED') {
    out.push({
      id: 'AL-NOTICE',
      kind: 'NOTICE_UNCONFIRMED',
      severity: c.status === 'NOTICE_UNCONFIRMED' ? 'DANGER' : 'WARNING',
      title: c.status === 'NOTICE_UNCONFIRMED' ? '기한까지 수령 미확인 — 통보 효력 미확인' : '통보 발송됨 · 수령 미확인 — 통보 완료로 보지 않음 (확장 E1)',
      detail: '수령확인 없이는 자동 갱신이 차단됐다고 판단하지 않습니다 (A-14).',
      nextAction: { text: '계약 담당: 수령확인 · 재통보', href: `/contracts/${c.id}?tab=notice`, role: 'CONTRACT_OFFICER' },
      ruleIds: ['R-EXT-01'],
      label: 'ASSUMPTION',
      subjectIds: [c.id],
    });
  }

  // 기한 경고 — 대기 중 승인요청별
  for (const a of s.approvals.filter((x) => x.status === 'PENDING')) {
    const level = deadlineLevel(s.simNow, a.hardDeadline);
    const d = daysLeft(s.simNow, a.hardDeadline);
    const consequence = a.subjectType === 'CONTRACT' ? '자동 갱신(= 체결)' : a.subjectType === 'EXPANSION_LINES' ? '자동 확정(철회 불가)' : '요청 만료';
    out.push({
      id: `AL-DL-${a.id}`,
      kind: 'DEADLINE',
      severity: levelToSeverity(level),
      title: `${a.id} 기한 ${a.hardDeadline} · ${d >= 0 ? `D-${d}` : '경과'}`,
      detail: `기한 경과 시: ${consequence}. 내부 처리 기한 ${a.internalDueAt.slice(0, 10)} (A-12).`,
      nextAction: { text: `${roleKo(a.requiredRole)} 회신 필요`, href: `/approvals/${a.id}`, role: a.requiredRole },
      ruleIds: ['R-DL-03', 'R-DL-04'],
      label: 'AGGREGATED',
      subjectIds: [a.id, ...a.subjectIds],
    });
  }

  const open = s.lines.filter(lineIsOpen);
  const fw = s.forecast.breachWindows.map((w) => `${md(w.start)}~${md(w.end)}`).join(', ');

  // 승인 권한 경고 — covenant 우선 (R-AUTH-03), 기한 묶음별
  const byDeadline = new Map<string, ExpansionLine[]>();
  for (const l of open) {
    if (!l.routing?.reasons.some((r) => r.ruleId === 'R-AUTH-03')) continue;
    byDeadline.set(l.contractDeadline, [...(byDeadline.get(l.contractDeadline) ?? []), l]);
  }
  for (const [deadline, ls] of [...byDeadline].sort(([a], [b]) => a.localeCompare(b))) {
    const changed = ls.map((l) => ({ l, prev: previousRoleOf(s, l.id) })).filter((x) => x.prev && x.prev.from !== x.l.routing?.requiredRole);
    out.push({
      id: `AL-AUTH-${deadline}`,
      kind: 'AUTHORITY',
      severity: changed.length > 0 ? 'DANGER' : levelToSeverity(deadlineLevel(s.simNow, deadline)) === 'INFO' ? 'WARNING' : 'DANGER',
      title: `그룹 CEO/이사회 승인 필요 — ${md(deadline)} 마감 ${ls.length}건, covenant 하회 예상 구간(${fw})에 집행일 포함 (R-AUTH-03)`,
      detail: `${ls.map((l) => `${l.id}(집행 ${md(l.settlementDate)})`).join(' · ')}. Masil 대표 전결로 끝나지 않습니다.`,
      nextAction: { text: '그룹 CEO/이사회에 상신', href: `/proposals/${s.proposal?.id ?? 'PROP-2026-07'}?deadline=${deadline}`, role: 'GROUP_CEO_BOARD' },
      ruleIds: ['R-AUTH-03'],
      label: 'ORIGINAL',
      previousRole: changed[0]?.prev?.from ?? null,
      subjectIds: ls.map((l) => l.id),
    });
  }
  // 권한자 변경 → 재승인 필요
  for (const l of s.lines.filter((x) => x.status === 'REAPPROVAL_REQUIRED')) {
    const prev = previousRoleOf(s, l.id);
    out.push({
      id: `AL-REAPPROVE-${l.id}`,
      kind: 'AUTHORITY',
      severity: 'DANGER',
      title: `${l.id} 권한자 변경 → ${roleKo(l.routing!.requiredRole)} 재승인 필요`,
      detail: prev?.reason ?? '권한 재판정 (R-AUTH-06)',
      nextAction: { text: `${roleKo(l.routing!.requiredRole)} 회신`, href: l.approvalRequestId ? `/approvals/${l.approvalRequestId}` : '/approvals', role: l.routing!.requiredRole },
      ruleIds: ['R-AUTH-06', 'R-AUTH-03'],
      label: 'AGGREGATED',
      previousRole: prev?.from ?? null,
      subjectIds: [l.id],
    });
  }

  // 계약 연결 경고 (R-CON-01)
  const linked = open.filter((l) => l.flags.includes('CONTRACT_PENDING'));
  if (linked.length > 0) {
    out.push({
      id: 'AL-CONTRACT-LINK',
      kind: 'CONTRACT_LINK',
      severity: 'WARNING',
      title: '기안을 부결해도 전속계약은 자동 갱신될 수 있습니다 — 계약 결정 별도 필요',
      detail: `${linked.map((l) => l.id).join(' · ')} 는 ${influencerName(c.influencerId)}(${c.influencerId}) 전속계약의 하위 집행분입니다.`,
      nextAction: { text: '전속계약 승인요청 확인', href: `/contracts/${c.id}`, role: 'GROUP_CEO_BOARD' },
      ruleIds: ['R-CON-01'],
      label: 'ORIGINAL',
      subjectIds: linked.map((l) => l.id),
    });
  }

  // 재고 커버 경고 (R-INV-03)
  for (const l of open.filter((x) => x.flags.includes('INVENTORY_BELOW_MIN'))) {
    const gate = inventoryGate(ds, l, s.simNow);
    const worst = gate.skus.filter((k) => k.belowMin).sort((a, b) => (a.coverWeeks ?? 0) - (b.coverWeeks ?? 0))[0];
    if (!worst) continue;
    const stockout = l.flags.includes('STOCKOUT_BEFORE_SETTLEMENT');
    out.push({
      id: `AL-INV-${l.id}`,
      kind: 'INVENTORY',
      severity: stockout ? 'DANGER' : 'WARNING',
      title: `${l.id} 주력 SKU 재고 부족${stockout ? ' — 집행일 전 품절 예상' : ''}`,
      detail: `${worst.category} ${worst.skuId} 커버 ${(worst.coverWeeks ?? 0).toFixed(1)}주 (< ${worst.safetyStockWeeksMin}주), 예상 품절 ${worst.stockoutDate ?? '-'}, 지금 발주 시 도착 ${worst.arrivalIfOrderedNow} · 집행일 ${l.settlementDate}`,
      nextAction: { text: 'SCM 보충 검토 · 집행일 조정 검토', href: '/analysis/inventory', role: 'SCM' },
      ruleIds: ['R-INV-03', 'R-INV-02'],
      label: 'AGGREGATED',
      subjectIds: [l.id],
    });
  }

  // 성과 방향 경고 (공식값만 — UI-10)
  const neg = open.filter((l) => l.flags.includes('CP_NEGATIVE'));
  if (neg.length > 0) {
    out.push({
      id: 'AL-CP',
      kind: 'CP_NEGATIVE',
      severity: 'WARNING',
      title: `실질 공헌이익(공식값) 음수 — 부결 권고 ${neg.length}건`,
      detail: neg.map((l) => l.id).join(' · '),
      nextAction: { text: '기안 상세에서 건별 비용 분해 확인', href: `/proposals/${s.proposal?.id ?? 'PROP-2026-07'}?grade=CP_NEGATIVE` },
      ruleIds: ['R-CP-05'],
      label: 'AGGREGATED',
      subjectIds: neg.map((l) => l.id),
    });
  }

  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function referenceFlags(s: wf.WorldState): ReferenceFlagView[] {
  return s.lines
    .filter((l) => l.flags.includes('CP_REF_SIGN_DIFFERS'))
    .map((l) => ({ subjectId: l.id, text: '1.4 문자 그대로(이중 차감) 참고값은 음수 — 판단에 쓰지 않음' }));
}

// ───────────────────────── GET /api/overview ─────────────────────────

function contractSummary(s: wf.WorldState): ContractSummary {
  const c = s.contract;
  const receipt = s.receipts.at(-1);
  return {
    id: c.id,
    influencerName: `${influencerName(c.influencerId)} (${c.influencerId})`,
    status: c.status,
    statusText: CONTRACT_STATUS_KO[c.status],
    fixedFee: money('FULL', c.fixedFeeAnnualKrw, 'ORIGINAL', CONTRACT_REFS),
    performanceFee: { gapId: 'G-02', note: 'GMV 연동 · 별도 정산 — 산식 없음' },
    noticeDeadline: txt(c.noticeDeadline, 'ORIGINAL', CONTRACT_REFS),
    daysLeft: daysLeft(s.simNow, c.noticeDeadline),
    level: deadlineLevel(s.simNow, c.noticeDeadline),
    receiptConfirmed: !!receipt,
    receiptText: receipt
      ? `자동 갱신 차단됨 (수령확인 ${md(kstDate(receipt.receivedAt))})`
      : s.notices.length > 0
        ? '통보 발송 · 수령 미확인'
        : '통보 전',
    autoRenewed: c.status === 'AUTO_RENEWED',
  };
}

function covenantWindows(s: wf.WorldState): CovenantWindowView[] {
  const v1 = forecastV1();
  const runs: CashSimResult[] = s.forecast.id === v1.id ? [v1] : [v1, s.forecast];
  return runs.flatMap((r) =>
    r.breachWindows.map((w) => ({
      forecastId: r.id,
      start: w.start,
      end: w.end,
      businessDays: r.breachBusinessDays,
      current: r.id === s.forecast.id,
      source: txt(`${w.start} ~ ${w.end}`, 'AGGREGATED', [{ file: F.cashDaily }, { file: F.ar }, { file: F.ap }, { file: F.purchaseOrders }, { file: CALC, note: '1.2' }, { file: COVENANT }], '영업일 종가 < 3,000,000,000 연속 구간 (R-CASH-01~03)', r.assumptionIds),
    })),
  );
}

function lineGroupState(ls: ExpansionLine[]): { state: TimelineItem['state']; text: string } {
  const counts = new Map<string, number>();
  for (const l of ls) counts.set(LINE_STATUS_KO[l.status], (counts.get(LINE_STATUS_KO[l.status]) ?? 0) + 1);
  const text = [...counts].map(([k, v]) => `${k} ${v}`).join(' · ');
  if (ls.some((l) => l.status === 'AUTO_CONFIRMED')) return { state: 'AUTO', text };
  if (ls.some(lineIsOpen)) return { state: 'OPEN', text };
  if (ls.every((l) => l.status === 'REJECTED' || l.status === 'CANCELLED')) return { state: 'REJECTED', text };
  if (ls.every((l) => ['APPROVED', 'CONDITIONALLY_APPROVED', 'CONFIRMED'].includes(l.status))) return { state: 'APPROVED', text };
  return { state: 'DONE', text };
}

function timeline(s: wf.WorldState): TimelineItem[] {
  const ds = dataset();
  const c = s.contract;
  const items: TimelineItem[] = [];
  const cState: TimelineItem['state'] =
    c.status === 'AUTO_RENEWED' ? 'AUTO' : ['NEGOTIATING', 'TERMINATING', 'NOTICE_ACKNOWLEDGED', 'RENEWED_APPROVED'].includes(c.status) ? 'DONE' : 'OPEN';
  items.push({
    id: 'TL-CONTRACT',
    kind: 'CONTRACT_NOTICE',
    date: c.noticeDeadline,
    title: '전속계약 통보 기한',
    state: cState,
    stateText: CONTRACT_STATUS_KO[c.status],
    level: deadlineLevel(s.simNow, c.noticeDeadline),
    daysLeft: daysLeft(s.simNow, c.noticeDeadline),
    amount: money('FULL', c.fixedFeeAnnualKrw, 'ORIGINAL', CONTRACT_REFS, '고정 피 연액'),
    label: 'ORIGINAL',
    href: `/contracts/${c.id}`,
  });
  const groups = new Map<string, ExpansionLine[]>();
  for (const l of s.lines) groups.set(l.contractDeadline, [...(groups.get(l.contractDeadline) ?? []), l]);
  for (const [deadline, ls] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const st = lineGroupState(ls);
    items.push({
      id: `TL-LINES-${deadline}`,
      kind: 'LINE_DEADLINE',
      date: deadline,
      title: `기안 확정기한 (${ls.length}건)`,
      state: st.state,
      stateText: st.text,
      level: deadlineLevel(s.simNow, deadline),
      daysLeft: daysLeft(s.simNow, deadline),
      count: num(ls.length, 'AGGREGATED', [{ file: F.budgetPlan, column: 'contract_deadline' }], `contract_deadline = ${deadline}`),
      amount: money('SAMPLE', ls.reduce((a, l) => a + l.requestedKrw, 0), 'AGGREGATED', [{ file: F.budgetPlan, column: 'requested_budget_krw' }], `Σ requested_budget_krw (contract_deadline = ${deadline})`),
      label: 'ORIGINAL',
      href: `/proposals/${s.proposal?.id ?? 'PROP-2026-07'}?deadline=${deadline}`,
    });
  }
  items.push({ id: 'TL-END', kind: 'CONTRACT_END', date: c.currentTermEnd, title: '현 계약 만료', state: 'INFO', stateText: '원본 조건', label: 'ORIGINAL', href: `/contracts/${c.id}` });
  const pays = new Map<string, number>();
  for (const po of ds.purchaseOrders) pays.set(po.paymentDueDate, (pays.get(po.paymentDueDate) ?? 0) + po.amountKrw);
  for (const [date, amt] of pays) {
    items.push({
      id: `TL-PO-${date}`,
      kind: 'PO_PAYMENT',
      date,
      title: `기발주 대금 지급 (${ds.purchaseOrders.filter((p) => p.paymentDueDate === date).length}건)`,
      state: 'INFO',
      stateText: '하회 구간 시작 원인',
      amount: money('FULL', amt, 'AGGREGATED', [{ file: F.purchaseOrders, column: 'amount_krw' }], 'Σ amount_krw (payment_due_date 동일)'),
      label: 'AGGREGATED',
      href: '/analysis/cash',
    });
  }
  const arrivals = ds.purchaseOrders.map((p) => expectedArrivalDate(p)).sort();
  if (arrivals.length > 0) {
    items.push({
      id: 'TL-ARRIVAL',
      kind: 'PO_ARRIVAL',
      date: arrivals[0]!,
      endDate: arrivals.at(-1)!,
      title: '기발주 예상 입고',
      state: 'INFO',
      stateText: '발주일 + 리드타임 (A-20, 입고일 원본 없음)',
      label: 'ASSUMPTION',
      href: '/analysis/inventory',
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

function subjectOf(s: wf.WorldState, a: ApprovalRequest): { text: string; href: string } {
  if (a.subjectType === 'CONTRACT') return { text: `${influencerName(s.contract.influencerId)}(${s.contract.influencerId}) 전속계약`, href: `/contracts/${s.contract.id}` };
  if (a.subjectType === 'EXPANSION_LINES') return { text: `기안 ${a.subjectIds.join(' · ')} (${a.subjectIds.length}건)`, href: `/proposals/${s.proposal?.id ?? 'PROP-2026-07'}?approval=${a.id}` };
  return { text: `재고 보충 ${a.subjectIds.join(' · ')}`, href: '/analysis/inventory' };
}

function recommendationText(a: ApprovalRequest): string {
  if (a.subjectType === 'CONTRACT') return `권고: ${decisionText(a.proposed[0]?.decision ?? '')}`;
  return `권고: ${a.proposed.map((p) => `${p.itemId} ${decisionText(p.decision)}`).join(' · ')}`;
}

function pendingCard(s: wf.WorldState, a: ApprovalRequest): PendingApprovalCard {
  const sub = subjectOf(s, a);
  return {
    id: a.id,
    requiredRole: a.requiredRole,
    subjectText: sub.text,
    subjectHref: sub.href,
    hardDeadline: a.hardDeadline,
    internalDueAt: a.internalDueAt,
    daysLeft: daysLeft(s.simNow, a.hardDeadline),
    level: deadlineLevel(s.simNow, a.hardDeadline),
    recommendation: recommendationText(a),
    status: a.status,
  };
}

const OPEN_TASKS = ['OPEN', 'IN_PROGRESS', 'OVERDUE'];

export async function getOverview(): Promise<OverviewView> {
  const s = await world();
  const byRole = new Map<ActorRole, { open: number; overdue: number }>();
  for (const t of s.tasks) {
    if (!OPEN_TASKS.includes(t.status)) continue;
    const r = byRole.get(t.ownerRole) ?? { open: 0, overdue: 0 };
    r.open++;
    if (t.status === 'OVERDUE') r.overdue++;
    byRole.set(t.ownerRole, r);
  }
  return {
    timeline: timeline(s),
    covenantWindows: covenantWindows(s),
    pendingApprovals: s.approvals.filter((a) => a.status === 'PENDING').map((a) => pendingCard(s, a)),
    alerts: buildAlerts(s),
    referenceFlags: referenceFlags(s),
    contract: contractSummary(s),
    taskCounts: {
      open: [...byRole.values()].reduce((a, r) => a + r.open, 0),
      overdue: [...byRole.values()].reduce((a, r) => a + r.overdue, 0),
      byRole: [...byRole].map(([role, v]) => ({ role, ...v })),
    },
    recentAudit: [...s.audit].reverse().slice(0, 5),
    received: s.events.some((e) => e.type === 'RENEWAL_NOTICE_RECEIVED' || e.type === 'EXPANSION_PROPOSAL_RECEIVED'),
  };
}

// ───────────────────────── GET /api/analytics/influencers ─────────────────────────

export async function getInfluencerRows(includeReference: boolean): Promise<{
  rows: InfluencerPerfRow[];
  totals: { gmv: Money<'SAMPLE'>; spend: Money<'SAMPLE'>; cp: Money<'SAMPLE'>; realRoas: Num | null; nominalRoas: Num | null };
  remaining: { total: Money<'SAMPLE'>; shares: Record<string, Num> } | null;
}> {
  const s = await world();
  const ds = dataset();
  const perf = computePerformance(ds, 'INFLUENCER');
  const shares = influencerShares(ds);
  const list = Object.values(perf);
  const cpRank = rankBy(list, (p) => p.cp);
  const roasRank = rankBy(list, (p) => p.realRoas ?? Number.NEGATIVE_INFINITY);
  const agg = (v: number, method: string) => money('SAMPLE', v, 'AGGREGATED', PERF_REFS, method, PERF_ASSUMPTIONS);
  const ratio = (v: number | null, method: string, refs: SourceRef[] = PERF_REFS) => (v === null ? null : num(v, 'AGGREGATED', refs, method, PERF_ASSUMPTIONS));
  const rows: InfluencerPerfRow[] = ds.influencers.map((inf) => {
    const p = perf[inf.id]!;
    const sh = shares[inf.id]!;
    return {
      influencerId: inf.id,
      name: inf.name,
      adSpendShare: num(sh.adSpendShare, 'AGGREGATED', [{ file: F.adSpend, column: 'ad_cost_krw' }], 'Spend_i / ΣSpend (R-CP-04)'),
      adSpendRank: sh.adSpendRank,
      requestShare: num(sh.requestShare, 'AGGREGATED', [{ file: F.budgetPlan, column: 'requested_budget_krw' }], 'Request_i / ΣRequest (R-CP-04)'),
      requestRank: sh.requestRank,
      gmv: agg(p.gmv, 'Σ gmv_krw'),
      spend: agg(p.marketingSpend, 'Σ ad_cost_krw'),
      cp: agg(p.cp, '공식값 A05 5절 단일 차감: Net Revenue − COGS − Marketing Spend − 채널수수료 − 배송 − 반품물류 (R-CP-01)'),
      cpRank: cpRank[inf.id]!,
      nominalRoas: ratio(p.nominalRoas, 'GMV / Marketing Spend'),
      realRoas: ratio(p.realRoas, 'cp(공식) / Marketing Spend (R-CP-03)'),
      realRoasRank: roasRank[inf.id]!,
      returnRate: ratio(p.returnRate, 'Σ 반품환불 / Σ GMV (금액 기준)'),
      refSignDiffers: p.cp > 0 !== p.cpRefDef14 > 0,
      ...(includeReference
        ? {
            cpRefDef14: agg(p.cpRefDef14, '참고값: calculation_definitions 1.4 문자 그대로 — 쿠폰 · 반품환불 이중 차감 (R-CP-02). 판단에 쓰지 않음'),
            realRoasRefDef14: ratio(p.realRoasRefDef14, '참고: cpRefDef14 / Marketing Spend'),
          }
        : {}),
    };
  });
  const t = totalPerformance(ds);
  const anyDecided = s.lines.some((l) => l.status === 'CANCELLED' || l.status === 'REJECTED');
  let remaining = null;
  if (anyDecided) {
    const r = requestShareRemaining(ds, s.lines);
    remaining = {
      total: money('SAMPLE', r.remainingTotal, 'AGGREGATED', [{ file: F.budgetPlan, column: 'requested_budget_krw' }], '부결 · 취소 제외 남은 기안 합 (R-CP-06)'),
      shares: Object.fromEntries(ds.influencers.map((i) => [i.id, num(r.shares[i.id] ?? 0, 'AGGREGATED', [{ file: F.budgetPlan }], '남은 요청_i / Σ남은 요청 (R-CP-06)')])),
    };
  }
  return {
    rows,
    totals: {
      gmv: agg(t.gmv, 'Σ gmv_krw (표본 전체)'),
      spend: agg(t.marketingSpend, 'Σ ad_cost_krw (표본 전체)'),
      cp: agg(t.cp, '공식값 합계 (표본 전체)'),
      realRoas: ratio(t.realRoas, 'Σcp / ΣSpend'),
      nominalRoas: ratio(t.nominalRoas, 'ΣGMV / ΣSpend'),
    },
    remaining,
  };
}

// ───────────────────────── GET /api/contracts/:id ─────────────────────────

export async function getContract(id: string, terminateOn?: string): Promise<ContractView | null> {
  const s = await world();
  const c = s.contract;
  if (id !== c.id) return null;
  const r = wf.contractRouting(s);
  const cons = wf.contractConsequences(s);
  const perf = (await getInfluencerRows(false)).rows.find((x) => x.influencerId === c.influencerId) ?? null;
  const dl = (kind: string, date: string, label: SourceLabel, assumptionIds?: string[]) => ({
    kind,
    date,
    label,
    ...(assumptionIds ? { assumptionIds } : {}),
    daysLeft: daysLeft(s.simNow, date),
    level: deadlineLevel(s.simNow, date),
  });
  const validTerminate = terminateOn && /^\d{4}-\d{2}-\d{2}$/.test(terminateOn) ? terminateOn : null;
  const pen = cons.renewed && validTerminate ? penalty(c, validTerminate) : null;
  return {
    contract: contractSummary(s),
    terms: [
      { key: 'id', name: '계약 ID', value: txt(c.id, 'ASSUMPTION', [], 'ID 규칙 원본에 없음') },
      { key: 'influencer', name: '인플루언서', value: txt(`${influencerName(c.influencerId)} (${c.influencerId})`, 'ORIGINAL', CONTRACT_REFS) },
      { key: 'type', name: '계약 유형', value: txt('연간 전속 (경쟁 브랜드 활동 제한)', 'ORIGINAL', CONTRACT_REFS) },
      { key: 'fixedFee', name: '고정 피 (연)', value: money('FULL', c.fixedFeeAnnualKrw, 'ORIGINAL', CONTRACT_REFS) },
      { key: 'perfFee', name: '성과 피', value: { gapId: 'G-02', note: 'GMV 연동 · 별도 정산 — 산식 없음' } },
      { key: 'termEnd', name: '현 계약 만료', value: txt(c.currentTermEnd, 'ORIGINAL', CONTRACT_REFS) },
      { key: 'deadline', name: '통보 기한', value: txt(c.noticeDeadline, 'ORIGINAL', CONTRACT_REFS) },
      { key: 'auto', name: '미통보 시', value: txt(`동일 조건 ${c.autoRenewalTermMonths}개월 자동 갱신`, 'ORIGINAL', CONTRACT_REFS) },
      { key: 'penalty', name: '갱신 후 중도 해지 위약금', value: txt(`잔여 고정 피의 ${Math.round(c.earlyTerminationPenaltyRate * 100)}%`, 'ORIGINAL', CONTRACT_REFS) },
      { key: 'schedule', name: '고정 피 지급 일정', value: { gapId: 'G-09', note: '지급 일정 없음 — covenant 대조 판정 불가' } },
      { key: 'original', name: '계약 원문', value: { gapId: 'G-01', note: '원문 없음 — 통보서 조건만 사용' } },
    ],
    routing: {
      requiredRole: r.requiredRole,
      reasons: r.reasons,
      annualAmount: money('FULL', r.annualAmountKrw, r.annualAmountIsLowerBound ? 'AGGREGATED' : 'ORIGINAL', [...CONTRACT_REFS, { file: POLICY }], '고정 피 + 성과 피(미확인 → 하한)'),
      lowerBound: r.annualAmountIsLowerBound,
    },
    deadlines: [
      dl('승인 회신 (내부 D-2)', internalDueAt('CONTRACT_APPROVAL', c.noticeDeadline).slice(0, 10), 'ASSUMPTION', ['A-12']),
      dl('통보 발송 (내부 D-1)', internalDueAt('SEND_NOTICE', c.noticeDeadline).slice(0, 10), 'ASSUMPTION', ['A-12']),
      dl('통보 기한 (원본)', c.noticeDeadline, 'ORIGINAL'),
    ],
    linkedLines: s.lines
      .filter((l) => l.influencerId === c.influencerId)
      .map((l) => ({
        id: l.id,
        campaignId: l.campaignId,
        requested: money('SAMPLE', l.requestedKrw, 'ORIGINAL', [{ file: F.budgetPlan, column: 'requested_budget_krw', rowKey: l.id }]),
        contractDeadline: l.contractDeadline,
        status: l.status,
        statusText: LINE_STATUS_KO[l.status],
      })),
    performance: perf,
    notices: s.notices,
    receipts: s.receipts,
    audit: s.audit.filter((a) => a.entityId === c.id || (a.entityType === 'APPROVAL_REQUEST' && s.approvals.some((x) => x.id === a.entityId && x.subjectType === 'CONTRACT'))),
    approvals: s.approvals.filter((a) => a.subjectType === 'CONTRACT'),
    consequences: {
      renewed: cons.renewed,
      renewalStart: cons.renewalTerm.start,
      renewalEnd: cons.renewalTerm.end,
      committed: cons.committedTermKrw === null ? null : money('FULL', cons.committedTermKrw, 'ORIGINAL', CONTRACT_REFS, `원본 조건 · 상태 ${c.status}`),
    },
    penaltyPreview: pen
      ? {
          terminateOn: pen.terminateOn,
          remainingMonths: pen.remainingMonths,
          amount: money('FULL', pen.amountKrw, 'AGGREGATED', CONTRACT_REFS, `고정 피 × 잔여 ${pen.remainingMonths}개월/12 × 50% (R-PEN-01, 원 단위 내림)`, pen.assumptionIds),
        }
      : null,
    openGaps: wf.openGaps(s),
    assessmentId: c.status === 'ACTIVE' ? null : 'ASM-001',
  };
}

// ───────────────────────── GET /api/proposals/:id ─────────────────────────

function costSteps(p: CampaignPerformance): { steps: CostStep[]; ref: CostStep[] } {
  const m = (v: number, method: string) => money('SAMPLE', v, 'AGGREGATED', PERF_REFS, method, PERF_ASSUMPTIONS);
  const steps: CostStep[] = [
    { key: 'gmv', name: 'GMV (쿠폰 반영 후)', amount: m(p.gmv, 'Σ gmv_krw'), sign: '+' },
    { key: 'refund', name: '반품환불', amount: m(p.returnRefund, 'Σ refund_amount_krw'), sign: '−' },
    { key: 'net', name: 'Net Revenue', amount: m(p.netRevenue, 'GMV − 반품환불'), sign: '=' },
    { key: 'cogs', name: '제품원가 (COGS)', amount: m(p.cogs, 'Σ product_cost × 1EA (A-01)'), sign: '−' },
    { key: 'fee', name: '채널수수료', amount: m(p.channelFee, 'Σ GMV × fee_pct (A-02)'), sign: '−' },
    { key: 'ship', name: '배송비', amount: m(p.fulfillmentCost, 'Σ shipping_cost (A-01)'), sign: '−' },
    { key: 'retlog', name: '반품물류비', amount: m(p.returnLogisticsCost, 'Σ return_logistics_cost (A-03)'), sign: '−' },
    { key: 'spend', name: 'Marketing Spend', amount: m(p.marketingSpend, 'Σ ad_cost_krw'), sign: '−' },
    { key: 'cp', name: '실질 공헌이익 (공식값, A05 단일 차감)', amount: m(p.cp, 'R-CP-01'), sign: '=' },
  ];
  const ref: CostStep[] = [
    { key: 'cp', name: '공식값에서 출발', amount: m(p.cp, 'R-CP-01'), sign: '=' },
    { key: 'coupon2', name: '쿠폰 재차감 (이중 차감)', amount: m(p.couponDiscount, 'Σ coupon_discount_krw — 1.4 문자 그대로'), sign: '−' },
    { key: 'refund2', name: '반품환불 재차감 (이중 차감)', amount: m(p.returnRefund, 'Σ refund_amount_krw — 1.4 문자 그대로'), sign: '−' },
    { key: 'cpref', name: '참고값 (1.4 문자 그대로)', amount: m(p.cpRefDef14, 'R-CP-02 참고값 — 판단에 쓰지 않음'), sign: '=' },
  ];
  return { steps, ref };
}

function lineView(s: wf.WorldState, l: ExpansionLine): LineView {
  const ds = dataset();
  const camp = ds.campaigns.find((c) => c.id === l.campaignId);
  const p = campaignPerf()[l.campaignId] ?? null;
  const gate = inventoryGate(ds, l, s.simNow);
  const prev = previousRoleOf(s, l.id);
  const cs = p ? costSteps(p) : { steps: [], ref: [] };
  const minSku = gate.skus.filter((k) => k.coverWeeks !== null).sort((a, b) => a.coverWeeks! - b.coverWeeks!)[0];
  const window = l.flags.includes('IN_COVENANT_WINDOW') ? s.forecast.breachWindows.find((w) => l.settlementDate >= w.start && l.settlementDate <= w.end) : undefined;
  const rec = lineIsOpen(l) ? wf.recommendLine(l) : null;
  const planRef = (column: string): SourceRef[] => [{ file: F.budgetPlan, column, rowKey: l.id }];
  return {
    id: l.id,
    campaignId: l.campaignId,
    campaignName: camp?.name ?? l.campaignId,
    influencerId: l.influencerId,
    influencerName: influencerName(l.influencerId),
    productLine: camp?.productLine ?? '',
    requested: money('SAMPLE', l.requestedKrw, 'ORIGINAL', planRef('requested_budget_krw')),
    expectedGmv: money('SAMPLE', l.expectedGmvKrw, 'CLAIM', planRef('expected_gmv_krw'), '기안 예상 GMV — 승인 근거 불가 (R-CLAIM-01)'),
    settlementDate: l.settlementDate,
    contractDeadline: l.contractDeadline,
    decisionNeededBy: decisionNeededBy(l).date,
    daysLeft: daysLeft(s.simNow, l.contractDeadline),
    level: deadlineLevel(s.simNow, l.contractDeadline),
    routing: l.routing
      ? {
          requiredRole: l.routing.requiredRole,
          alsoReportTo: l.routing.alsoReportTo,
          reasons: l.routing.reasons,
          previousRole: prev && prev.from !== l.routing.requiredRole ? prev.from : null,
          changeReason: prev && prev.from !== l.routing.requiredRole ? prev.reason : null,
        }
      : null,
    grade: l.flags.includes('CP_NEGATIVE') ? 'CP_NEGATIVE' : l.flags.includes('CP_POSITIVE') ? 'CP_POSITIVE' : null,
    cp: p ? money('SAMPLE', p.cp, 'AGGREGATED', PERF_REFS, `캠페인 ${l.campaignId} 공식값 (A05 단일 차감, R-CP-01)`, PERF_ASSUMPTIONS) : null,
    cpRefDef14: p ? money('SAMPLE', p.cpRefDef14, 'AGGREGATED', PERF_REFS, '참고값 — 1.4 문자 그대로 (R-CP-02). 판단에 쓰지 않음', PERF_ASSUMPTIONS) : null,
    costSteps: cs.steps,
    refCostSteps: cs.ref,
    minCover: minSku ? num(minSku.coverWeeks!, 'AGGREGATED', [{ file: F.inventory }, { file: F.weeklySales }, { file: CALC, note: '1.3' }], `주력 SKU(${minSku.skuId}) 최소 커버 = on_hand / 4주 평균 (R-INV-01)`, ['A-16']) : null,
    inventory: gate.skus.map((k) => ({
      skuId: k.skuId,
      name: k.name,
      share: num(k.share, 'AGGREGATED', [{ file: F.orders }], '캠페인 표본 GMV 비중 (A-16 ≥ 20%)', ['A-16']),
      coverWeeks: k.coverWeeks === null ? null : num(k.coverWeeks, 'AGGREGATED', [{ file: F.inventory }, { file: F.weeklySales }], 'on_hand / 최근 4주 평균 (R-INV-01)'),
      minWeeks: k.safetyStockWeeksMin,
      belowMin: k.belowMin,
      stockoutDate: k.stockoutDate,
      arrivalIfOrderedNow: k.arrivalIfOrderedNow,
      stockoutBeforeSettlement: k.stockoutBeforeSettlement,
    })),
    flags: l.flags,
    status: l.status,
    statusText: LINE_STATUS_KO[l.status],
    approvalRequestId: l.approvalRequestId ?? null,
    recommendation: rec ? { decision: rec.decision, reasons: rec.reasons, ruleIds: rec.ruleIds, ...(rec.condition ? { condition: rec.condition } : {}) } : null,
    inCovenantWindow: window ? { window } : null,
    hasPostDeadlineReport: s.tasks.some((t) => t.type === 'POST_DEADLINE_REPORT' && t.subjectId === l.id),
  };
}

export interface ProposalFilters {
  deadline?: string;
  role?: string;
  grade?: string;
  status?: string;
  flag?: string;
  approval?: string;
}

export async function getProposal(id: string, f: ProposalFilters = {}): Promise<ProposalView | null> {
  const s = await world();
  if (id !== 'PROP-2026-07') return null;
  if (!s.proposal) return { received: false, proposal: null, summary: null, lines: [], covenantWindow: null };
  const pr = s.proposal;
  const planRefs: SourceRef[] = [{ file: F.budgetPlan, column: 'requested_budget_krw' }];
  const all = s.lines.map((l) => lineView(s, l));
  const total = pr.totalRequestedKrw as number;
  const groupsMap = new Map<string, LineView[]>();
  for (const l of all) groupsMap.set(l.contractDeadline, [...(groupsMap.get(l.contractDeadline) ?? []), l]);
  const groups: DeadlineGroup[] = [...groupsMap]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([deadline, ls]) => {
      const sum = ls.reduce((a, l) => a + l.requested.value, 0);
      return {
        deadline,
        count: ls.length,
        total: money('SAMPLE', sum, 'AGGREGATED', planRefs, `Σ 요청액 (contract_deadline = ${deadline})`),
        share: num(sum / total, 'AGGREGATED', planRefs, '묶음 합 / 기안 총액'),
      };
    });
  let lines = all;
  if (f.deadline) lines = lines.filter((l) => l.contractDeadline === f.deadline);
  if (f.role) lines = lines.filter((l) => l.routing?.requiredRole === f.role);
  if (f.grade) lines = lines.filter((l) => l.grade === f.grade);
  if (f.status) lines = lines.filter((l) => l.status === f.status);
  if (f.flag) lines = lines.filter((l) => l.flags.includes(f.flag as LineFlag));
  if (f.approval) {
    const a = s.approvals.find((x) => x.id === f.approval);
    if (a) lines = lines.filter((l) => a.subjectIds.includes(l.id));
  }
  lines = [...lines].sort((a, b) => a.contractDeadline.localeCompare(b.contractDeadline) || b.requested.value - a.requested.value);
  const r01 = s.lines[0]?.routing?.reasons.find((r) => r.ruleId === 'R-AUTH-01');
  const cur = covenantWindows(s).find((w) => w.current) ?? null;
  return {
    received: true,
    proposal: {
      id: pr.id,
      total: money('SAMPLE', total, 'AGGREGATED', planRefs, '25행 requested_budget_krw 합 — 권한 판정에는 기안 요청액 그대로 (W02_TASK 3-3 원본근거해석)'),
      lineCount: num(pr.lineCount, 'AGGREGATED', planRefs, '행 수'),
      expectedGmvTotal: money('SAMPLE', pr.expectedGmvTotalKrw, 'CLAIM', [{ file: F.budgetPlan, column: 'expected_gmv_krw' }], '기안 예상 GMV 합 — 차감 전, 승인 근거 불가 (R-CLAIM-01)'),
    },
    summary: {
      authorityText: total > 100_000_000 ? '1억 초과 → 전 건 Masil 대표 이상 + 그룹 보고' : '1억 이하 — 건별 판정',
      authorityReasons: r01 ? [r01] : [],
      over10mCount: num(all.filter((l) => l.flags.includes('OVER_10M')).length, 'AGGREGATED', planRefs, '요청액 > 10,000,000 건 수'),
      groups,
      gradeCounts: {
        positive: all.filter((l) => l.grade === 'CP_POSITIVE').length,
        negative: all.filter((l) => l.grade === 'CP_NEGATIVE').length,
        refDiffers: all.filter((l) => l.flags.includes('CP_REF_SIGN_DIFFERS')).length,
      },
    },
    lines,
    covenantWindow: cur,
  };
}

// ───────────────────────── 승인요청 ─────────────────────────

function approvalView(s: wf.WorldState, a: ApprovalRequest): ApprovalView {
  const sub = subjectOf(s, a);
  const items: ApprovalItemView[] = a.proposed.map((p) => {
    if (a.subjectType === 'CONTRACT') {
      return { itemId: p.itemId, title: sub.text, href: sub.href, proposedDecision: p.decision, proposedText: decisionText(p.decision), status: CONTRACT_STATUS_KO[s.contract.status] };
    }
    if (a.subjectType === 'EXPANSION_LINES') {
      const l = s.lines.find((x) => x.id === p.itemId)!;
      const camp = dataset().campaigns.find((c) => c.id === l.campaignId);
      return {
        itemId: p.itemId,
        title: `${l.id} · ${camp?.name ?? l.campaignId} · ${influencerName(l.influencerId)}`,
        href: `/proposals/${l.proposalId}?approval=${a.id}`,
        proposedDecision: p.decision,
        proposedText: decisionText(p.decision),
        requested: money('SAMPLE', l.requestedKrw, 'ORIGINAL', [{ file: F.budgetPlan, column: 'requested_budget_krw', rowKey: l.id }]),
        grade: l.flags.includes('CP_NEGATIVE') ? 'CP_NEGATIVE' : l.flags.includes('CP_POSITIVE') ? 'CP_POSITIVE' : null,
        flags: l.flags,
        status: LINE_STATUS_KO[l.status],
      };
    }
    const r = s.replenishments.find((x) => x.id === p.itemId);
    return { itemId: p.itemId, title: r ? `${r.id} · ${r.skuId} ${fmt(r.finalQty)}EA` : p.itemId, href: '/analysis/inventory', proposedDecision: p.decision, proposedText: decisionText(p.decision), status: r?.status ?? '' };
  });
  const ids = new Set([a.id, ...a.subjectIds]);
  return {
    request: a,
    subjectText: sub.text,
    subjectHref: sub.href,
    items,
    daysLeft: daysLeft(s.simNow, a.hardDeadline),
    level: deadlineLevel(s.simNow, a.hardDeadline),
    assessmentId: a.subjectType === 'CONTRACT' ? 'ASM-001' : a.subjectType === 'EXPANSION_LINES' && a.hardDeadline === '2026-07-17' && a.version === 1 ? 'ASM-002' : null,
    supersededBy: s.approvals.find((x) => x.supersedesId === a.id)?.id ?? null,
    alerts: buildAlerts(s).filter((al) => al.subjectIds.some((x) => ids.has(x))),
    replies: s.replies.filter((r) => r.requestId === a.id).map((r) => ({ id: r.id, respondentRole: r.respondentRole, outcome: r.outcome, reason: r.reason, simAt: r.simAt, label: r.label })),
    audit: s.audit.filter((x) => ids.has(x.entityId)),
    contractDecisionAllowed: a.subjectType === 'CONTRACT' ? ['RENEW_SAME', 'RENEGOTIATE', 'TERMINATE'] : null,
  };
}

export async function getApprovals(): Promise<ApprovalView[]> {
  const s = await world();
  return s.approvals.map((a) => approvalView(s, a));
}

export async function getApproval(id: string): Promise<ApprovalView | null> {
  const s = await world();
  const a = s.approvals.find((x) => x.id === id);
  return a ? approvalView(s, a) : null;
}


// ───────────────────────── GET /api/tasks ─────────────────────────

export async function getTasks(): Promise<TaskView[]> {
  const s = await world();
  return s.tasks.map((t) => ({
    ...t,
    typeText: TASK_TYPE_KO[t.type],
    subjectHref:
      t.subjectType === 'CONTRACT' ? `/contracts/${t.subjectId}` : t.subjectType === 'EXPANSION_LINE' ? `/proposals/PROP-2026-07?q=${t.subjectId}` : t.subjectType === 'APPROVAL_REQUEST' ? `/approvals/${t.subjectId}` : '/',
  }));
}

// ───────────────────────── GET /api/audit ─────────────────────────

export async function getAudit(f: { entityType?: string; entityId?: string; actorKind?: string } = {}): Promise<AuditLogEntry[]> {
  const s = await world();
  return [...s.audit]
    .filter((a) => (!f.entityType || a.entityType === f.entityType) && (!f.entityId || a.entityId === f.entityId) && (!f.actorKind || a.actorKind === f.actorKind))
    .reverse();
}

// ───────────────────────── GET /api/analytics/inventory ─────────────────────────

export async function getInventory() {
  const s = await world();
  const ds = dataset();
  const table = skuCoverTable(ds);
  const today = kstDate(s.simNow);
  const linesBySku = new Map<string, string[]>();
  for (const l of s.lines) for (const k of inventoryGate(ds, l, s.simNow).skus) linesBySku.set(k.skuId, [...(linesBySku.get(k.skuId) ?? []), l.id]);
  const rows = table.map((r) => ({
    ...r,
    product: ds.skus.find((k) => k.id === r.skuId)?.productId ?? '',
    cover: r.coverWeeks === null ? null : num(r.coverWeeks, 'AGGREGATED', [{ file: F.inventory }, { file: F.weeklySales }, { file: CALC, note: '1.3' }], 'on_hand / 최근 4주 평균 (R-INV-01, in_transit 미합산)'),
    reported: num(r.stockCoverWeeksReported, 'ORIGINAL', [{ file: F.inventory, column: 'stock_cover_weeks', rowKey: r.skuId }]),
    avg: num(r.avg4w, 'AGGREGATED', [{ file: F.weeklySales }], '최근 4주 sold_qty 평균'),
    onHand: num(r.onHandQty, 'ORIGINAL', [{ file: F.inventory, column: 'on_hand_qty', rowKey: r.skuId }]),
    inTransit: num(r.inTransitQty, 'ORIGINAL', [{ file: F.inventory, column: 'in_transit_qty', rowKey: r.skuId }]),
    pos: ds.purchaseOrders.filter((p) => p.skuId === r.skuId).map((p) => ({ id: p.id, qty: p.orderQty, arrival: expectedArrivalDate(p) })),
    lines: linesBySku.get(r.skuId) ?? [],
  }));
  const triggers = s.lines.filter((l) => l.flags.includes('INVENTORY_BELOW_MIN'));
  const pay = expectedPaymentDate(today);
  const suggestions = triggers.map((l) => {
    const routing = routeReplenishment({ expectedPaymentDate: pay }, s.forecast.breachWindows, s.forecast.id);
    return {
      lineId: l.id,
      paymentDate: txt(pay, 'ASSUMPTION', [], '발주일(기준시각) + 25일', ['A-19']),
      routing,
      items: replenishmentSuggestionsForLine(ds, l.campaignId).map((g) => ({
        skuId: g.skuId,
        target: num(g.targetQty, 'AGGREGATED', [{ file: F.weeklySales }, { file: F.sku }], '안전재고 max × 4주 평균', ['A-17']),
        suggested: num(g.suggestedQty, 'AGGREGATED', [{ file: F.inventory }], 'target − on_hand − in_transit'),
        finalQty: num(g.finalQty, 'AGGREGATED', [{ file: F.sku, column: 'moq' }], 'MOQ 배수 올림', ['A-18']),
        unitCost: money('FULL', g.unitCostKrw, 'AGGREGATED', [{ file: F.purchaseOrders }], '기발주 단가 = amount / qty'),
        amount: money('FULL', g.amountKrw, 'AGGREGATED', [{ file: F.purchaseOrders }], 'finalQty × 단가', ['A-17', 'A-18']),
      })),
    };
  });
  return { rows, suggestions, replenishments: s.replenishments, simDate: today };
}

// ───────────────────────── GET /api/analytics/cash ─────────────────────────

export async function getCash() {
  const s = await world();
  const ds = dataset();
  const v1 = forecastV1();
  const cur = s.forecast;
  const cashRefs: SourceRef[] = [{ file: F.cashDaily }, { file: F.ar }, { file: F.ap }, { file: F.purchaseOrders }, { file: CALC, note: '1.2' }];
  return {
    current: { id: cur.id, windows: cur.breachWindows, min: money('FULL', cur.minClosing.krw, 'AGGREGATED', cashRefs, `최저 종가 @ ${cur.minClosing.date}`, cur.assumptionIds), minDate: cur.minClosing.date, daily: cur.daily, opening: money('FULL', cur.opening, 'ORIGINAL', [{ file: F.cashDaily, column: 'closing_balance', rowKey: '2026-06-30' }]) },
    v1: { id: v1.id, windows: v1.breachWindows, daily: v1.daily },
    covenant: money('FULL', cur.covenantMinKrw, 'ORIGINAL', [{ file: COVENANT }], '매 영업일 종가 ≥ 30억'),
    poPayment: money('FULL', ds.purchaseOrders.reduce((a, p) => a + p.amountKrw, 0), 'AGGREGATED', [{ file: F.purchaseOrders, column: 'amount_krw' }], 'Σ 기발주 14건 (지급일 7/21)'),
    overrides: Object.entries(s.arDueOverrides).map(([ar, d]) => ({ ar, date: d, label: 'MOCK' as const })),
    official: ds.officialForecast.map((w) => ({ week: w.week, closing: money('FULL', w.projectedClosingKrw, 'CLAIM', [{ file: F.cashForecast, column: 'projected_closing_krw', rowKey: w.week }], '재무팀 공식 전망 — 주장') })),
    linesInWindow: s.lines
      .filter((l) => l.flags.includes('IN_COVENANT_WINDOW'))
      .map((l) => ({ id: l.id, settlementDate: l.settlementDate, role: l.routing?.requiredRole ?? null, status: LINE_STATUS_KO[l.status] })),
  };
}

// ───────────────────────── GET /api/data-registry ─────────────────────────

export async function getRegistry(): Promise<RegistryView> {
  const s = await world();
  const t = rawTables();
  const usedIn: Partial<Record<keyof typeof F, string>> = {
    budgetPlan: '확대 기안 · 권한',
    orders: '공헌이익 · 주력 SKU',
    returns: '공헌이익',
    adSpend: '공헌이익 · 집행 비중',
    costMaster: '공헌이익',
    inventory: '재고 커버',
    weeklySales: '재고 커버',
    purchaseOrders: '자금 · 입고',
    cashDaily: '자금 재전망',
    ar: '자금 재전망',
    ap: '자금 재전망',
    cashForecast: '대조용 (주장)',
  };
  const scaleOf = (k: keyof typeof F) =>
    ['orders', 'returns', 'coupons', 'adSpend', 'budgetPlan'].includes(k) ? '표본' : ['inventory', 'weeklySales', 'purchaseOrders', 'cashDaily', 'ar', 'ap', 'cashForecast'].includes(k) ? '풀스케일' : '-';
  const open = new Set(wf.openGaps(s));
  return {
    sources: (Object.keys(F) as (keyof typeof F)[]).map((k) => ({ file: F[k], rows: t[k].rows.length, scale: scaleOf(k), label: k === 'cashForecast' ? 'CLAIM' : 'ORIGINAL', usedIn: usedIn[k] ?? '마스터' })),
    assumptions: ASSUMPTIONS,
    gaps: GAPS.map((g) => ({ ...g, open: open.has(g.id) || !['G-02', 'G-03', 'G-08'].includes(g.id) })),
    claims: CLAIMS,
    mocks: MOCK_REPLY_DATASET,
    inconsistencies: INCONSISTENCIES,
  };
}

// ───────────────────────── GET /api/assessments/:id (1단계 모의) ─────────────────────────

export type AssessmentView = Omit<Assessment, 'facts'> & { facts: { name: string; value: Sourced<unknown> }[]; stubNote: string };

/**
 * 1단계 모의 판단안. AI 경로가 없으므로 aiMode = 'MOCK'. 숫자는 도메인 함수 결과(facts · ruleResults)만,
 * 대안 문구는 DEMO_SCENARIOS S1-3 문구를 옮긴 것 (모의). 2단계에서 POST/GET /api/assessments 로 대체.
 */
export async function getAssessment(id: string): Promise<AssessmentView | null> {
  const s = await world();
  if (s.contract.status === 'ACTIVE' && !s.proposal) return null;
  const c = s.contract;
  const r = wf.contractRouting(s);
  const perf = (await getInfluencerRows(false)).rows.find((x) => x.influencerId === c.influencerId);
  const base = { triggerEventId: s.events[0]?.id ?? null, aiMode: 'MOCK' as const, model: 'claude-opus-5-5', version: 1, createdAt: s.simNow, stubNote: '1단계 모의 판단안 — 숫자는 규칙 엔진(도메인 함수) 결과, 문장은 시연 시나리오 문구. AI 판단안은 2단계 API 연결 후 생성됩니다.' };
  if (id === 'ASM-001') {
    return {
      ...base,
      id,
      subjectType: 'CONTRACT',
      subjectIds: [c.id],
      facts: [
        { name: '고정 피 (연)', value: money('FULL', c.fixedFeeAnnualKrw, 'ORIGINAL', CONTRACT_REFS) },
        { name: '통보 기한', value: txt(c.noticeDeadline, 'ORIGINAL', CONTRACT_REFS) },
        { name: '남은 일수', value: num(daysLeft(s.simNow, c.noticeDeadline), 'AGGREGATED', CONTRACT_REFS, '통보 기한 − 기준시각 (달력일)') },
        ...(perf
          ? [
              { name: `${c.influencerId} 집행 비중 (표본)`, value: perf.adSpendShare as Sourced<unknown> },
              { name: `${c.influencerId} 기안 요청 비중 (표본)`, value: perf.requestShare as Sourced<unknown> },
              { name: `${c.influencerId} 실질 공헌이익 (공식값, 표본)`, value: perf.cp as Sourced<unknown> },
              { name: `${c.influencerId} 실질 공헌이익 순위`, value: num(perf.cpRank, 'AGGREGATED', PERF_REFS, '공식값 내림차순 (R-CP-04)') as Sourced<unknown> },
            ]
          : []),
      ],
      ruleResults: [{ ruleId: 'R-AUTH-02' as RuleId, result: r.requiredRole, inputs: { annualAmountKrw: r.annualAmountKrw, lowerBound: r.annualAmountIsLowerBound } }],
      alternatives: [
        { id: 'A', title: '동일 조건 갱신', decision: 'RENEW_SAME', effects: [{ value: '2026-09-01 ~ 2027-08-31 고정 피 연액 선점', label: 'ORIGINAL', refs: CONTRACT_REFS, scale: 'FULL' }], risks: ['표본상 집행 1위 · 실질 최하위와 반대 방향 (방향만)'], requiresRole: 'GROUP_CEO_BOARD' },
        { id: 'B', title: '조건변경 통보', decision: 'RENEGOTIATE', effects: [{ value: '기한 전 통보로 자동 갱신 차단', label: 'ORIGINAL', refs: CONTRACT_REFS, scale: 'NONE' }], risks: ['조건 내용은 수치로 만들지 않음 (A-23)', '성과 피 조건 미확인 (G-02)'], requiresRole: 'GROUP_CEO_BOARD' },
        { id: 'C', title: '해지 통보', decision: 'TERMINATE', effects: [{ value: '만료(8/31) 전 통보 — 위약금 조항은 갱신 후 중도 해지에만 적용', label: 'INTERPRETED', refs: CONTRACT_REFS, scale: 'NONE' }], risks: ['대체 파트너 · 공백 기간 필요'], requiresRole: 'GROUP_CEO_BOARD' },
      ],
      recommendation: { alternativeId: 'B', rationale: '자동 갱신을 막고 협상 여지를 남긴다. 표본 성과는 비중 · 순위 · 방향까지이며 28억과 곱하지 않는다. 총 보수는 성과 피 미확인으로 하한만 확정.' },
      perspectives: {
        marketing: '집행 비중 1위 인플루언서가 실질 공헌이익 최하위 — 배분이 성과를 따라가지 않음 (표본, 방향).',
        finance: '고정 피 지급 일정 미확인(G-09)으로 covenant 대조 판정 불가. 이미 최상위 권한자.',
        contract: '통보 기한 경과 시 동일 조건 자동 갱신 = 권한 미경유 체결. 수령확인까지 추적 (E1).',
        scm: '해당 없음.',
      },
      claimsCited: CLAIMS.slice(0, 3),
      unknowns: wf.openGaps(s).filter((g) => ['G-01', 'G-02', 'G-03', 'G-04', 'G-09'].includes(g)).map((g) => ({ gapId: g, impact: GAPS.find((x) => x.id === g)?.handling ?? '' })),
    };
  }
  if (id === 'ASM-002' && s.proposal) {
    const ids = ['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-004', 'PLAN-005'];
    const ls = ids.map((x) => s.lines.find((l) => l.id === x)!).map((l) => lineView(s, l));
    return {
      ...base,
      id,
      subjectType: 'EXPANSION_LINES',
      subjectIds: ids,
      facts: ls.flatMap((l) => [
        { name: `${l.id} 요청액`, value: l.requested as Sourced<unknown> },
        ...(l.cp ? [{ name: `${l.id} 캠페인 cp (공식값)`, value: l.cp as Sourced<unknown> }] : []),
      ]),
      ruleResults: ls.flatMap((l) => [
        ...(l.routing ? [{ ruleId: (l.routing.reasons[0]?.ruleId ?? 'R-AUTH-01') as RuleId, result: l.routing.requiredRole, inputs: { settlementDate: l.settlementDate, reasons: l.routing.reasons.map((x) => x.text) } }] : []),
        ...(l.recommendation ? [{ ruleId: 'R-CP-05' as RuleId, result: l.recommendation.decision, inputs: { lineId: l.id, grade: l.grade } }] : []),
      ]),
      alternatives: [],
      recommendation: { alternativeId: '-', rationale: ls.map((l) => `${l.id} ${l.recommendation ? decisionText(l.recommendation.decision) : l.statusText}`).join(' · ') },
      perspectives: {
        marketing: '확대 대상 캠페인의 실질 공헌이익(공식값) 부호로 권고 등급을 정함 (A-07).',
        finance: 'PLAN-001~003 집행일이 covenant 하회 예상 구간 안 → 그룹 CEO/이사회 승인 (R-AUTH-03).',
        contract: 'PLAN-001~003 은 INF-001 전속계약 하위 집행분 — 계약 결정은 별도 승인요청 (R-CON-01).',
        scm: '주력 SKU 커버 모두 안전재고 min 이상 — 재고 게이트 해당 없음.',
      },
      claimsCited: [{ text: '기안 예상 GMV (expected_gmv_krw) — 승인 근거 불가', ref: { file: F.budgetPlan, column: 'expected_gmv_krw' } }, CLAIMS[2]!],
      unknowns: [{ gapId: 'G-11', impact: '집행일 < 확정기한 건은 결정 필요 시점을 앞당겨 표시 (A-26)' }],
    };
  }
  return null;
}

/** 승인요청 회신 요청 본문 미리보기 (2단계 POST /api/approval-requests/:id/replies) */
export type ReplyDraft = { respondentRole: ApproverRole; outcome: string; decision?: string; conditions?: string; reason: string };
