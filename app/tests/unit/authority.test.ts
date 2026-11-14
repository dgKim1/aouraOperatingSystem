/** R-AUTH-01 ~ R-AUTH-06 — approval_authority_policy.md, 부록 A-2 권한자 열, AC-1-02 / AC-2-02 / AC-4-05 */
import { describe, expect, it } from 'vitest';
import {
  applyCovenantPriority,
  assertCanReply,
  roleRank,
  routeContract,
  routeExpansionLine,
  routeReplenishment,
} from '@/domain/authority';
import { simulateCash } from '@/domain/cash';
import { DomainError } from '@/domain/errors';
import { krw } from '@/domain/money';
import { masil } from '../helpers/raw';

const V1 = [{ start: '2026-07-21', end: '2026-08-21' }];
const V2 = [{ start: '2026-07-21', end: '2026-08-28' }];
const TOTAL = krw('SAMPLE', 180_803_272);

const line = (requested: number, settlementDate = '2026-09-30') => ({ requestedKrw: krw('SAMPLE', requested), settlementDate });

describe('R-AUTH-01 확대 기안 (경계값)', () => {
  const small = krw('SAMPLE', 50_000_000);
  it('건별 10,000,000 · 총액 1억 이하 → 마케팅팀 전결', () => {
    expect(routeExpansionLine(line(10_000_000), small, []).requiredRole).toBe('MARKETING_TEAM');
  });
  it('건별 10,000,001 → Masil 대표 + 그룹 보고', () => {
    const r = routeExpansionLine(line(10_000_001), small, []);
    expect(r.requiredRole).toBe('MASIL_CEO');
    expect(r.alsoReportTo).toEqual(['GROUP_CEO_BOARD']);
  });
  it('총액 100,000,000 은 초과 아님, 100,000,001 은 초과', () => {
    expect(routeExpansionLine(line(1), krw('SAMPLE', 100_000_000), []).requiredRole).toBe('MARKETING_TEAM');
    expect(routeExpansionLine(line(1), krw('SAMPLE', 100_000_001), []).requiredRole).toBe('MASIL_CEO');
  });
  it('현재 기안 총액 180,803,272 → 25건 모두 최소 MASIL_CEO, 마케팅팀 전결 0건', () => {
    for (const p of masil().budgetPlan) {
      expect(roleRank(routeExpansionLine(p, TOTAL, []).requiredRole)).toBeGreaterThanOrEqual(roleRank('MASIL_CEO'));
    }
  });
});

describe('R-AUTH-02 전속계약', () => {
  it('28억 > 10억 → GROUP_CEO_BOARD, 10억 정확히는 MASIL_CEO', () => {
    expect(routeContract({ fixedFeeAnnualKrw: krw('FULL', 2_800_000_000) }).requiredRole).toBe('GROUP_CEO_BOARD');
    expect(routeContract({ fixedFeeAnnualKrw: krw('FULL', 1_000_000_000) }).requiredRole).toBe('MASIL_CEO');
    expect(routeContract({ fixedFeeAnnualKrw: krw('FULL', 1_000_000_001) }).requiredRole).toBe('GROUP_CEO_BOARD');
  });
  it('성과 피 미확인 → 연 금액은 하한 표시', () => {
    const r = routeContract({ fixedFeeAnnualKrw: krw('FULL', 2_800_000_000) });
    expect(r.annualAmountIsLowerBound).toBe(true);
    expect(r.reasons.map((x) => x.ruleId)).toContain('R-AUTH-02');
  });
});

describe('R-AUTH-03 covenant 우선', () => {
  it('구간 안이면 금액 불문 GROUP_CEO_BOARD (R-AUTH-01 보다 우선)', () => {
    const base = routeExpansionLine(line(1, '2026-12-01'), krw('SAMPLE', 1), []);
    expect(base.requiredRole).toBe('MARKETING_TEAM');
    const r = applyCovenantPriority(base, '2026-07-27', V1);
    expect(r.requiredRole).toBe('GROUP_CEO_BOARD');
    expect(r.reasons[0]!.ruleId).toBe('R-AUTH-03');
  });

  // 부록 A-2 권한자 열 (v1 / v2)
  const GCB_V1 = ['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-008', 'PLAN-009', 'PLAN-010', 'PLAN-015', 'PLAN-016', 'PLAN-017', 'PLAN-021', 'PLAN-022', 'PLAN-023'];
  const GCB_V2 = [...GCB_V1, 'PLAN-004', 'PLAN-024'].sort();

  it('v1 GCB 12건 · MC 13건 (재전망 결과 구간을 그대로 사용)', () => {
    const ds = masil();
    const windows = simulateCash(ds, { id: 'CF-v1' }).breachWindows;
    const gcb = ds.budgetPlan.filter((p) => routeExpansionLine(p, TOTAL, windows).requiredRole === 'GROUP_CEO_BOARD').map((p) => p.id);
    expect(gcb).toEqual(GCB_V1);
  });
  it('v2 GCB 14건 · MC 11건 (PLAN-004 · PLAN-024 상향)', () => {
    const gcb = masil().budgetPlan.filter((p) => routeExpansionLine(p, TOTAL, V2).requiredRole === 'GROUP_CEO_BOARD').map((p) => p.id);
    expect(gcb.sort()).toEqual(GCB_V2);
  });
  it('AC-1-02 PLAN-001~003 사유 R-AUTH-03, PLAN-004/005 MASIL_CEO + 그룹 보고', () => {
    const ds = masil();
    const r = Object.fromEntries(ds.budgetPlan.map((p) => [p.id, routeExpansionLine(p, TOTAL, V1)]));
    for (const id of ['PLAN-001', 'PLAN-002', 'PLAN-003']) {
      expect(r[id]!.requiredRole).toBe('GROUP_CEO_BOARD');
      expect(r[id]!.reasons.map((x) => x.ruleId)).toContain('R-AUTH-03');
    }
    for (const id of ['PLAN-004', 'PLAN-005']) {
      expect(r[id]!.requiredRole).toBe('MASIL_CEO');
      expect(r[id]!.alsoReportTo).toContain('GROUP_CEO_BOARD');
    }
  });
});

describe('R-AUTH-04 재고 발주 (AC-4-05)', () => {
  it('지급일 8/14 (구간 안) → GROUP_CEO_BOARD, 8/24 → SCM', () => {
    expect(routeReplenishment({ expectedPaymentDate: '2026-08-14' }, V1).requiredRole).toBe('GROUP_CEO_BOARD');
    expect(routeReplenishment({ expectedPaymentDate: '2026-08-24' }, V1).requiredRole).toBe('SCM');
  });
});

describe('R-AUTH-05 회신 권한', () => {
  it('requiredRole 이 아니면 FORBIDDEN_ROLE(422)', () => {
    try {
      assertCanReply('MASIL_CEO', { requiredRole: 'GROUP_CEO_BOARD' });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError);
      expect((e as DomainError).code).toBe('FORBIDDEN_ROLE');
      expect((e as DomainError).httpStatus).toBe(422);
    }
    expect(() => assertCanReply('GROUP_CEO_BOARD', { requiredRole: 'GROUP_CEO_BOARD' })).not.toThrow();
  });
  it('서열 MARKETING_TEAM < MASIL_CEO < GROUP_CEO_BOARD', () => {
    expect(roleRank('MARKETING_TEAM')).toBeLessThan(roleRank('MASIL_CEO'));
    expect(roleRank('MASIL_CEO')).toBeLessThan(roleRank('GROUP_CEO_BOARD'));
  });
});
