/**
 * 승인 권한 (R-AUTH-01 ~ R-AUTH-06) — approval_authority_policy.md [ORIGINAL].
 * 권한자는 이 코드가 정한다. AI 는 권한자를 정하지 않는다.
 */
import { isInWindows } from './cash';
import { DomainError } from './errors';
import type { ApproverRole, DateWindow, IsoDate, Krw, Routing, RoutingReason } from './types';

export const LINE_LIMIT_KRW = 10_000_000; // 건별 1천만원 이하 전결
export const PROPOSAL_LIMIT_KRW = 100_000_000; // 기안 총액 1억원 초과
export const CONTRACT_LIMIT_KRW = 1_000_000_000; // 연 10억원 초과

/** 권한 서열 (R-AUTH-06, 정책 표 구조에서 INTERPRETED). SCM 은 발주 전용 — 확대안 서열 밖이지만 비교 가능하도록 MASIL_CEO 와 같은 단계로 둔다 */
const RANK: Record<ApproverRole, number> = { MARKETING_TEAM: 1, SCM: 2, MASIL_CEO: 2, GROUP_CEO_BOARD: 3 };
export function roleRank(r: ApproverRole): number {
  return RANK[r];
}

const fmt = (n: number) => n.toLocaleString('ko-KR');

/** R-AUTH-01 (+ R-AUTH-03 covenant 우선 적용) */
export function routeExpansionLine(
  line: { requestedKrw: Krw<'SAMPLE'>; settlementDate: IsoDate },
  proposalTotalKrw: Krw<'SAMPLE'>,
  windows: readonly DateWindow[],
  forecastRunId?: string,
): Routing {
  const overLine = line.requestedKrw > LINE_LIMIT_KRW;
  const overTotal = proposalTotalKrw > PROPOSAL_LIMIT_KRW;
  const reasons: RoutingReason[] = [];
  let base: Routing;
  if (overLine || overTotal) {
    const why = [overLine ? `건별 ${fmt(line.requestedKrw)}원 > 1천만원` : null, overTotal ? `기안 총액 ${fmt(proposalTotalKrw)}원 > 1억원` : null]
      .filter(Boolean)
      .join(', ');
    reasons.push({ ruleId: 'R-AUTH-01', text: `${why} → Masil 대표 승인 + 그룹 보고`, label: 'ORIGINAL' });
    base = { requiredRole: 'MASIL_CEO', alsoReportTo: ['GROUP_CEO_BOARD'], reasons };
  } else {
    reasons.push({ ruleId: 'R-AUTH-01', text: '건별 1천만원 이하 · 기안 총액 1억원 이하 → 마케팅팀 전결', label: 'ORIGINAL' });
    base = { requiredRole: 'MARKETING_TEAM', alsoReportTo: [], reasons };
  }
  return applyCovenantPriority(base, line.settlementDate, windows, forecastRunId);
}

/** R-AUTH-03 covenant 하회 예상 구간에 현금 유출일이 들어가면 금액 · 종류 불문 그룹 CEO/이사회 (평시 전결보다 우선) */
export function applyCovenantPriority(routing: Routing, cashOutDate: IsoDate | null, windows: readonly DateWindow[], forecastRunId?: string): Routing {
  const withRun = forecastRunId ? { ...routing, forecastRunId } : routing;
  if (cashOutDate === null || !isInWindows(cashOutDate, windows)) return withRun;
  const w = windows.find((x) => cashOutDate >= x.start && cashOutDate <= x.end)!;
  return {
    requiredRole: 'GROUP_CEO_BOARD',
    alsoReportTo: [],
    reasons: [
      {
        ruleId: 'R-AUTH-03',
        text: `현금 유출일 ${cashOutDate} 가 covenant 하회 예상 구간 ${w.start} ~ ${w.end} 안 → 그룹 CEO/이사회 (전결 규정보다 우선)${forecastRunId ? ` [재전망 ${forecastRunId}]` : ''}`,
        label: 'ORIGINAL',
      },
      ...routing.reasons,
    ],
    ...(forecastRunId ? { forecastRunId } : {}),
  };
}

/**
 * R-AUTH-02 전속계약 체결 · 갱신. 연 금액 = 고정 피 + 성과 피(미확인 → 하한).
 * 미통보 자동 갱신도 체결로 본다. 고정 피 지급 일정 미상(G-09)이라 covenant 대조는 판정 불가 — 이미 최상위 권한.
 */
export function routeContract(c: { fixedFeeAnnualKrw: Krw<'FULL'>; performanceFeeKnownKrw?: Krw<'FULL'> | null }): Routing & {
  annualAmountKrw: number;
  annualAmountIsLowerBound: boolean;
} {
  const perfKnown = c.performanceFeeKnownKrw ?? null;
  const annual = c.fixedFeeAnnualKrw + (perfKnown ?? 0);
  const over = annual > CONTRACT_LIMIT_KRW;
  const lb = perfKnown === null;
  return {
    requiredRole: over ? 'GROUP_CEO_BOARD' : 'MASIL_CEO',
    alsoReportTo: [],
    reasons: [
      {
        ruleId: 'R-AUTH-02',
        text: `연 금액 ${lb ? '하한 ' : ''}${fmt(annual)}원 ${over ? '> 10억원 → 그룹 CEO/이사회' : '≤ 10억원 → Masil 대표'} (미통보 자동 갱신도 체결)`,
        label: 'ORIGINAL',
      },
    ],
    annualAmountKrw: annual,
    annualAmountIsLowerBound: lb,
  };
}

/** R-AUTH-04 재고 발주: 평시 SCM, 지급일이 하회 구간이면 그룹 CEO/이사회 */
export function routeReplenishment(req: { expectedPaymentDate: IsoDate }, windows: readonly DateWindow[], forecastRunId?: string): Routing {
  return applyCovenantPriority(
    { requiredRole: 'SCM', alsoReportTo: [], reasons: [{ ruleId: 'R-AUTH-04', text: '재고 발주 승인 → SCM', label: 'ORIGINAL' }] },
    req.expectedPaymentDate,
    windows,
    forecastRunId,
  );
}

/** R-AUTH-05 회신은 requiredRole 만 가능. 하위 권한자 · AI · 시스템은 불가 */
export function assertCanReply(role: string, request: { requiredRole: ApproverRole }): void {
  if (role !== request.requiredRole) {
    throw new DomainError('FORBIDDEN_ROLE', `권한 없음: 이 요청은 ${request.requiredRole} 만 회신할 수 있음 (회신자 ${role})`, {
      requiredRole: request.requiredRole,
      respondentRole: role,
    });
  }
}
