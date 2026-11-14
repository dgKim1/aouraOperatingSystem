/**
 * API 응답 조립 (읽기 전용 순수 함수). 입력 = 운영 상태(WorldState) + 원본 데이터셋, 출력 = domain/api-types 의 응답 모양.
 * 1단계 프론트엔드 views.ts 가 하던 집계(기한별 합계 · 비중 · 타임라인 묶음 · 경고 · 심각도 · previousRole · 자동 갱신 위험 · 기발주 대금 합계)를
 * 서버로 옮겼다. 숫자 · 판정은 domain 함수 결과만 쓰고, 여기서는 출처 라벨 · 스케일을 붙이고 묶기만 한다.
 */
import { routeReplenishment } from '@/domain/authority';
import type {
  AlertView,
  ApprovalItemView,
  ApprovalView,
  AssessmentSummary,
  AuditRowView,
  CashEventRowView,
  AssessmentView,
  CashRunView,
  CashView,
  ContractSummary,
  ContractView,
  CostStep,
  CovenantWindowView,
  DeadlineGroup,
  GapStatus,
  InfluencerPerfRow,
  InfluencersView,
  InventoryView,
  LineView,
  OverviewView,
  PendingApprovalCard,
  PenaltyView,
  ProposalFilters,
  ProposalView,
  ReceivableView,
  ReferenceFlagView,
  RegistryView,
  ReplenishmentRowView,
  Severity,
  TaskView,
  TimelineItem,
} from '@/domain/api-types';
import { AS_OF, cashFlowItems, compareOfficialForecast, largestOfficialGap, simulateCash, type CashSimResult } from '@/domain/cash';
import type { MasilDataset } from '@/domain/dataset';
import { kstDate } from '@/domain/dates';
import { daysLeft, deadlineLevel, decisionNeededBy, internalDueAt } from '@/domain/deadline';
import { DomainError } from '@/domain/errors';
import { DOC_FILES, MASIL_FILES as F, FILE_SCALE, type MasilFileKey } from '@/domain/files';
import { expectedArrivalDate, expectedPaymentDate, inventoryGate, replenishmentSuggestionsForLine, skuCoverTable } from '@/domain/inventory';
import { APPROVAL_STATUS_KO, CONTRACT_STATUS_KO, decisionText, LINE_STATUS_KO, replenishmentStatusText, TASK_STATUS_KO, TASK_TYPE_KO } from '@/domain/labels';
import { MOCK_REPLY_DATASET } from '@/domain/mockReplies';
import { penalty } from '@/domain/penalty';
import { computePerformance, influencerShares, rankBy, requestShareRemaining, totalPerformance } from '@/domain/performance';
import { validateAssessmentNumbers } from '@/domain/provenance';
import { ASSUMPTIONS, CLAIMS, GAPS, INCONSISTENCIES } from '@/domain/registry';
import { CONTRACT_REFS, PROPOSAL_ID } from '@/domain/seed';
import { CASH_REFS, INV_REFS, money, num, PERF_ASSUMPTIONS, PERF_REFS, txt } from '@/domain/sourced';
import type { ActorRole, ApprovalRequest, ApproverRole, Assessment, AuditLogEntry, CampaignPerformance, ExpansionLine, LineFlag, ReplenishmentRequest, SourceRef, Task } from '@/domain/types';
import { ROLE_KO } from '@/domain/types';
import * as wf from '@/domain/workflow';

type S = wf.WorldState;
const fmt = (n: number) => n.toLocaleString('ko-KR');
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const roleKo = (r: ActorRole) => ROLE_KO[r];

// ───────────────────────── 캐시 (원본은 바뀌지 않음) ─────────────────────────

const campaignPerfCache = new WeakMap<MasilDataset, Record<string, CampaignPerformance>>();
function campaignPerf(ds: MasilDataset) {
  let p = campaignPerfCache.get(ds);
  if (!p) campaignPerfCache.set(ds, (p = computePerformance(ds, 'CAMPAIGN')));
  return p;
}
const v1Cache = new WeakMap<MasilDataset, CashSimResult>();
/** 최초 재전망 v1 (UI-08: 조건 변경 전후 비교용) */
function forecastV1(ds: MasilDataset): CashSimResult {
  let v = v1Cache.get(ds);
  if (!v) v1Cache.set(ds, (v = simulateCash(ds, { id: 'CF-v1' })));
  return v;
}

/** 미결 상태 = 기한 경과 시 자동 확정되는 상태 (도메인 전이 표에서 읽음) */
const lineIsOpen = (l: ExpansionLine) => wf.LINE_TRANSITIONS[l.status].includes('AUTO_CONFIRMED');
/** 계약이 기한 경과 시 자동 갱신으로 갈 수 있는 상태 */
export const contractCanAutoRenew = (s: S) => wf.CONTRACT_TRANSITIONS[s.contract.status].includes('AUTO_RENEWED');

const influencerName = (ds: MasilDataset, id: string) => ds.influencers.find((i) => i.id === id)?.name ?? id;
const proposalId = (s: S) => s.proposal?.id ?? PROPOSAL_ID;

// ───────────────────────── 경고 (SCREEN_SPEC 0-3) ─────────────────────────

/**
 * 자동 갱신 위험 경고의 「다음 행동」 — 계약 상태(3-1 전이표)에서 기한 전에 실제로 할 수 있는 다음 한 걸음.
 * 문구 · 링크만 고른다(판정 아님). 재검토 중에는 열린 작업 유형만 나열한다.
 */
