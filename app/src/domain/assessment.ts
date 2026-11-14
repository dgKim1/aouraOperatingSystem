/**
 * 판단안의 결정적 근거 (순수 함수) — "계산은 코드, 해석은 AI" (CLAUDE.md 규칙 9, DD-002 · DD-016).
 *
 * buildAssessmentBasis 가 만드는 것:
 *   - facts: 도메인 계산 결과만 (AssessmentFact = key · name · Sourced 값). 주장(CLAIM)은 넣지 않는다 (R-CLAIM-01).
 *   - ruleResults: 규칙 ID · 결과 · 입력값.
 *   - alternatives: 대안별 효과(사실 숫자만) · 위험 · 필요한 권한자(규칙 엔진 결과, AI 가 정하지 않음).
 *   - proposedDecisions: 승인요청 proposed 로 쓰는 규칙 권고 (기안 건 = recommendLine).
 *   - claimsCited: 예상 GMV · 회의록 등 주장 인용 (판단 입력 아님).
 *   - narrative(모의 문장): AI 가 없을 때의 결정적 문장. 숫자는 facts/ruleResults 의 값만 쓴다.
 * AI(실시간)는 이 근거를 도구로 읽어 문장(권고 이유 · 관점별 근거)만 다시 쓴다. 상태는 바꾸지 않는다.
 */
import { CONTRACT_LIMIT_KRW, LINE_LIMIT_KRW, PROPOSAL_LIMIT_KRW, roleRank, routeContract, routeReplenishment } from './authority';
import { simulateCash } from './cash';
import type { MasilDataset } from './dataset';
import { daysLeft, deadlineLevel, decisionNeededBy } from './deadline';
import { DomainError } from './errors';
import { DOC_FILES } from './files';
import { inventoryGate } from './inventory';
import { decisionText, LINE_STATUS_KO, CONTRACT_STATUS_KO } from './labels';
import { penalty, renewalTerm } from './penalty';
import { computePerformance, influencerShares, rankBy, requestShareRemaining } from './performance';
import { CLAIMS, GAPS } from './registry';
import { CONTRACT_REFS } from './seed';
import { CASH_REFS, INV_REFS, money, num, PERF_ASSUMPTIONS, PERF_REFS, planRef, txt } from './sourced';
import type {
  Alternative,
  ApproverRole,
  AssessmentFact,
  AssessmentRuleResult,
  CampaignPerformance,
  Sourced,
  SourceRef,
  SubjectType,
} from './types';
import { ROLE_KO } from './types';
import { recommendLine, type WorldState } from './workflow';

export interface AssessmentSubject {
  subjectType: SubjectType;
  subjectIds: string[];
}

export interface Narrative {
  recommendation: { alternativeId: string; rationale: string };
  perspectives: { marketing: string; finance: string; contract: string; scm: string };
}

export interface AssessmentBasis extends AssessmentSubject {
  triggerEventId: string | null;
  facts: AssessmentFact[];
  ruleResults: AssessmentRuleResult[];
  alternatives: Alternative[];
  /** AI 가 고를 수 있는 권고 대안 ID (기안 건은 규칙 권고안 'A' 하나 — 건별 권고는 규칙이 정한다) */
  allowedAlternativeIds: string[];
  proposedDecisions: { itemId: string; decision: string; condition?: string }[];
  claimsCited: { text: string; ref: SourceRef }[];
  unknowns: { gapId: string; impact: string }[];
  /** 모의 모드 문장 (결정적) */
  mockNarrative: Narrative;
}

const fmt = (n: number) => Math.round(n).toLocaleString('ko-KR');
const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const gap = (id: string, impact?: string) => ({ gapId: id, impact: impact ?? GAPS.find((g) => g.id === id)?.handling ?? '' });

// 성과 계산 캐시 (원본은 바뀌지 않는다)
const perfCache = new WeakMap<MasilDataset, { campaign: Record<string, CampaignPerformance>; influencer: Record<string, CampaignPerformance> }>();
function perf(ds: MasilDataset) {
  let p = perfCache.get(ds);
  if (!p) perfCache.set(ds, (p = { campaign: computePerformance(ds, 'CAMPAIGN'), influencer: computePerformance(ds, 'INFLUENCER') }));
  return p;
}

export function buildAssessmentBasis(s: WorldState, ds: MasilDataset, subject: AssessmentSubject): AssessmentBasis {
  if (subject.subjectIds.length === 0) throw new DomainError('VALIDATION', '판단 대상(subjectIds)이 비어 있음');
  const triggerEventId = s.events.at(-1)?.id ?? null;
  if (subject.subjectType === 'CONTRACT') return { ...contractBasis(s, ds, subject.subjectIds), triggerEventId };
  if (subject.subjectType === 'EXPANSION_LINES') return { ...linesBasis(s, ds, subject.subjectIds), triggerEventId };
  return { ...replenishmentBasis(s, ds, subject.subjectIds), triggerEventId };
}

type Partial0 = Omit<AssessmentBasis, 'triggerEventId'>;

// ───────────────────────── 계약 ─────────────────────────