function autoRenewalNextAction(s: S): AlertView['nextAction'] {
  const c = s.contract;
  const open = (type: Task['type']) => s.tasks.some((t) => t.subjectType === 'CONTRACT' && t.type === type && ['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(t.status));
  switch (c.status) {
    case 'ACTIVE':
      return { text: '계약 담당: 사건 입력에서 갱신 통보 접수', href: '/events', role: 'CONTRACT_OFFICER' };
    case 'UNDER_REVIEW':
      return { text: '계약 담당: 판단안 만들기 → 승인 요청 상신', href: `/contracts/${c.id}`, role: 'CONTRACT_OFFICER' };
    case 'PENDING_APPROVAL': {
      const req = [...s.approvals].reverse().find((a) => a.subjectType === 'CONTRACT' && a.status === 'PENDING');
      const role = req?.requiredRole ?? wf.contractRouting(s).requiredRole;
      return { text: `${roleKo(role)} 승인 회신 → 계약 담당 통보 발송`, href: req ? `/approvals/${req.id}` : `/contracts/${c.id}`, role };
    }
    case 'REVIEW_BEFORE_DEADLINE': {
      const steps = [open('INFO_REQUEST') ? '정보 요청 회신 확인' : null, open('REVIEW_BEFORE_DEADLINE') ? '기한 전 재검토' : null, '재상신'].filter((x): x is string => !!x);
      return { text: `계약 담당: ${steps.join(' · ')} 작업 → 그룹 CEO/이사회 재승인`, href: '/tasks', role: 'CONTRACT_OFFICER' };
    }
    case 'NOTICE_PENDING':
      return { text: '계약 담당: 통보 발송 작업 완료 (기한 전)', href: '/tasks', role: 'CONTRACT_OFFICER' };
    default:
      return { text: '전속계약 상세에서 상태 확인', href: `/contracts/${c.id}`, role: 'CONTRACT_OFFICER' };
  }
}

const SEVERITY_ORDER: Record<Severity, number> = { DANGER: 0, WARNING: 1, INFO: 2 };
const levelToSeverity = (level: string): Severity => (level === 'DANGER' || level === 'PASSED' ? 'DANGER' : level === 'WARNING' ? 'WARNING' : 'INFO');

/** 권한 재판정(R-AUTH-06) 이력에서 직전 권한자 */
export function previousRoleOf(s: S, lineId: string): { from: ApproverRole; reason: string } | null {
  const row = [...s.audit].reverse().find((a) => a.entityId === lineId && a.ruleIds.includes('R-AUTH-06') && typeof a.snapshot.from === 'string');
  if (!row) return null;
  return { from: row.snapshot.from as ApproverRole, reason: row.reason };
}

export function buildAlerts(s: S, ds: MasilDataset): AlertView[] {
  const c = s.contract;
  const out: AlertView[] = [];
  const cLevel = deadlineLevel(s.simNow, c.noticeDeadline);
  const cDays = daysLeft(s.simNow, c.noticeDeadline);

  if (contractCanAutoRenew(s) && (cLevel === 'WARNING' || cLevel === 'DANGER')) {
    out.push({
      id: 'AL-AUTO-RENEWAL',
      kind: 'AUTO_RENEWAL',
      severity: 'DANGER',
      title: `통보 없이 ${md(c.noticeDeadline)} 이 지나면 연 ${fmt(c.fixedFeeAnnualKrw)}원 계약이 권한 승인 없이 체결됩니다`,
      detail: `계약 상태: ${CONTRACT_STATUS_KO[c.status]} · 남은 ${cDays}일. 미통보 자동 갱신도 체결로 본다 (정책).`,
      nextAction: autoRenewalNextAction(s),
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
      nextAction: { text: '그룹 CEO/이사회에 상신', href: `/proposals/${proposalId(s)}?deadline=${deadline}`, role: 'GROUP_CEO_BOARD' },
      ruleIds: ['R-AUTH-03'],
      label: 'ORIGINAL',
      previousRole: changed[0]?.prev?.from ?? null,
      subjectIds: ls.map((l) => l.id),
    });
  }
  for (const l of s.lines.filter((x) => x.status === 'REAPPROVAL_REQUIRED' || (x.status === 'PENDING_APPROVAL' && previousRoleOf(s, x.id)))) {
    const prev = previousRoleOf(s, l.id);
    if (!prev || prev.from === l.routing?.requiredRole) continue;
    out.push({
      id: `AL-REAPPROVE-${l.id}`,
      kind: 'AUTHORITY',
      severity: 'DANGER',
      title: `${l.id} 권한자 변경 → ${roleKo(l.routing!.requiredRole)} 재승인 필요`,
      detail: prev.reason,
      nextAction: { text: `${roleKo(l.routing!.requiredRole)} 회신`, href: l.approvalRequestId ? `/approvals/${l.approvalRequestId}` : '/approvals', role: l.routing!.requiredRole },
      ruleIds: ['R-AUTH-06', 'R-AUTH-03'],
      label: 'AGGREGATED',
      previousRole: prev.from,
      subjectIds: [l.id],
    });
  }
  const linked = open.filter((l) => l.flags.includes('CONTRACT_PENDING'));
  if (linked.length > 0) {
    out.push({
      id: 'AL-CONTRACT-LINK',
      kind: 'CONTRACT_LINK',
      severity: 'WARNING',
      title: '기안을 부결해도 전속계약은 자동 갱신될 수 있습니다 — 계약 결정 별도 필요',
      detail: `${linked.map((l) => l.id).join(' · ')} 는 ${influencerName(ds, c.influencerId)}(${c.influencerId}) 전속계약의 하위 집행분입니다.`,
      nextAction: { text: '전속계약 승인요청 확인', href: `/contracts/${c.id}`, role: 'GROUP_CEO_BOARD' },
      ruleIds: ['R-CON-01'],
      label: 'ORIGINAL',
      subjectIds: linked.map((l) => l.id),
    });
  }
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
  const neg = open.filter((l) => l.flags.includes('CP_NEGATIVE'));
  if (neg.length > 0) {
    out.push({
      id: 'AL-CP',
      kind: 'CP_NEGATIVE',
      severity: 'WARNING',
      title: `실질 공헌이익(공식값) 음수 — 부결 권고 ${neg.length}건`,
      detail: neg.map((l) => l.id).join(' · '),
      nextAction: { text: '기안 상세에서 건별 비용 분해 확인', href: `/proposals/${proposalId(s)}?grade=CP_NEGATIVE` },
      ruleIds: ['R-CP-05'],
      label: 'AGGREGATED',
      subjectIds: neg.map((l) => l.id),
    });
  }
  return out.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function referenceFlags(s: S): ReferenceFlagView[] {
  return s.lines.filter((l) => l.flags.includes('CP_REF_SIGN_DIFFERS')).map((l) => ({ subjectId: l.id, text: '1.4 문자 그대로(이중 차감) 참고값은 음수 — 판단에 쓰지 않음' }));
}

// ───────────────────────── 운영 현황 ─────────────────────────

export function contractSummary(s: S, ds: MasilDataset): ContractSummary {
  const c = s.contract;
  const receipt = s.receipts.at(-1);
  const level = deadlineLevel(s.simNow, c.noticeDeadline);
  return {
    id: c.id,
    influencerName: `${influencerName(ds, c.influencerId)} (${c.influencerId})`,
    status: c.status,
    statusText: CONTRACT_STATUS_KO[c.status],
    fixedFee: money('FULL', c.fixedFeeAnnualKrw, 'ORIGINAL', CONTRACT_REFS),
    performanceFee: c.performanceFeeTerms ? txt(c.performanceFeeTerms, 'MOCK', [], '에이전시 모의 회신') : { gapId: 'G-02', note: 'GMV 연동 · 별도 정산 — 산식 없음' },
    noticeDeadline: txt(c.noticeDeadline, 'ORIGINAL', CONTRACT_REFS),
    daysLeft: daysLeft(s.simNow, c.noticeDeadline),
    level,
    receiptConfirmed: !!receipt,
    receiptText: receipt ? `자동 갱신 차단됨 (수령확인 ${md(kstDate(receipt.receivedAt))})` : s.notices.length > 0 ? '통보 발송 · 수령 미확인' : '통보 전',
    autoRenewed: c.status === 'AUTO_RENEWED',
    autoRenewalRisk: contractCanAutoRenew(s) && (level === 'WARNING' || level === 'DANGER'),
  };
}

export function covenantWindows(s: S, ds: MasilDataset): CovenantWindowView[] {
  const v1 = forecastV1(ds);
  const runs: CashSimResult[] = s.forecast.id === v1.id ? [s.forecast] : [v1, s.forecast];
  return runs.flatMap((r) =>
    r.breachWindows.map((w) => ({
      forecastId: r.id,
      start: w.start,
      end: w.end,
      businessDays: r.breachBusinessDays,
      current: r.id === s.forecast.id,
      source: txt(`${w.start} ~ ${w.end}`, 'AGGREGATED', CASH_REFS, '영업일 종가 < 3,000,000,000 연속 구간 (R-CASH-01~03)', r.assumptionIds),
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

function poPaymentTotal(ds: MasilDataset) {
  return money('FULL', ds.purchaseOrders.reduce((a, p) => a + p.amountKrw, 0), 'AGGREGATED', [{ file: F.purchaseOrders, column: 'amount_krw' }], `Σ 기발주 ${ds.purchaseOrders.length}건 대금`);
}

function timeline(s: S, ds: MasilDataset): TimelineItem[] {
  const c = s.contract;
  const items: TimelineItem[] = [];
  const cState: TimelineItem['state'] = c.status === 'AUTO_RENEWED' ? 'AUTO' : ['NEGOTIATING', 'TERMINATING', 'NOTICE_ACKNOWLEDGED', 'RENEWED_APPROVED'].includes(c.status) ? 'DONE' : 'OPEN';
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
  const total = (s.proposal?.totalRequestedKrw as number | undefined) ?? 0;
  for (const g of deadlineGroups(s)) {
    const ls = s.lines.filter((l) => l.contractDeadline === g.deadline);
    const st = lineGroupState(ls);
    items.push({
      id: `TL-LINES-${g.deadline}`,
      kind: 'LINE_DEADLINE',
      date: g.deadline,
      title: `기안 확정기한 (${g.count}건)`,
      state: st.state,
      stateText: st.text,
      level: deadlineLevel(s.simNow, g.deadline),
      daysLeft: daysLeft(s.simNow, g.deadline),
      count: num(g.count, 'AGGREGATED', [{ file: F.budgetPlan, column: 'contract_deadline' }], `contract_deadline = ${g.deadline}`),
      amount: g.total,
      ...(total > 0 ? { share: g.share } : {}),
      label: 'ORIGINAL',
      href: `/proposals/${proposalId(s)}?deadline=${g.deadline}`,
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
    items.push({ id: 'TL-ARRIVAL', kind: 'PO_ARRIVAL', date: arrivals[0]!, endDate: arrivals.at(-1)!, title: '기발주 예상 입고', state: 'INFO', stateText: '발주일 + 리드타임 (A-20, 입고일 원본 없음)', label: 'ASSUMPTION', href: '/analysis/inventory' });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

function subjectOf(s: S, ds: MasilDataset, a: Pick<ApprovalRequest, 'subjectType' | 'subjectIds' | 'id'>): { text: string; href: string } {
  if (a.subjectType === 'CONTRACT') return { text: `${influencerName(ds, s.contract.influencerId)}(${s.contract.influencerId}) 전속계약`, href: `/contracts/${s.contract.id}` };
  if (a.subjectType === 'EXPANSION_LINES') return { text: `기안 ${a.subjectIds.join(' · ')} (${a.subjectIds.length}건)`, href: `/proposals/${proposalId(s)}?approval=${a.id}` };
  return { text: `재고 보충 ${a.subjectIds.join(' · ')}`, href: '/analysis/inventory' };
}

const recommendationText = (a: ApprovalRequest) =>
  a.subjectType === 'CONTRACT' ? `권고: ${decisionText(a.proposed[0]?.decision ?? '')}` : `권고: ${a.proposed.map((p) => `${p.itemId} ${decisionText(p.decision)}`).join(' · ')}`;

function pendingCard(s: S, ds: MasilDataset, a: ApprovalRequest): PendingApprovalCard {
  const sub = subjectOf(s, ds, a);
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
    assessmentId: a.assessmentId,
  };
}

const OPEN_TASKS: Task['status'][] = ['OPEN', 'IN_PROGRESS', 'OVERDUE'];

export function overview(s: S, ds: MasilDataset): OverviewView {
  const byRole = new Map<ActorRole, { open: number; overdue: number }>();
  for (const t of s.tasks) {
    if (!OPEN_TASKS.includes(t.status)) continue;
    const r = byRole.get(t.ownerRole) ?? { open: 0, overdue: 0 };
    r.open++;
    if (t.status === 'OVERDUE') r.overdue++;
    byRole.set(t.ownerRole, r);
  }
  return {
    timeline: timeline(s, ds),
    covenantWindows: covenantWindows(s, ds),
    pendingApprovals: s.approvals.filter((a) => a.status === 'PENDING').map((a) => pendingCard(s, ds, a)),
    alerts: buildAlerts(s, ds),
    referenceFlags: referenceFlags(s),
    contract: contractSummary(s, ds),
    taskCounts: {
      open: [...byRole.values()].reduce((a, r) => a + r.open, 0),
      overdue: [...byRole.values()].reduce((a, r) => a + r.overdue, 0),
      byRole: [...byRole].map(([role, v]) => ({ role, ...v })),
    },
    recentAudit: auditRows(s, [...s.audit].reverse().slice(0, 5)),
    received: s.events.some((e) => e.type === 'RENEWAL_NOTICE_RECEIVED' || e.type === 'EXPANSION_PROPOSAL_RECEIVED'),
    poPaymentTotal: poPaymentTotal(ds),
  };
}

// ───────────────────────── 성과 (S-08) ─────────────────────────

export function influencers(s: S, ds: MasilDataset, includeReference: boolean): InfluencersView {
  const perf = computePerformance(ds, 'INFLUENCER');
  const shares = influencerShares(ds);
  const list = Object.values(perf);
  const cpRank = rankBy(list, (p) => p.cp);
  const roasRank = rankBy(list, (p) => p.realRoas ?? Number.NEGATIVE_INFINITY);
  const agg = (v: number, method: string) => money('SAMPLE', v, 'AGGREGATED', PERF_REFS, method, PERF_ASSUMPTIONS);
  const ratio = (v: number | null, method: string) => (v === null ? null : num(v, 'AGGREGATED', PERF_REFS, method, PERF_ASSUMPTIONS));
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
        ? { cpRefDef14: agg(p.cpRefDef14, '참고값: calculation_definitions 1.4 문자 그대로 — 쿠폰 · 반품환불 이중 차감 (R-CP-02). 판단에 쓰지 않음'), realRoasRefDef14: ratio(p.realRoasRefDef14, '참고: cpRefDef14 / Marketing Spend') }
        : {}),
    };
  });
  const t = totalPerformance(ds);
  const anyDecided = s.lines.some((l) => l.status === 'CANCELLED' || l.status === 'REJECTED');
  let remaining: InfluencersView['remaining'] = null;
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
    assumptions: PERF_ASSUMPTIONS,
  };
}

// ───────────────────────── 판단안 ─────────────────────────

export function assessmentView(s: S, a: Assessment): AssessmentView {
  return {
    ...a,
    mock: a.aiMode === 'MOCK',
    toolCalls: a.toolCalls ?? [],
    warnings: a.warnings ?? [],
    fallbackReason: a.fallbackReason ?? null,
    provenance: validateAssessmentNumbers(a),
    approvalRequestIds: s.approvals.filter((r) => r.assessmentId === a.id).map((r) => r.id),
  };
}

function assessmentSummary(a: Assessment): AssessmentSummary {
  return {
    id: a.id,
    version: a.version,
    aiMode: a.aiMode,
    mock: a.aiMode === 'MOCK',
    createdAt: a.createdAt,
    recommendation: { alternativeId: a.recommendation.alternativeId, title: a.alternatives.find((x) => x.id === a.recommendation.alternativeId)?.title ?? null, rationale: a.recommendation.rationale },
  };
}

// ───────────────────────── 전속계약 (S-03) ─────────────────────────

export function penaltyView(s: S, terminateOn: string): PenaltyView {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(terminateOn)) throw new DomainError('VALIDATION', 'terminateOn 은 YYYY-MM-DD');
  const c = s.contract;
  const cons = wf.contractConsequences(s);
  const pen = penalty(c, terminateOn);
  const applies = cons.renewed;
  return {
    terminateOn,
    renewalStart: pen.renewalStart,
    renewalEnd: pen.renewalEnd,
    remainingMonths: pen.remainingMonths,
    applies,
    amount: money('FULL', applies ? pen.amountKrw : 0, 'AGGREGATED', CONTRACT_REFS, applies ? `고정 피 × 잔여 ${pen.remainingMonths}개월/12 × 50% (R-PEN-01, 원 단위 내림)` : `계약 상태 ${c.status} — 갱신 전이라 위약금 대상 아님`, pen.assumptionIds),
  };
}

export function contractView(s: S, ds: MasilDataset, id: string, terminateOn?: string): ContractView {
  const c = s.contract;
  if (id !== c.id) throw new DomainError('NOT_FOUND', `전속계약 없음: ${id}`);
  const r = wf.contractRouting(s);
  const cons = wf.contractConsequences(s);
  const perf = influencers(s, ds, false).rows.find((x) => x.influencerId === c.influencerId) ?? null;
  const dl = (kind: string, date: string, label: 'ORIGINAL' | 'ASSUMPTION', assumptionIds?: string[]) => ({ kind, date, label, ...(assumptionIds ? { assumptionIds } : {}), daysLeft: daysLeft(s.simNow, date), level: deadlineLevel(s.simNow, date) });
  const validTerminate = terminateOn && /^\d{4}-\d{2}-\d{2}$/.test(terminateOn) ? terminateOn : null;
  const pen = cons.renewed && validTerminate ? penalty(c, validTerminate) : null;
  const asms = s.assessments.filter((a) => a.subjectType === 'CONTRACT');
  const latest = asms.at(-1) ?? null;
  return {
    contract: contractSummary(s, ds),
    terms: [
      { key: 'id', name: '계약 ID', value: txt(c.id, 'ASSUMPTION', [], 'ID 규칙 원본에 없음') },
      { key: 'influencer', name: '인플루언서', value: txt(`${influencerName(ds, c.influencerId)} (${c.influencerId})`, 'ORIGINAL', CONTRACT_REFS) },
      { key: 'type', name: '계약 유형', value: txt('연간 전속 (경쟁 브랜드 활동 제한)', 'ORIGINAL', CONTRACT_REFS) },
      { key: 'fixedFee', name: '고정 피 (연)', value: money('FULL', c.fixedFeeAnnualKrw, 'ORIGINAL', CONTRACT_REFS) },
      { key: 'perfFee', name: '성과 피', value: c.performanceFeeTerms ? txt(c.performanceFeeTerms, 'MOCK', [], '에이전시 모의 회신') : { gapId: 'G-02', note: 'GMV 연동 · 별도 정산 — 산식 없음' } },
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
      annualAmount: money('FULL', r.annualAmountKrw, r.annualAmountIsLowerBound ? 'AGGREGATED' : 'ORIGINAL', [...CONTRACT_REFS, { file: DOC_FILES.policy }], '고정 피 + 성과 피(미확인 → 하한)'),
      lowerBound: r.annualAmountIsLowerBound,
    },
    deadlines: [
      dl('승인 회신 (내부 D-2)', internalDueAt('CONTRACT_APPROVAL', c.noticeDeadline).slice(0, 10), 'ASSUMPTION', ['A-12']),
      dl('통보 발송 (내부 D-1)', internalDueAt('SEND_NOTICE', c.noticeDeadline).slice(0, 10), 'ASSUMPTION', ['A-12']),
      dl('통보 기한 (원본)', c.noticeDeadline, 'ORIGINAL'),
    ],
    linkedLines: s.lines
      .filter((l) => l.influencerId === c.influencerId)
      .map((l) => ({ id: l.id, campaignId: l.campaignId, requested: money('SAMPLE', l.requestedKrw, 'ORIGINAL', [{ file: F.budgetPlan, column: 'requested_budget_krw', rowKey: l.id }]), contractDeadline: l.contractDeadline, status: l.status, statusText: LINE_STATUS_KO[l.status] })),
    performance: perf,
    notices: s.notices,
    receipts: s.receipts,
    audit: auditRows(s, s.audit.filter((a) => a.entityId === c.id || (a.entityType === 'APPROVAL_REQUEST' && s.approvals.some((x) => x.id === a.entityId && x.subjectType === 'CONTRACT')) || asms.some((x) => x.id === a.entityId))),
    approvals: s.approvals.filter((a) => a.subjectType === 'CONTRACT'),
    consequences: {
      renewed: cons.renewed,
      renewalStart: cons.renewalTerm.start,
      renewalEnd: cons.renewalTerm.end,
      committed: cons.committedTermKrw === null ? null : money('FULL', cons.committedTermKrw, 'ORIGINAL', CONTRACT_REFS, `원본 조건 · 상태 ${c.status}`),
    },
    penaltyPreview: pen ? { terminateOn: pen.terminateOn, remainingMonths: pen.remainingMonths, amount: money('FULL', pen.amountKrw, 'AGGREGATED', CONTRACT_REFS, `고정 피 × 잔여 ${pen.remainingMonths}개월/12 × 50% (R-PEN-01, 원 단위 내림)`, pen.assumptionIds) } : null,
    openGaps: wf.openGaps(s),
    assessmentId: latest?.id ?? null,
    latestAssessment: latest ? assessmentSummary(latest) : null,
    assessments: asms.map(assessmentSummary),
    canRequestApproval: !!latest && c.status === 'UNDER_REVIEW',
  };
}

// ───────────────────────── 확대 기안 (S-04) ─────────────────────────

function costSteps(p: CampaignPerformance): { steps: CostStep[]; ref: CostStep[] } {
  const m = (v: number, method: string) => money('SAMPLE', v, 'AGGREGATED', PERF_REFS, method, PERF_ASSUMPTIONS);
  return {
    steps: [
      { key: 'gmv', name: 'GMV (쿠폰 반영 후)', amount: m(p.gmv, 'Σ gmv_krw'), sign: '+' },
      { key: 'refund', name: '반품환불', amount: m(p.returnRefund, 'Σ refund_amount_krw'), sign: '−' },
      { key: 'net', name: 'Net Revenue', amount: m(p.netRevenue, 'GMV − 반품환불'), sign: '=' },
      { key: 'cogs', name: '제품원가 (COGS)', amount: m(p.cogs, 'Σ product_cost × 1EA (A-01)'), sign: '−' },
      { key: 'fee', name: '채널수수료', amount: m(p.channelFee, 'Σ GMV × fee_pct (A-02)'), sign: '−' },
      { key: 'ship', name: '배송비', amount: m(p.fulfillmentCost, 'Σ shipping_cost (A-01)'), sign: '−' },
      { key: 'retlog', name: '반품물류비', amount: m(p.returnLogisticsCost, 'Σ return_logistics_cost (A-03)'), sign: '−' },
      { key: 'spend', name: 'Marketing Spend', amount: m(p.marketingSpend, 'Σ ad_cost_krw'), sign: '−' },
      { key: 'cp', name: '실질 공헌이익 (공식값, A05 단일 차감)', amount: m(p.cp, 'R-CP-01'), sign: '=' },
    ],
    ref: [
      { key: 'cp', name: '공식값에서 출발', amount: m(p.cp, 'R-CP-01'), sign: '=' },
      { key: 'coupon2', name: '쿠폰 재차감 (이중 차감)', amount: m(p.couponDiscount, 'Σ coupon_discount_krw — 1.4 문자 그대로'), sign: '−' },
      { key: 'refund2', name: '반품환불 재차감 (이중 차감)', amount: m(p.returnRefund, 'Σ refund_amount_krw — 1.4 문자 그대로'), sign: '−' },
      { key: 'cpref', name: '참고값 (1.4 문자 그대로)', amount: m(p.cpRefDef14, 'R-CP-02 참고값 — 판단에 쓰지 않음'), sign: '=' },
    ],
  };
}

export function lineView(s: S, ds: MasilDataset, l: ExpansionLine): LineView {
  const camp = ds.campaigns.find((c) => c.id === l.campaignId);
  const p = campaignPerf(ds)[l.campaignId] ?? null;
  const gate = inventoryGate(ds, l, s.simNow);
  const prev = previousRoleOf(s, l.id);
  const cs = p ? costSteps(p) : { steps: [], ref: [] };
  const minSku = gate.skus.filter((k) => k.coverWeeks !== null).sort((a, b) => a.coverWeeks! - b.coverWeeks!)[0];
  const window = l.flags.includes('IN_COVENANT_WINDOW') ? s.forecast.breachWindows.find((w) => l.settlementDate >= w.start && l.settlementDate <= w.end) : undefined;
  const rec = lineIsOpen(l) ? wf.recommendLine(l) : null;
  const planRefs = (column: string): SourceRef[] => [{ file: F.budgetPlan, column, rowKey: l.id }];
  const changed = prev && l.routing && prev.from !== l.routing.requiredRole;
  return {
    id: l.id,
    campaignId: l.campaignId,
    campaignName: camp?.name ?? l.campaignId,
    influencerId: l.influencerId,
    influencerName: influencerName(ds, l.influencerId),
    productLine: camp?.productLine ?? '',
    requested: money('SAMPLE', l.requestedKrw, 'ORIGINAL', planRefs('requested_budget_krw')),
    expectedGmv: money('SAMPLE', l.expectedGmvKrw, 'CLAIM', planRefs('expected_gmv_krw'), '기안 예상 GMV — 승인 근거 불가 (R-CLAIM-01)'),
    settlementDate: l.settlementDate,
    contractDeadline: l.contractDeadline,
    decisionNeededBy: decisionNeededBy(l).date,
    daysLeft: daysLeft(s.simNow, l.contractDeadline),
    level: deadlineLevel(s.simNow, l.contractDeadline),
    routing: l.routing ? { requiredRole: l.routing.requiredRole, alsoReportTo: l.routing.alsoReportTo, reasons: l.routing.reasons, previousRole: changed ? prev!.from : null, changeReason: changed ? prev!.reason : null } : null,
    grade: l.flags.includes('CP_NEGATIVE') ? 'CP_NEGATIVE' : l.flags.includes('CP_POSITIVE') ? 'CP_POSITIVE' : null,
    cp: p ? money('SAMPLE', p.cp, 'AGGREGATED', PERF_REFS, `캠페인 ${l.campaignId} 공식값 (A05 단일 차감, R-CP-01)`, PERF_ASSUMPTIONS) : null,
    cpRefDef14: p ? money('SAMPLE', p.cpRefDef14, 'AGGREGATED', PERF_REFS, '참고값 — 1.4 문자 그대로 (R-CP-02). 판단에 쓰지 않음', PERF_ASSUMPTIONS) : null,
    costSteps: cs.steps,
    refCostSteps: cs.ref,
    minCover: minSku ? num(minSku.coverWeeks!, 'AGGREGATED', INV_REFS, `주력 SKU(${minSku.skuId}) 최소 커버 = on_hand / 4주 평균 (R-INV-01)`, ['A-16']) : null,
    inventory: gate.skus.map((k) => ({
      skuId: k.skuId,
      name: k.name,
      share: num(k.share, 'AGGREGATED', [{ file: F.orders }], '캠페인 표본 GMV 비중 (A-16 ≥ 20%)', ['A-16']),
      coverWeeks: k.coverWeeks === null ? null : num(k.coverWeeks, 'AGGREGATED', INV_REFS, 'on_hand / 최근 4주 평균 (R-INV-01)'),
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
    supplyOutlook: l.supplyOutlook ?? 'UNKNOWN',
    inboundExpectedDate: l.inboundExpectedDate ?? null,
  };
}

/** 확정기한별 묶음 합계 · 비중 (총액 대비, 같은 SAMPLE 끼리만) */
export function deadlineGroups(s: S): DeadlineGroup[] {
  const total = (s.proposal?.totalRequestedKrw as number | undefined) ?? 0;
  const planRefs: SourceRef[] = [{ file: F.budgetPlan, column: 'requested_budget_krw' }];
  const m = new Map<string, ExpansionLine[]>();
  for (const l of s.lines) m.set(l.contractDeadline, [...(m.get(l.contractDeadline) ?? []), l]);
  return [...m]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([deadline, ls]) => {
      const sum = ls.reduce((a, l) => a + l.requestedKrw, 0);
      return {
        deadline,
        count: ls.length,
        total: money('SAMPLE', sum, 'AGGREGATED', planRefs, `Σ 요청액 (contract_deadline = ${deadline})`),
        share: num(total === 0 ? 0 : sum / total, 'AGGREGATED', planRefs, '묶음 합 / 기안 총액'),
      };
    });
}

export function proposalView(s: S, ds: MasilDataset, id: string, f: ProposalFilters = {}): ProposalView {
  if (id !== PROPOSAL_ID) throw new DomainError('NOT_FOUND', `확대 기안 없음: ${id}`);
  if (!s.proposal) return { received: false, proposal: null, summary: null, lines: [], covenantWindow: null };
  const pr = s.proposal;
  const planRefs: SourceRef[] = [{ file: F.budgetPlan, column: 'requested_budget_krw' }];
  const all = s.lines.map((l) => lineView(s, ds, l));
  const total = pr.totalRequestedKrw as number;
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
      groups: deadlineGroups(s),
      gradeCounts: {
        positive: all.filter((l) => l.grade === 'CP_POSITIVE').length,
        negative: all.filter((l) => l.grade === 'CP_NEGATIVE').length,
        refDiffers: all.filter((l) => l.flags.includes('CP_REF_SIGN_DIFFERS')).length,
      },
    },
    lines,
    covenantWindow: covenantWindows(s, ds).find((w) => w.current) ?? null,
  };
}

// ───────────────────────── 승인요청 (S-06) ─────────────────────────

export function approvalView(s: S, ds: MasilDataset, a: ApprovalRequest, alerts?: AlertView[]): ApprovalView {
  const sub = subjectOf(s, ds, a);
  const items: ApprovalItemView[] = a.proposed.map((p) => {
    if (a.subjectType === 'CONTRACT') return { itemId: p.itemId, title: sub.text, href: sub.href, proposedDecision: p.decision, proposedText: decisionText(p.decision), status: CONTRACT_STATUS_KO[s.contract.status] };
    if (a.subjectType === 'EXPANSION_LINES') {
      const l = s.lines.find((x) => x.id === p.itemId)!;
      const camp = ds.campaigns.find((c) => c.id === l.campaignId);
      return {
        itemId: p.itemId,
        title: `${l.id} · ${camp?.name ?? l.campaignId} · ${influencerName(ds, l.influencerId)}`,
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
    statusText: APPROVAL_STATUS_KO[a.status],
    subjectText: sub.text,
    subjectHref: sub.href,
    items,
    daysLeft: daysLeft(s.simNow, a.hardDeadline),
    level: deadlineLevel(s.simNow, a.hardDeadline),
    assessmentId: a.assessmentId,
    supersededBy: s.approvals.find((x) => x.supersedesId === a.id)?.id ?? null,
    alerts: (alerts ?? buildAlerts(s, ds)).filter((al) => al.subjectIds.some((x) => ids.has(x))),
    replies: s.replies.filter((r) => r.requestId === a.id).map((r) => ({ id: r.id, respondentRole: r.respondentRole, outcome: r.outcome, reason: r.reason, simAt: r.simAt, label: r.label })),
    audit: auditRows(s, s.audit.filter((x) => ids.has(x.entityId))),
    contractDecisionAllowed: a.subjectType === 'CONTRACT' ? ['RENEW_SAME', 'RENEGOTIATE', 'TERMINATE'] : null,
  };
}

/** 목록: role 이 주어지면 그 역할 대상 요청을 앞에 (S-06) */
export function approvalsView(s: S, ds: MasilDataset, f: { role?: string; status?: string } = {}): ApprovalView[] {
  const alerts = buildAlerts(s, ds);
  let list = s.approvals;
  if (f.status) list = list.filter((a) => a.status === f.status);
  const views = list.map((a) => approvalView(s, ds, a, alerts));
  if (f.role) views.sort((x, y) => Number(y.request.requiredRole === f.role) - Number(x.request.requiredRole === f.role));
  return views;
}

// ───────────────────────── 작업 (S-07) ─────────────────────────

export function taskView(t: Task): TaskView {
  return {
    ...t,
    typeText: TASK_TYPE_KO[t.type],
    statusText: TASK_STATUS_KO[t.status],
    subjectHref:
      t.subjectType === 'CONTRACT' ? `/contracts/${t.subjectId}` : t.subjectType === 'EXPANSION_LINE' ? `/proposals/${PROPOSAL_ID}?q=${t.subjectId}` : t.subjectType === 'APPROVAL_REQUEST' ? `/approvals/${t.subjectId}` : '/',
  };
}

export function tasksView(s: S, f: { role?: string; status?: string } = {}): TaskView[] {
  return s.tasks.filter((t) => (!f.role || t.ownerRole === f.role) && (!f.status || t.status === f.status)).map(taskView);
}

// ───────────────────────── 처리 이력 (S-11) ─────────────────────────

export function auditView(s: S, f: { entityType?: string; entityId?: string; actorKind?: string } = {}): AuditRowView[] {
  return auditRows(s, [...s.audit].filter((a) => (!f.entityType || a.entityType === f.entityType) && (!f.entityId || a.entityId === f.entityId) && (!f.actorKind || a.actorKind === f.actorKind)).reverse());
}

const REPLENISHMENT_STATUS_KO: Record<string, string> = { DRAFT: '초안 (SCM 검토 대기)', SUBMITTED: '상신 (승인 대기)', APPROVED: '승인', REJECTED: '종결', INFO_REQUESTED: '정보 요청' };

function statusKo(entityType: string, st: string): string {
  const m: Record<string, Record<string, string>> = {
    CONTRACT: CONTRACT_STATUS_KO,
    EXPANSION_LINE: LINE_STATUS_KO,
    APPROVAL_REQUEST: APPROVAL_STATUS_KO,
    TASK: TASK_STATUS_KO,
    REPLENISHMENT: REPLENISHMENT_STATUS_KO,
    ASSESSMENT: { CREATED: '생성' },
  };
  return m[entityType]?.[st] ?? st;
}

/**
 * 이력 1행의 표시 문구 (화면이 사유 문자열을 파싱하지 않게 — FE-04 · BE-13 의 이력판).
 * 보충요청 종결은 엔티티의 closedBy(구조화된 종결 경로, DD-034)로 정한다: DRAFT → REJECTED 는 SCM 검토 종결, SUBMITTED/INFO_REQUESTED → REJECTED 는 승인 거절.
 */
export function auditRow(s: S, e: AuditLogEntry): AuditRowView {
  const fromText = e.fromStatus === null ? null : statusKo(e.entityType, e.fromStatus);
  let toText = statusKo(e.entityType, e.toStatus);
  let displayText: string;
  if (e.entityType === 'CASH_FORECAST') {
    displayText = `재전망 교체 ${e.fromStatus ?? '-'} → ${e.toStatus}`;
  } else if (e.entityType === 'ASSESSMENT') {
    displayText = `판단안 생성 ${e.entityId}`;
  } else if (e.entityType === 'REPLENISHMENT' && e.toStatus === 'REJECTED') {
    const r = s.replenishments.find((x) => x.id === e.entityId);
    const closedBy = e.fromStatus === 'DRAFT' ? (r?.closedBy ?? 'SCM_NOT_NEEDED') : 'APPROVER';
    toText = replenishmentStatusText({ status: 'REJECTED', closedBy });
    displayText = toText;
  } else if (e.fromStatus === null) {
    if (e.entityType === 'TASK') {
      const t = s.tasks.find((x) => x.id === e.entityId);
      displayText = `작업 생성: ${t ? TASK_TYPE_KO[t.type] : e.entityId}`;
    } else {
      displayText = `생성: ${toText}`;
    }
  } else if (e.fromStatus === e.toStatus) {
    displayText = `상태 유지: ${toText}`;
  } else {
    displayText = `${fromText} → ${toText}`;
  }
  return { ...e, fromText, toText, displayText };
}

export function auditRows(s: S, rows: readonly AuditLogEntry[]): AuditRowView[] {
  return rows.map((e) => auditRow(s, e));
}

// ───────────────────────── 재고 (S-09) ─────────────────────────

export function inventoryView(s: S, ds: MasilDataset): InventoryView {
  const table = skuCoverTable(ds);
  const today = kstDate(s.simNow);
  const linesBySku = new Map<string, string[]>();
  for (const l of s.lines) for (const k of inventoryGate(ds, l, s.simNow).skus) linesBySku.set(k.skuId, [...(linesBySku.get(k.skuId) ?? []), l.id]);
  const rows = table.map((r) => ({
    skuId: r.skuId,
    name: r.name,
    category: r.category,
    product: ds.skus.find((k) => k.id === r.skuId)?.productId ?? '',
    cover: r.coverWeeks === null ? null : num(r.coverWeeks, 'AGGREGATED', INV_REFS, 'on_hand / 최근 4주 평균 (R-INV-01, in_transit 미합산)'),
    reported: num(r.stockCoverWeeksReported, 'ORIGINAL', [{ file: F.inventory, column: 'stock_cover_weeks', rowKey: r.skuId }]),
    avg: num(r.avg4w, 'AGGREGATED', [{ file: F.weeklySales }], '최근 4주 sold_qty 평균'),
    onHand: num(r.onHandQty, 'ORIGINAL', [{ file: F.inventory, column: 'on_hand_qty', rowKey: r.skuId }]),
    inTransit: num(r.inTransitQty, 'ORIGINAL', [{ file: F.inventory, column: 'in_transit_qty', rowKey: r.skuId }]),
    minWeeks: r.safetyStockWeeksMin,
    maxWeeks: r.safetyStockWeeksMax,
    leadTimeWeeks: r.leadTimeWeeks,
    moq: r.moq,
    belowMin: r.belowMin,
    stockoutDate: r.stockoutDate,
    pos: ds.purchaseOrders.filter((p) => p.skuId === r.skuId).map((p) => ({ id: p.id, qty: p.orderQty, arrival: expectedArrivalDate(p) })),
    lines: linesBySku.get(r.skuId) ?? [],
  }));
  const pay = expectedPaymentDate(today);
  const suggestions = s.lines
    .filter((l) => l.flags.includes('INVENTORY_BELOW_MIN'))
    .map((l) => {
      const routing = routeReplenishment({ expectedPaymentDate: pay }, s.forecast.breachWindows, s.forecast.id);
      return {
        lineId: l.id,
        paymentDate: txt(pay, 'ASSUMPTION', [], '발주일(기준시각) + 25일', ['A-19']),
        routing: { requiredRole: routing.requiredRole, reasons: routing.reasons },
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
  return { rows, suggestions, replenishments: s.replenishments.map(replenishmentRow), simDate: today };
}

export function replenishmentRow(r: ReplenishmentRequest): ReplenishmentRowView {
  return {
    ...r,
    statusText: replenishmentStatusText(r),
    amount: money('FULL', r.amountKrw, 'AGGREGATED', [{ file: F.purchaseOrders, column: 'amount_krw' }, { file: F.sku, column: 'moq', rowKey: r.skuId }], `finalQty ${fmt(r.finalQty)} × 단가 ${fmt(r.unitCostKrw)}`, ['A-17', 'A-18']),
    unitCost: money('FULL', r.unitCostKrw, 'AGGREGATED', [{ file: F.purchaseOrders, column: 'amount_krw' }, { file: F.purchaseOrders, column: 'order_qty' }], '기발주 단가 = amount_krw / order_qty'),
    paymentDate: txt(r.expectedPaymentDate, 'ASSUMPTION', [], '초안 생성일(기준시각) + 25일', ['A-19']),
  };
}

// ───────────────────────── 자금 (S-10) ─────────────────────────

function runView(r: CashSimResult): CashRunView {
  return { id: r.id, windows: r.breachWindows, businessDays: r.breachBusinessDays, min: money('FULL', r.minClosing.krw, 'AGGREGATED', CASH_REFS, `최저 종가 @ ${r.minClosing.date}`, r.assumptionIds), minDate: r.minClosing.date, daily: r.daily, assumptionIds: r.assumptionIds };
}

export function cashView(s: S, ds: MasilDataset, opts: { sensitivity?: boolean; version?: string } = {}): CashView {
  const v1 = forecastV1(ds);
  const cur = s.forecast;
  const live = s.replenishments.filter((r) => r.status === 'SUBMITTED' || r.status === 'APPROVED' || r.status === 'INFO_REQUESTED');
  const extra = live.length
    ? simulateCash(ds, { id: `${cur.id}+extra`, arDueOverrides: { ...s.arDueOverrides }, extraOutflows: live.map((r) => ({ id: r.id, date: r.expectedPaymentDate, amountKrw: r.amountKrw })) })
    : null;
  const sens = opts.sensitivity ? simulateCash(ds, { id: `${cur.id}-sensitivity`, arDueOverrides: { ...s.arDueOverrides }, overdueAr: 'EXCLUDE', overdueAp: 'AS_OF' }) : null;
  const officialMin = ds.officialForecast.reduce((m, w) => Math.min(m, w.projectedClosingKrw), Number.POSITIVE_INFINITY);
  // BE-10: 대조 기준 버전 — 'v1' 이면 최초 재전망, 그 외(current · v2 · 현재 id)는 현재 재전망
  const cmpRun = opts.version === 'v1' || opts.version === v1.id ? v1 : cur;
  const rows = compareOfficialForecast(cmpRun, ds.officialForecast);
  // 「② 이후 변경」: v1 과 같은 주의 재전망 값 · 하회 영업일 수 비교 (v1 기준 대조면 비교하지 않음)
  const v1Rows = cmpRun === v1 ? null : new Map(compareOfficialForecast(v1, ds.officialForecast).map((r) => [r.week, r]));
  const A32 = ['A-08', 'A-09', 'A-32'];
  const officialRef = (week: string): SourceRef[] => [{ file: F.cashForecast, column: 'projected_closing_krw', rowKey: week }];
  const gap = largestOfficialGap(rows);
  const poTotal = ds.purchaseOrders.reduce((a, p) => a + p.amountKrw, 0);
  return {
    current: { ...runView(cur), opening: money('FULL', cur.opening, 'ORIGINAL', [{ file: F.cashDaily, column: 'closing_balance', rowKey: '2026-06-30' }]) },
    v1: runView(v1),
    sensitivity: sens ? runView(sens) : null,
    extraOutflow: extra
      ? { ...runView(extra), outflows: live.map((r) => ({ id: r.id, date: r.expectedPaymentDate, amount: money('FULL', r.amountKrw, 'AGGREGATED', [{ file: F.purchaseOrders }], '보충 발주 금액 — 원본 전망분과 분리 (R-CASH-04)', ['A-17', 'A-18', 'A-19']) })) }
      : null,
    covenant: money('FULL', cur.covenantMinKrw, 'ORIGINAL', [{ file: DOC_FILES.covenant }], '매 영업일 종가 ≥ 30억'),
    poPayment: poPaymentTotal(ds),
    overrides: Object.entries(s.arDueOverrides).map(([ar, d]) => ({ ar, date: d, label: 'MOCK' as const })),
    official: ds.officialForecast.map((w) => ({ week: w.week, closing: money('FULL', w.projectedClosingKrw, 'CLAIM', [{ file: F.cashForecast, column: 'projected_closing_krw', rowKey: w.week }], '재무팀 공식 전망 — 주장') })),
    compareVersion: cmpRun.id,
    officialComparison: rows.map((r) => ({
      week: r.week,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      official: money('FULL', r.official, 'CLAIM', officialRef(r.week), '재무팀 공식 전망 — 주장 (판단 입력 아님)'),
      recalculated: money('FULL', r.recalculated, 'AGGREGATED', CASH_REFS, `재전망 ${cmpRun.id} 의 ${r.week} 종가 (A-32 주간 대응)`, A32),
      diff: money('FULL', r.diff, 'AGGREGATED', [...CASH_REFS, ...officialRef(r.week)], '재전망 − 공식 전망', A32),
      belowThreshold: r.belowThreshold,
      belowDays: r.belowDays,
      ...(() => {
        const o = v1Rows?.get(r.week);
        const changed = !!o && (o.recalculated !== r.recalculated || o.belowDays !== r.belowDays);
        return {
          changedFromV1: changed,
          v1Recalculated: changed ? money('FULL', o!.recalculated, 'AGGREGATED', CASH_REFS, `최초 재전망 ${v1.id} 의 ${r.week} 종가 (A-32 주간 대응)`, A32) : null,
          v1BelowDays: changed ? o!.belowDays : null,
        };
      })(),
    })),
    largestGap: gap
      ? {
          week: gap.week,
          diff: money('FULL', gap.diff, 'AGGREGATED', [...CASH_REFS, ...officialRef(gap.week)], '|재전망 − 공식| 최대 주', A32),
          notes: [
            txt(`7/21 기발주 ${ds.purchaseOrders.length}건 대금 ${fmt(poTotal)}원이 공식 전망에 반영되지 않은 것으로 추정 — 원인 미확인`, 'INTERPRETED', [{ file: F.purchaseOrders, column: 'amount_krw' }, ...officialRef(gap.week)], '공식 주간 유출 규모와 기발주 지급일 대조'),
            txt(`나머지 차이 ${fmt(Math.max(Math.abs(gap.diff) - poTotal, 0))}원은 미확인`, 'INTERPRETED', officialRef(gap.week), '|차이| − 기발주 대금'),
          ],
        }
      : null,
    diffNotes: [
      `재무팀 공식 전망(주장)은 하회 없음(주간 최저 ${fmt(officialMin)}원) — 재전망은 ${cur.breachWindows.map((w) => `${w.start}~${w.end}`).join(', ') || '하회 없음'}`,
      `차이 원인(추정): 기발주 ${ds.purchaseOrders.length}건 대금 ${fmt(ds.purchaseOrders.reduce((a, p) => a + p.amountKrw, 0))}원 일괄 지급이 공식 전망에 보이지 않음 — 원인 확정은 미확인`,
      '기안 요청액(표본)은 이 전망에 포함하지 않음 (R-CASH-04)',
    ],
    diffNotesSourced: [
      txt(`재무팀 공식 전망: 30억 하회 없음 (주간 최저 ${fmt(officialMin)}원)`, 'CLAIM', [{ file: F.cashForecast, column: 'projected_closing_krw' }], '공식 전망 13주 종가 최솟값 — 주장, 판단 입력 아님'),
      txt(`재전망 ${cur.id}: 하회 구간 ${cur.breachWindows.map((w) => `${w.start}~${w.end}`).join(', ') || '없음'}`, 'AGGREGATED', CASH_REFS, '매 영업일 종가 < 30억 구간 (R-CASH-02)', cur.assumptionIds),
      txt(`차이 원인(추정): 기발주 ${ds.purchaseOrders.length}건 대금 ${fmt(poTotal)}원 일괄 지급이 공식 전망 유출에 보이지 않음 — 원인 미확인`, 'INTERPRETED', [{ file: F.purchaseOrders, column: 'amount_krw' }, { file: F.cashForecast, column: 'projected_outflow_krw' }], '기발주 지급일과 공식 주간 유출 규모 대조'),
      txt('기안 요청액(표본)은 이 전망에 포함하지 않음 (R-CASH-04)', 'ORIGINAL', [{ file: DOC_FILES.meetingNotes, note: '본 기안은 자금 전망 유출 산식에 포함되지 않는다' }]),
    ],
    cashEvents: cashEvents(ds, cur.options.arDueOverrides ?? {}),
    linesInWindow: s.lines.filter((l) => l.flags.includes('IN_COVENANT_WINDOW')).map((l) => ({ id: l.id, settlementDate: l.settlementDate, role: l.routing?.requiredRole ?? null, status: LINE_STATUS_KO[l.status] })),
  };
}

/** S-10 이벤트 표 — 재전망 입력 행 (domain cashFlowItems 그대로, 출처 파일 · 행만 붙인다) */
const EXCLUDED_KO = {
  OVERDUE_EXCLUDED: '기준일(7/1) 이전 만기 — 재전망 기본 제외 (A-08, 민감도에서만 반영)',
  AP_LINKED_TO_PO: '발주 대금과 같은 건(po_id 있음) — 이중계상 방지로 제외 (calculation_definitions 1.2)',
  AFTER_HORIZON: '전망 기간(기준일 + 90일) 밖',
} as const;

export function cashEvents(ds: MasilDataset, arDueOverrides: Record<string, string>): CashEventRowView[] {
  const fileOf = { AR: F.ar, AP: F.ap, PO: F.purchaseOrders } as const;
  const colOf = { AR: 'outstanding_krw', AP: 'amount_krw', PO: 'amount_krw' } as const;
  return cashFlowItems(ds, { arDueOverrides }).map((it) => {
    const kind = it.source === 'AR' ? 'AR_INFLOW' : it.source === 'AP' ? 'AP_OUTFLOW' : 'PO_PAYMENT';
    const ref: SourceRef = { file: fileOf[it.source], column: colOf[it.source], rowKey: it.id, row: it.index + 1 };
    const who = it.source === 'AR' ? ds.ar[it.index]!.channelId : it.source === 'AP' ? ds.ap[it.index]!.supplierId : ds.purchaseOrders[it.index]!.skuId;
    const item = it.source === 'AR' ? `AR ${it.id} 회수 · ${who}` : it.source === 'AP' ? `AP ${it.id} 지급 · ${who}` : `발주 ${it.id} 대금 · ${who}`;
    const moved = it.overrideDate !== null;
    const assumptionIds = it.excluded === 'OVERDUE_EXCLUDED' ? ['A-08'] : it.date && (moved ? it.overrideDate : it.sourceDate) !== it.date ? ['A-09'] : [];
    return {
      id: it.id,
      kind,
      item: moved ? `${item} (회수 지연: ${it.sourceDate} → ${it.overrideDate}, 모의)` : item,
      direction: it.amountKrw >= 0 ? 'IN' : 'OUT',
      amount: money('FULL', Math.abs(it.amountKrw), 'ORIGINAL', [ref]),
      sourceDate: it.sourceDate,
      date: it.date,
      included: it.excluded === null,
      excludedReason: it.excluded ? EXCLUDED_KO[it.excluded] : null,
      ref,
      label: moved ? 'MOCK' : 'ORIGINAL',
      assumptionIds,
    };
  });
}

// ───────────────────────── AR 목록 (S-02 회수 지연 양식) ─────────────────────────

export function receivablesView(s: S, ds: MasilDataset): ReceivableView[] {
  const items = new Map(cashFlowItems({ ar: ds.ar, ap: [], purchaseOrders: [] }, { arDueOverrides: s.forecast.options.arDueOverrides ?? {} }).map((i) => [i.id, i]));
  return ds.ar.map((a, i) => {
    const ref: SourceRef = { file: F.ar, rowKey: a.id, row: i + 1 };
    const ov = s.arDueOverrides[a.id];
    return {
      id: a.id,
      channelId: a.channelId,
      invoiceDate: a.invoiceDate,
      originalDue: txt(a.dueDate, 'ORIGINAL', [{ ...ref, column: 'due_date' }]),
      currentDue: ov ? txt(ov, 'MOCK', [{ ...ref, column: 'due_date' }], '회수 지연 사건(모의)으로 바뀐 만기') : txt(a.dueDate, 'ORIGINAL', [{ ...ref, column: 'due_date' }]),
      overridden: !!ov,
      amount: money('FULL', a.amountKrw, 'ORIGINAL', [{ ...ref, column: 'amount_krw' }]),
      outstanding: money('FULL', a.outstandingKrw, 'ORIGINAL', [{ ...ref, column: 'outstanding_krw' }]),
      agingDays: a.agingDays,
      overdue: a.dueDate < AS_OF,
      inForecast: items.get(a.id)?.excluded === null,
      ref,
    };
  });
}

// ───────────────────────── 데이터 출처 (S-12) ─────────────────────────

const USED_IN: Partial<Record<MasilFileKey, string>> = {
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

/**
 * BE-12 공백 상태 — 모의 회신으로 보완된 공백은 FILLED_BY_MOCK. 원본 공백 자체는 남으므로 '해소'(open:false)로 돌려주지 않는다.
 * G-02: 에이전시 정보 제공(A-33) · G-03: 수령확인 · G-08: SCM/Corevia 회신으로 공급 전망 · 입고일이 정해짐
 */
export function gapStatus(s: S, id: string): GapStatus {
  if (id === 'G-02' && s.contract.performanceFeeTerms !== null) return 'FILLED_BY_MOCK';
  if (id === 'G-03' && s.receipts.length > 0) return 'FILLED_BY_MOCK';
  if (id === 'G-08' && s.lines.some((l) => (l.supplyOutlook ?? 'UNKNOWN') !== 'UNKNOWN' || !!l.inboundExpectedDate)) return 'FILLED_BY_MOCK';
  return 'OPEN';
}

export function registryView(s: S, rowCounts: Record<MasilFileKey, number>): RegistryView {
  const scaleKo = { FULL: '풀스케일', SAMPLE: '표본', NONE: '-' } as const;
  return {
    sources: (Object.keys(F) as MasilFileKey[]).map((k) => ({ file: F[k], rows: rowCounts[k], scale: scaleKo[FILE_SCALE[k]], label: k === 'cashForecast' ? 'CLAIM' : 'ORIGINAL', usedIn: USED_IN[k] ?? '마스터' })),
    assumptions: ASSUMPTIONS,
    gaps: GAPS.map((g) => {
      const status = gapStatus(s, g.id);
      return { ...g, open: true, status, statusText: status === 'FILLED_BY_MOCK' ? '모의 회신으로 보완 — 원본 공백은 그대로' : '미확인' };
    }),
    claims: CLAIMS,
    mocks: MOCK_REPLY_DATASET,
    inconsistencies: INCONSISTENCIES,
  };
}