/** 계약 정보 요청(성과 피)이 기한 전에 오지 않았나 — 에이전시 '정보 부족' · '거절' 회신 결과 */
function contractInfoResult(s: WorldState): { outcome: string; note: string } | null {
  const t = [...s.tasks].reverse().find((x) => x.type === 'INFO_REQUEST' && x.subjectType === 'CONTRACT' && x.status === 'DONE' && x.resultNote);
  if (!t?.resultNote) return null;
  const [outcome, ...rest] = t.resultNote.split(':');
  return { outcome: (outcome ?? '').trim(), note: rest.join(':').trim() };
}

function contractBasis(s: WorldState, ds: MasilDataset, ids: string[]): Partial0 {
  const c = s.contract;
  if (ids.length !== 1 || ids[0] !== c.id) throw new DomainError('NOT_FOUND', `전속계약 없음: ${ids.join(',')}`);
  const r = routeContract(c);
  const term = renewalTerm(c);
  const days = daysLeft(s.simNow, c.noticeDeadline);
  const level = deadlineLevel(s.simNow, c.noticeDeadline);
  const inf = c.influencerId;
  const infName = ds.influencers.find((i) => i.id === inf)?.name ?? inf;
  const p = perf(ds).influencer;
  const list = Object.values(p);
  const cpRank = rankBy(list, (x) => x.cp)[inf]!;
  const roasRank = rankBy(list, (x) => x.realRoas ?? Number.NEGATIVE_INFINITY)[inf]!;
  const mine = p[inf]!;
  const sh = influencerShares(ds)[inf]!;
  const renewed = c.status === 'AUTO_RENEWED' || c.status === 'RENEWED_APPROVED';
  const info = contractInfoResult(s);
  const infoMissing = info !== null && info.outcome !== 'INFO_PROVIDED';
  const remaining = s.lines.some((l) => l.status === 'REJECTED' || l.status === 'CANCELLED') ? requestShareRemaining(ds, s.lines) : null;

  const facts: AssessmentFact[] = [
    { key: 'contract.status', name: '계약 상태', value: txt(c.status, 'AGGREGATED', [], `운영 상태 (처리 이력) — ${CONTRACT_STATUS_KO[c.status]}`) },
    { key: 'contract.fixedFee', name: '고정 피 (연)', value: money('FULL', c.fixedFeeAnnualKrw, 'ORIGINAL', CONTRACT_REFS) },
    { key: 'contract.annualAmount', name: '연 금액 (하한)', value: money('FULL', r.annualAmountKrw, 'AGGREGATED', [...CONTRACT_REFS, { file: DOC_FILES.policy }], '고정 피 + 성과 피(미확인 → 하한)') },
    { key: 'contract.noticeDeadline', name: '통보 기한', value: txt(c.noticeDeadline, 'ORIGINAL', CONTRACT_REFS) },
    { key: 'contract.daysLeft', name: '통보 기한까지 남은 일수', value: num(days, 'AGGREGATED', CONTRACT_REFS, '통보 기한 − 기준시각 (달력일, R-DL-03)') },
    { key: 'contract.currentTermEnd', name: '현 계약 만료', value: txt(c.currentTermEnd, 'ORIGINAL', CONTRACT_REFS) },
    { key: 'contract.autoRenewalTermMonths', name: '미통보 시 자동 갱신 기간(개월)', value: num(c.autoRenewalTermMonths, 'ORIGINAL', CONTRACT_REFS) },
    { key: 'contract.renewalTerm', name: '갱신 시 계약 기간', value: txt(`${term.start} ~ ${term.end}`, 'AGGREGATED', CONTRACT_REFS, '만료 다음 날부터 12개월') },
    { key: 'contract.performanceFee', name: '성과 피 조건', value: txt(c.performanceFeeTerms ?? '미확인 (G-02)', c.performanceFeeTerms ? 'MOCK' : 'ORIGINAL', CONTRACT_REFS, c.performanceFeeTerms ? '에이전시 모의 회신' : '통보서에 "GMV 연동, 별도 정산"만 있음') },
    { key: `perf.${inf}.adSpendShare`, name: `${inf} 집행 비중 (표본)`, value: num(sh.adSpendShare, 'AGGREGATED', PERF_REFS, 'Spend_i / ΣSpend (R-CP-04)') },
    { key: `perf.${inf}.adSpendRank`, name: `${inf} 집행 비중 순위`, value: num(sh.adSpendRank, 'AGGREGATED', PERF_REFS, '내림차순 (R-CP-04)') },
    { key: `perf.${inf}.requestShare`, name: `${inf} 기안 요청 비중 (표본)`, value: num(sh.requestShare, 'AGGREGATED', planRef('requested_budget_krw'), 'Request_i / ΣRequest (R-CP-04)') },
    { key: `perf.${inf}.requestRank`, name: `${inf} 기안 요청 비중 순위`, value: num(sh.requestRank, 'AGGREGATED', planRef('requested_budget_krw'), '내림차순 (R-CP-04)') },
    { key: `perf.${inf}.cp`, name: `${inf} 실질 공헌이익 (공식값 A05, 표본)`, value: money('SAMPLE', mine.cp, 'AGGREGATED', PERF_REFS, 'R-CP-01 A05 단일 차감', PERF_ASSUMPTIONS) },
    { key: `perf.${inf}.cpRank`, name: `${inf} 실질 공헌이익 순위`, value: num(cpRank, 'AGGREGATED', PERF_REFS, '공식값 내림차순 (R-CP-04)') },
    { key: `perf.${inf}.nominalRoas`, name: `${inf} 명목 ROAS`, value: num(mine.nominalRoas ?? 0, 'AGGREGATED', PERF_REFS, 'GMV / Marketing Spend (R-CP-03)') },
    { key: `perf.${inf}.realRoas`, name: `${inf} 실질 ROAS (공식)`, value: num(mine.realRoas ?? 0, 'AGGREGATED', PERF_REFS, 'cp / Marketing Spend (R-CP-03)') },
    { key: `perf.${inf}.realRoasRank`, name: `${inf} 실질 ROAS 순위`, value: num(roasRank, 'AGGREGATED', PERF_REFS, '내림차순 (R-CP-04)') },
    { key: 'perf.influencerCount', name: '비교 인플루언서 수', value: num(list.length, 'AGGREGATED', [{ file: '02_masil/master/m_influencer_ms.csv' }], '행 수') },
  ];
  if (remaining) {
    facts.push({ key: `perf.${inf}.requestShareRemaining`, name: `${inf} 남은 기안 요청 비중 (부결 · 취소 제외)`, value: num(remaining.shares[inf] ?? 0, 'AGGREGATED', planRef('requested_budget_krw'), 'R-CP-06') });
  }
  if (info) {
    facts.push({ key: 'contract.infoRequest.result', name: '성과 피 정보 요청 결과', value: txt(`${info.outcome}: ${info.note}`, 'MOCK', [], '에이전시 모의 회신 (기한 전 정보 미도착 여부)') });
  }
  const penaltyDates = ['2026-09-30', '2026-12-31'];
  if (renewed) {
    facts.push({ key: 'contract.committedTerm', name: '갱신으로 확정된 고정 피', value: money('FULL', c.fixedFeeAnnualKrw, 'ORIGINAL', CONTRACT_REFS, `원본 조건 · 상태 ${c.status}`) });
    for (const d of penaltyDates) {
      const pen = penalty(c, d);
      facts.push({ key: `contract.penalty.${d}`, name: `${d} 중도 해지 위약금`, value: money('FULL', pen.amountKrw, 'AGGREGATED', CONTRACT_REFS, `고정 피 × 잔여 ${pen.remainingMonths}개월/12 × 50% (R-PEN-01, 원 단위 내림)`, pen.assumptionIds) });
      facts.push({ key: `contract.penalty.${d}.months`, name: `${d} 해지 시 잔여 개월`, value: num(pen.remainingMonths, 'AGGREGATED', CONTRACT_REFS, 'R-PEN-01') });
    }
  }

  const ruleResults: AssessmentRuleResult[] = [
    { ruleId: 'R-AUTH-02', result: r.requiredRole, inputs: { annualAmountKrw: r.annualAmountKrw, limitKrw: CONTRACT_LIMIT_KRW, lowerBound: r.annualAmountIsLowerBound }, subjectId: c.id },
    { ruleId: 'R-DL-03', result: level, inputs: { deadline: c.noticeDeadline, daysLeft: days }, subjectId: c.id },
    { ruleId: 'R-DL-02', result: renewed ? c.status : 'AUTO_RENEW_IF_NO_VALID_NOTICE', inputs: { noticeDeadline: c.noticeDeadline, status: c.status, autoRenewalTermMonths: c.autoRenewalTermMonths }, subjectId: c.id },
  ];
  const linked = s.lines.filter((l) => l.influencerId === inf && l.flags.includes('CONTRACT_PENDING'));
  if (linked.length > 0) ruleResults.push({ ruleId: 'R-CON-01', result: 'CONTRACT_PENDING', inputs: { lineIds: linked.map((l) => l.id) }, subjectId: c.id });
  if (renewed) ruleResults.push({ ruleId: 'R-PEN-01', result: penaltyDates.map((d) => ({ terminateOn: d, amountKrw: penalty(c, d).amountKrw })), inputs: { fixedFeeAnnualKrw: c.fixedFeeAnnualKrw, rate: c.earlyTerminationPenaltyRate }, subjectId: c.id });

  const role = r.requiredRole;
  const fee = fmt(c.fixedFeeAnnualKrw);
  let alternatives: Alternative[];
  let allowed: string[];
  let rec: Narrative['recommendation'];
  if (renewed) {
    alternatives = [
      { id: 'A', title: '갱신 계약 유지', decision: 'KEEP', effects: [{ value: `${term.start} ~ ${term.end} 고정 피 ${fee}원 확정 [원본 조건 · 상태 ${c.status}]`, label: 'ORIGINAL', refs: CONTRACT_REFS, scale: 'FULL' }], risks: ['표본상 집행 1위 · 실질 공헌이익 하위 인플루언서에 1년 배분 선점 (방향만)'], requiresRole: role },
      ...penaltyDates.map((d, i) => {
        const pen = penalty(c, d);
        return {
          id: String.fromCharCode(66 + i),
          title: `${d} 중도 해지`,
          decision: 'TERMINATE',
          effects: [{ value: `위약금 ${fmt(pen.amountKrw)}원 (잔여 ${pen.remainingMonths}개월, 월할 균등 가정)`, label: 'AGGREGATED' as const, refs: CONTRACT_REFS, scale: 'FULL' as const, assumptionIds: pen.assumptionIds }],
          risks: ['해지는 위약금이 붙는 새 결정 (R-PEN-01)', '풀스케일 금액 — 표본 성과와 곱하지 않음'],
          requiresRole: role,
        };
      }),
    ];
    allowed = ['A', 'B', 'C', 'NONE'];
    rec = { alternativeId: 'NONE', rationale: `자동 갱신 후 해지는 위약금(R-PEN-01)이 붙는 새 결정 — 규칙상 권고 없음, ${ROLE_KO[role]} 결정 사항. 위약금은 풀스케일 금액이며 표본 성과와 곱하지 않는다.` };
  } else {
    const doNothing = c.status === 'REVIEW_BEFORE_DEADLINE' || infoMissing;
    alternatives = [
      {
        id: 'A',
        title: '동일 조건 갱신',
        decision: 'RENEW_SAME',
        effects: [
          { value: `${term.start} ~ ${term.end} 고정 피 ${fee}원 선점`, label: 'ORIGINAL', refs: CONTRACT_REFS, scale: 'FULL' },
          ...(doNothing ? [{ value: `아무것도 하지 않아도 ${c.noticeDeadline} 경과 시 같은 결과 — 자동 갱신(= 권한 미경유 체결)`, label: 'ORIGINAL' as const, refs: CONTRACT_REFS, scale: 'NONE' as const }] : []),
        ],
        risks: ['표본상 집행 비중 상위 · 실질 공헌이익 하위와 반대 방향 (방향만)'],
        requiresRole: role,
      },
      { id: 'B', title: '조건변경 통보', decision: 'RENEGOTIATE', effects: [{ value: '기한 전 통보로 자동 갱신 차단 (수령확인까지 필요, 확장 E1)', label: 'ORIGINAL', refs: CONTRACT_REFS, scale: 'NONE' }], risks: ['조건 내용은 수치로 만들지 않음 (A-23)', '성과 피 조건 미확인 (G-02)'], requiresRole: role },
      { id: 'C', title: '해지 통보', decision: 'TERMINATE', effects: [{ value: `만료(${c.currentTermEnd}) 전 통보 — 위약금 조항은 갱신 후 중도 해지에만 적용`, label: 'INTERPRETED', refs: CONTRACT_REFS, scale: 'NONE' }], risks: ['대체 파트너 · 공백 기간 필요', '만료 후 재협상 여지는 가정 (A-23)'], requiresRole: role },
    ];
    allowed = ['A', 'B', 'C'];
    rec = infoMissing
      ? { alternativeId: 'C', rationale: '성과 피 정보가 기한 전에 오지 않음 — 성과 피를 모른 채 결정해야 한다. 아무것도 하지 않으면 대안 A(자동 갱신)와 같은 결과이고, 통보(B 또는 C)만이 기한 후 선택지를 남긴다. 해지 통보 후 재협상 여지는 가정(A-23).' }
      : { alternativeId: 'B', rationale: '자동 갱신을 막고 협상 여지를 남긴다. 표본 성과는 비중 · 순위 · 방향까지이며 28억과 곱하지 않는다. 총 보수는 성과 피 미확인(G-02)으로 하한만 확정.' };
  }

  const perspectives: Narrative['perspectives'] = {
    marketing: `${infName}(${inf}) 집행 비중 ${pct(sh.adSpendShare)}(${sh.adSpendRank}위) · 기안 요청 비중 ${pct(sh.requestShare)}(${sh.requestRank}위)인데 실질 공헌이익(공식값) ${fmt(mine.cp)}원으로 ${cpRank}위 — 배분이 성과를 따라가지 않음 (표본, 비중 · 순위 · 방향까지).`,
    finance: `연 금액 하한 ${fmt(r.annualAmountKrw)}원 > 10억원 → ${ROLE_KO[role]} (R-AUTH-02). 고정 피 지급 일정 미확인(G-09)으로 covenant 대조는 판정 불가. 표본 성과 금액은 28억과 더하거나 곱하지 않는다.`,
    contract: renewed
      ? `통보 기한 ${c.noticeDeadline} 경과 — ${CONTRACT_STATUS_KO[c.status]}. ${term.start} ~ ${term.end} 고정 피 확정, 중도 해지는 위약금(R-PEN-01) 대상.`
      : `통보 기한 ${c.noticeDeadline}(남은 ${days}일)까지 유효 통보가 없으면 동일 조건 ${c.autoRenewalTermMonths}개월 자동 갱신 = 권한 미경유 체결. 통보는 수령확인까지 추적 (E1).${infoMissing ? ' 성과 피 정보는 기한 전 미도착.' : ''}`,
    scm: '해당 없음 — 계약 판단은 재고에 직접 영향 없음.',
  };

  const unknownIds = ['G-01', ...(c.performanceFeeTerms === null ? ['G-02'] : []), ...(s.receipts.length === 0 ? ['G-03'] : []), 'G-04', 'G-09'];
  return {
    subjectType: 'CONTRACT',
    subjectIds: [c.id],
    facts,
    ruleResults,
    alternatives,
    allowedAlternativeIds: allowed,
    proposedDecisions: rec.alternativeId === 'NONE' ? [] : [{ itemId: c.id, decision: alternatives.find((a) => a.id === rec.alternativeId)!.decision }],
    claimsCited: [CLAIMS[1]!, CLAIMS[2]!, CLAIMS[0]!],
    unknowns: unknownIds.map((g) => gap(g, g === 'G-02' && infoMissing ? '성과 피 정보가 기한 전에 오지 않음 — 총 보수는 하한만 확정' : undefined)),
    mockNarrative: { recommendation: rec, perspectives },
  };
}

// ───────────────────────── 기안 건 ─────────────────────────

function linesBasis(s: WorldState, ds: MasilDataset, ids: string[]): Partial0 {
  const lines = ids.map((id) => {
    const l = s.lines.find((x) => x.id === id);
    if (!l) throw new DomainError('NOT_FOUND', `기안 건 없음: ${id}`);
    if (!l.routing) throw new DomainError('INVALID_TRANSITION', `${id}: 확인(라우팅) 전 — 판단할 수 없음`);
    return l;
  });
  const cperf = perf(ds).campaign;
  const facts: AssessmentFact[] = [];
  const ruleResults: AssessmentRuleResult[] = [];
  const proposed: AssessmentBasis['proposedDecisions'] = [];
  const total = s.proposal?.totalRequestedKrw ?? 0;
  facts.push({ key: 'proposal.total', name: '기안 총액 (권한 판정용)', value: money('SAMPLE', total, 'AGGREGATED', planRef('requested_budget_krw'), '25행 합 — 권한 판정에는 기안 요청액 그대로 (W02_TASK 3-3 원본근거해석)') });
  const windows = s.forecast.breachWindows;
  facts.push({ key: 'forecast.window', name: `covenant 하회 예상 구간 (${s.forecast.id})`, value: txt(windows.map((w) => `${w.start} ~ ${w.end}`).join(', ') || '없음', 'AGGREGATED', CASH_REFS, '영업일 종가 < 3,000,000,000 연속 구간 (R-CASH-03)', s.forecast.assumptionIds) });
  const gateNotes: string[] = [];
  for (const l of lines) {
    const p = cperf[l.campaignId];
    const rec = recommendLine(l);
    const k = (x: string) => `line.${l.id}.${x}`;
    facts.push(
      { key: k('requested'), name: `${l.id} 요청액`, value: money('SAMPLE', l.requestedKrw, 'ORIGINAL', planRef('requested_budget_krw', l.id)) },
      { key: k('settlementDate'), name: `${l.id} 집행일 (현금 유출일)`, value: txt(l.settlementDate, 'ORIGINAL', planRef('settlement_date', l.id), 'A-10 현금 유출일로 해석', ['A-10']) },
      { key: k('contractDeadline'), name: `${l.id} 확정기한`, value: txt(l.contractDeadline, 'ORIGINAL', planRef('contract_deadline', l.id)) },
      { key: k('daysLeft'), name: `${l.id} 확정기한까지 남은 일수`, value: num(daysLeft(s.simNow, l.contractDeadline), 'AGGREGATED', planRef('contract_deadline', l.id), '달력일 (R-DL-03)') },
      { key: k('requiredRole'), name: `${l.id} 권한자`, value: txt(l.routing!.requiredRole, 'AGGREGATED', [{ file: DOC_FILES.policy }], l.routing!.reasons.map((x) => x.ruleId).join(' · ')) },
      { key: k('status'), name: `${l.id} 상태`, value: txt(l.status, 'AGGREGATED', [], `운영 상태 — ${LINE_STATUS_KO[l.status]}`) },
    );
    if (p) {
      facts.push({ key: k('cp'), name: `${l.id} 확대 대상 캠페인(${l.campaignId}) 실질 공헌이익 (공식값)`, value: money('SAMPLE', p.cp, 'AGGREGATED', PERF_REFS, 'R-CP-01 A05 단일 차감', PERF_ASSUMPTIONS) });
    }
    const gate = inventoryGate(ds, l, s.simNow);
    for (const sku of gate.skus.filter((x) => x.belowMin)) {
      const sk = (x: string) => k(`sku.${sku.skuId}.${x}`);
      facts.push(
        { key: sk('cover'), name: `${l.id} 주력 SKU ${sku.skuId} 커버(주)`, value: num(sku.coverWeeks ?? 0, 'AGGREGATED', INV_REFS, 'on_hand / 최근 4주 평균 (R-INV-01)', ['A-16']) },
        { key: sk('minWeeks'), name: `${sku.skuId} 안전재고 min(주)`, value: num(sku.safetyStockWeeksMin, 'ORIGINAL', [{ file: '02_masil/master/m_sku_ms.csv', column: 'safety_stock_weeks_min', rowKey: sku.skuId }]) },
        { key: sk('stockoutDate'), name: `${sku.skuId} 예상 품절일`, value: txt(sku.stockoutDate ?? '-', 'AGGREGATED', INV_REFS, '스냅샷 + 커버×7일 (R-INV-02, in_transit 제외)', ['A-20']) },
        { key: sk('arrivalIfOrderedNow'), name: `${sku.skuId} 지금 발주 시 도착`, value: txt(sku.arrivalIfOrderedNow, 'AGGREGATED', [{ file: '02_masil/master/m_sku_ms.csv', column: 'lead_time_weeks', rowKey: sku.skuId }], '기준시각 + 리드타임 (R-INV-03)', ['A-20']) },
      );
      gateNotes.push(`${l.id} 주력 SKU ${sku.skuId} 커버 ${(sku.coverWeeks ?? 0).toFixed(2)}주 < ${sku.safetyStockWeeksMin}주, 예상 품절 ${sku.stockoutDate ?? '-'}, 지금 발주 시 도착 ${sku.arrivalIfOrderedNow} · 집행일 ${l.settlementDate}`);
    }
    if (l.supplyOutlook && l.supplyOutlook !== 'UNKNOWN') {
      facts.push({ key: k('supplyOutlook'), name: `${l.id} 공급 전망 (SCM 회신)`, value: txt(`${l.supplyOutlook}${l.inboundExpectedDate ? ` · 입고 ${l.inboundExpectedDate}` : ''}`, 'MOCK', [], 'SCM 모의 회신') });
    }
    const route = l.routing!;
    ruleResults.push({ ruleId: route.reasons[0]?.ruleId ?? 'R-AUTH-01', result: route.requiredRole, inputs: { settlementDate: l.settlementDate, requestedKrw: l.requestedKrw, proposalTotalKrw: total, lineLimitKrw: LINE_LIMIT_KRW, proposalLimitKrw: PROPOSAL_LIMIT_KRW, windows, alsoReportTo: route.alsoReportTo }, subjectId: l.id });
    if (p) ruleResults.push({ ruleId: 'R-CP-05', result: l.flags.includes('CP_NEGATIVE') ? 'CP_NEGATIVE' : 'CP_POSITIVE', inputs: { campaignId: l.campaignId, cp: p.cp }, subjectId: l.id });
    if (gate.flags.length > 0) ruleResults.push({ ruleId: 'R-INV-03', result: gate.flags, inputs: { settlementDate: l.settlementDate, skus: gate.skus.filter((x) => x.belowMin).map((x) => ({ skuId: x.skuId, coverWeeks: x.coverWeeks, stockoutDate: x.stockoutDate, arrivalIfOrderedNow: x.arrivalIfOrderedNow })) }, subjectId: l.id });
    if (l.flags.includes('CONTRACT_PENDING')) ruleResults.push({ ruleId: 'R-CON-01', result: 'CONTRACT_PENDING', inputs: { influencerId: l.influencerId }, subjectId: l.id });
    if (l.flags.includes('SETTLEMENT_BEFORE_DEADLINE')) ruleResults.push({ ruleId: 'R-DL-05', result: decisionNeededBy(l).date, inputs: { settlementDate: l.settlementDate, contractDeadline: l.contractDeadline }, subjectId: l.id });
    ruleResults.push({ ruleId: rec.ruleIds[0] ?? 'R-CP-05', result: rec.decision, inputs: { ruleIds: rec.ruleIds, flags: l.flags, supplyOutlook: l.supplyOutlook ?? 'UNKNOWN', ...(rec.condition ? { condition: rec.condition } : {}) }, subjectId: l.id });
    proposed.push({ itemId: l.id, decision: rec.decision, ...(rec.condition ? { condition: rec.condition } : {}) });
  }

  const topRole = lines.map((l) => l.routing!.requiredRole).reduce<ApproverRole>((a, b) => (roleRank(b) > roleRank(a) ? b : a), 'MARKETING_TEAM');
  const recText = proposed.map((p) => `${p.itemId} ${decisionText(p.decision)}${p.condition ? `(${p.condition})` : ''}`).join(' · ');
  const neg = lines.filter((l) => l.flags.includes('CP_NEGATIVE')).map((l) => l.id);
  const pos = lines.filter((l) => l.flags.includes('CP_POSITIVE')).map((l) => l.id);
  const gated = lines.filter((l) => l.flags.includes('STOCKOUT_BEFORE_SETTLEMENT')).map((l) => l.id);
  const linked = lines.filter((l) => l.flags.includes('CONTRACT_PENDING')).map((l) => l.id);
  const inWin = lines.filter((l) => l.flags.includes('IN_COVENANT_WINDOW')).map((l) => l.id);
  const alternatives: Alternative[] = [
    {
      id: 'A',
      title: `규칙 권고안 (건별) — ${recText}`,
      decision: 'RULE_BASED',
      effects: proposed.map((p) => ({ value: `${p.itemId}: ${decisionText(p.decision)}${p.condition ? ` — ${p.condition}` : ''}`, label: 'AGGREGATED' as const, refs: [], scale: 'NONE' as const, method: 'recommendLine (R-CP-05 → R-INV-03 게이트)' })),
      risks: linked.length ? [`${linked.join(' · ')} 기안만 부결해도 전속계약은 자동 갱신될 수 있음 — 계약 결정 별도 (R-CON-01)`] : [],
      requiresRole: topRole,
    },
    {
      id: 'B',
      title: '전 건 그대로 승인',
      decision: 'APPROVE_ALL',
      effects: [{ value: `${lines.map((l) => l.id).join(' · ')} 승인`, label: 'AGGREGATED', refs: [], scale: 'NONE' }],
      risks: [...(neg.length ? [`실질 공헌이익(공식값) 음수 건 승인: ${neg.join(' · ')}`] : []), ...(gated.length ? [`재고 게이트 위반 — 집행일 전 품절 예상: ${gated.join(' · ')}`] : [])],
      requiresRole: topRole,
    },
    {
      id: 'C',
      title: '전 건 부결',
      decision: 'REJECT_ALL',
      effects: [{ value: `${lines.map((l) => l.id).join(' · ')} 부결`, label: 'AGGREGATED', refs: [], scale: 'NONE' }],
      risks: [...(pos.length ? [`실질 공헌이익(공식값) 양수 건까지 부결: ${pos.join(' · ')}`] : []), ...(linked.length ? ['기안 부결만으로 전속계약 자동 갱신은 막지 못함 (R-CON-01)'] : [])],
      requiresRole: topRole,
    },
  ];
  const perspectives: Narrative['perspectives'] = {
    marketing: `확대 대상 캠페인의 실질 공헌이익(공식값, A05) 부호로 등급을 정함 (A-07) — 양수: ${pos.join(' · ') || '없음'} / 음수: ${neg.join(' · ') || '없음'}. 표본 결론은 방향까지.`,
    finance: inWin.length
      ? `${inWin.join(' · ')} 집행일이 covenant 하회 예상 구간 안 → 그룹 CEO/이사회 (R-AUTH-03, 전결 규정보다 우선). 기안 요청액(표본)은 자금 재전망 유출에 넣지 않음 (R-CASH-04).`
      : '집행일이 covenant 하회 예상 구간 밖 — 전결 규정(R-AUTH-01)대로. 기안 요청액(표본)은 자금 재전망 유출에 넣지 않음 (R-CASH-04).',
    contract: linked.length ? `${linked.join(' · ')} 는 전속계약 하위 집행분 — 계약 결정은 별도 승인요청 (R-CON-01).` : '연결된 미결 전속계약 없음.',
    scm: gateNotes.length ? `${gateNotes.join(' / ')} → 승인 불가, 조건부(집행일 조정) 또는 부결 (R-INV-03).` : '주력 SKU 커버 모두 안전재고 min 이상 — 재고 게이트 해당 없음.',
  };
  const claims = lines.map((l) => ({ text: `${l.id} 기안 예상 GMV ${fmt(l.expectedGmvKrw)}원 — 주장, 승인 근거 불가 (R-CLAIM-01)`, ref: planRef('expected_gmv_krw', l.id)[0]! }));
  if (linked.length) claims.push(CLAIMS[2]!);
  const unknowns = [
    ...(lines.some((l) => l.flags.includes('SETTLEMENT_BEFORE_DEADLINE')) ? [gap('G-11', '집행일 < 확정기한 건은 결정 필요 시점을 앞당겨 표시 (A-26)')] : []),
    ...(gated.length || lines.some((l) => l.flags.includes('INVENTORY_BELOW_MIN')) ? [gap('G-08'), gap('G-13')] : []),
    gap('G-07', '공헌이익에 물류 추가비용 · CS 비용 미포함 (원본 없음)'),
  ];
  return {
    subjectType: 'EXPANSION_LINES',
    subjectIds: lines.map((l) => l.id),
    facts,
    ruleResults,
    alternatives,
    allowedAlternativeIds: ['A'],
    proposedDecisions: proposed,
    claimsCited: claims,
    unknowns,
    mockNarrative: { recommendation: { alternativeId: 'A', rationale: `건별 권고는 규칙 엔진 결과(실질 공헌이익 공식값 부호 → 재고 게이트): ${recText}.` }, perspectives },
  };
}

// ───────────────────────── 재고 보충 ─────────────────────────

function replenishmentBasis(s: WorldState, ds: MasilDataset, ids: string[]): Partial0 {
  const reqs = ids.map((id) => {
    const r = s.replenishments.find((x) => x.id === id);
    if (!r) throw new DomainError('NOT_FOUND', `보충요청 없음: ${id}`);
    return r;
  });
  const facts: AssessmentFact[] = [];
  const ruleResults: AssessmentRuleResult[] = [];
  const pay = reqs[0]!.expectedPaymentDate;
  const routing = routeReplenishment({ expectedPaymentDate: pay }, s.forecast.breachWindows, s.forecast.id);
  facts.push({ key: 'forecast.window', name: `covenant 하회 예상 구간 (${s.forecast.id})`, value: txt(s.forecast.breachWindows.map((w) => `${w.start} ~ ${w.end}`).join(', ') || '없음', 'AGGREGATED', CASH_REFS, 'R-CASH-03', s.forecast.assumptionIds) });
  for (const r of reqs) {
    const k = (x: string) => `replenishment.${r.id}.${x}`;
    facts.push(
      { key: k('finalQty'), name: `${r.id} ${r.skuId} 발주량`, value: num(r.finalQty, 'AGGREGATED', INV_REFS, 'max(안전재고 max × 4주 평균 − 현재고 − 이동중, 0) → MOQ 배수 올림 (R-INV-04)', ['A-17', 'A-18']) },
      { key: k('amount'), name: `${r.id} 발주 금액`, value: money('FULL', r.amountKrw, 'AGGREGATED', [{ file: '02_masil/inventory/sc_purchase_orders_ms.csv' }], '발주량 × 기발주 단가', ['A-17', 'A-18']) },
      { key: k('coverWeeks'), name: `${r.skuId} 커버(주)`, value: num(r.coverWeeks, 'AGGREGATED', INV_REFS, 'R-INV-01') },
      { key: k('expectedPaymentDate'), name: `${r.id} 예상 지급일`, value: txt(r.expectedPaymentDate, 'ASSUMPTION', [], '발주일 + 25일', ['A-19']) },
      { key: k('status'), name: `${r.id} 상태`, value: txt(r.status, 'AGGREGATED', [], '운영 상태') },
    );
    ruleResults.push({ ruleId: 'R-INV-04', result: r.finalQty, inputs: { avg4w: r.avg4wDemand, targetQty: r.targetQty, suggestedQty: r.suggestedQty }, subjectId: r.id });
  }
  ruleResults.push({ ruleId: routing.reasons[0]!.ruleId, result: routing.requiredRole, inputs: { expectedPaymentDate: pay, windows: s.forecast.breachWindows }, subjectId: reqs[0]!.id });
  // 추가 유출 시나리오 — 원본 전망분과 분리 (R-CASH-04)
  const extra = simulateCash(ds, { id: 'CF-extra', arDueOverrides: { ...s.arDueOverrides }, extraOutflows: reqs.map((r) => ({ id: r.id, date: r.expectedPaymentDate, amountKrw: r.amountKrw })) });
  const day = extra.daily.find((d) => d.date >= pay);
  if (day) facts.push({ key: 'forecast.extra.closing', name: `추가 유출 반영 ${day.date} 종가 (원본 전망분과 분리)`, value: money('FULL', day.closingKrw, 'AGGREGATED', CASH_REFS, '보충 발주 대금을 추가 유출로 넣은 시나리오 (R-CASH-04)', extra.assumptionIds) });
  facts.push({ key: 'forecast.extra.min', name: '추가 유출 반영 최저 종가', value: money('FULL', extra.minClosing.krw, 'AGGREGATED', CASH_REFS, `최저 @ ${extra.minClosing.date}`, extra.assumptionIds) });
  const total = reqs.reduce((a, r) => a + r.amountKrw, 0);
  facts.push({ key: 'replenishment.total', name: '보충 발주 금액 합계', value: money('FULL', total, 'AGGREGATED', [{ file: '02_masil/inventory/sc_purchase_orders_ms.csv' }], 'Σ 발주 금액 (풀스케일끼리만 합산)') });
  const lineId = reqs[0]!.triggerLineId;
  const alternatives: Alternative[] = [
    { id: 'A', title: '보충 발주 상신', decision: 'SUBMIT', effects: [{ value: `보충 발주 ${fmt(total)}원 — 지급 ${pay}`, label: 'AGGREGATED', refs: [], scale: 'FULL' }], risks: routing.requiredRole === 'GROUP_CEO_BOARD' ? [`지급일이 covenant 하회 예상 구간 안 → ${ROLE_KO.GROUP_CEO_BOARD} 승인 필요 (R-AUTH-04 · R-AUTH-03)`] : [], requiresRole: routing.requiredRole },
    { id: 'B', title: '보충 없이 집행일 조정', decision: 'NO_ORDER', effects: [{ value: `${lineId ?? '연결 건'} 집행일을 기발주 입고 이후로 조정`, label: 'AGGREGATED', refs: [], scale: 'NONE' }], risks: ['기발주 입고일 미확인 (G-08)'], requiresRole: 'MASIL_CEO' },
  ];
  return {
    subjectType: 'REPLENISHMENT',
    subjectIds: reqs.map((r) => r.id),
    facts,
    ruleResults,
    alternatives,
    allowedAlternativeIds: ['A', 'B', 'NONE'],
    proposedDecisions: [],
    claimsCited: [],
    unknowns: [gap('G-08'), gap('G-12'), gap('G-13')],
    mockNarrative: {
      recommendation: { alternativeId: 'NONE', rationale: 'SCM 회신(G-08: 기발주 포함 여부 · 입고일) 전에는 권고하지 않음 — 회신이 집행일과 승인 경로를 바꾼다.' },
      perspectives: {
        marketing: `${lineId ?? '연결 건'} 집행 계획은 보충 여부에 따라 바뀐다.`,
        finance: `지급일 ${pay} — 권한자 ${ROLE_KO[routing.requiredRole]} (${routing.reasons[0]!.ruleId}). 추가 유출은 원본 전망분과 분리해 본다 (R-CASH-04).`,
        contract: '해당 없음.',
        scm: `발주량은 안전재고 max 목표(A-17) · MOQ 올림(A-18). 기발주 입고일 미확인(G-08).`,
      },
    },
  };
}

/** 근거에서 사실 값만 뽑기 (도구 출력용) */
export function factValues(facts: readonly AssessmentFact[]): { key: string; name: string; value: unknown; label: string; scale: string; method?: string }[] {
  return facts.map((f) => ({ key: f.key, name: f.name, value: (f.value as Sourced<unknown>).value, label: f.value.label, scale: f.value.scale, ...(f.value.method ? { method: f.value.method } : {}) }));
}
