/** R-CASH-01 ~ R-CASH-04 — 골든 값: DEMO_SCENARIOS 부록 A-4, AC-2-01/08 */
import { describe, expect, it } from 'vitest';
import { simulateCash, isInWindows } from '@/domain/cash';
import { masil } from '../helpers/raw';

const close = (run: ReturnType<typeof simulateCash>, d: string) => run.daily.find((x) => x.date === d)?.closingKrw;

describe('R-CASH-01/02/03 자금 재전망', () => {
  const ds = masil();
  const v1 = simulateCash(ds, { id: 'CF-v1' });

  it('기초 5,148,063,540 · 영업일 종가 (부록 A-4 v1)', () => {
    expect(v1.opening).toBe(5_148_063_540);
    expect(close(v1, '2026-07-01')).toBe(5_283_911_130);
    expect(close(v1, '2026-07-17')).toBe(5_941_509_959);
    expect(close(v1, '2026-07-21')).toBe(2_191_749_959);
    expect(close(v1, '2026-07-27')).toBe(1_921_839_555);
    expect(close(v1, '2026-08-24')).toBe(3_328_583_411);
    expect(close(v1, '2026-08-31')).toBe(4_920_098_644);
    expect(close(v1, '2026-09-07')).toBe(6_323_145_302);
    expect(v1.daily.every((d) => !['0', '6'].includes(String(new Date(d.date).getUTCDay())))).toBe(true);
  });

  it('하회 구간 v1 = 7/21 ~ 8/21 (24영업일), 최저 1,921,839,555 @ 7/27', () => {
    expect(v1.breachWindows).toEqual([{ start: '2026-07-21', end: '2026-08-21' }]);
    expect(v1.breachBusinessDays).toBe(24);
    expect(v1.minClosing).toEqual({ date: '2026-07-27', krw: 1_921_839_555 });
  });

  it('AC-2-01 MAR-0004 → 8/30 지연: v2 = 7/21 ~ 8/28 (29영업일), 최저 동일', () => {
    const v2 = simulateCash(ds, { id: 'CF-v2', arDueOverrides: { 'MAR-0004': '2026-08-30' } });
    expect(v2.breachWindows).toEqual([{ start: '2026-07-21', end: '2026-08-28' }]);
    expect(v2.breachBusinessDays).toBe(29);
    expect(v2.minClosing).toEqual({ date: '2026-07-27', krw: 1_921_839_555 });
    expect(close(v2, '2026-08-24')).toBe(1_921_839_555);
    expect(close(v2, '2026-08-31')).toBe(4_920_098_644);
  });

  it('민감도 (연체 AR 제외 · 연체 AP 7/1 지급): 7/21 ~ 8/28, 최저 1,467,664,440', () => {
    const s = simulateCash(ds, { id: 'CF-sens', overdueAp: 'AS_OF', overdueAr: 'EXCLUDE' });
    expect(s.breachWindows).toEqual([{ start: '2026-07-21', end: '2026-08-28' }]);
    expect(s.minClosing.krw).toBe(1_467_664_440);
    expect(s.breachWindows[0]!.start).toBe(v1.breachWindows[0]!.start);
  });

  it('이중계상 금지: po_id 가 있는 AP 14행은 넣지 않는다 (7/21 유출 = 발주 대금 3,749,760,000 만)', () => {
    expect((close(v1, '2026-07-20') ?? 0) - (close(v1, '2026-07-21') ?? 0)).toBe(3_749_760_000);
  });

  it('AC-2-08 / R-CASH-04 기안 요청액(SAMPLE)은 재전망 입력이 아니다 — 기안 데이터를 비워도 결과 동일', () => {
    const dsNoPlan = { ...ds, budgetPlan: [] };
    const noPlan = simulateCash(dsNoPlan, { id: 'CF-v1' });
    expect(noPlan.daily).toEqual(v1.daily);
  });

  it('추가 유출(FULL)은 원본 전망분과 분리: 8/14 SKU-1001 보충 524,160,000', () => {
    const extra = simulateCash(ds, { id: 'CF-x', extraOutflows: [{ id: 'RPL-1', date: '2026-08-14', amountKrw: 524_160_000 }] });
    expect(close(extra, '2026-08-14')).toBe((close(v1, '2026-08-14') ?? 0) - 524_160_000);
    expect(extra.inputsVersion).toContain('RPL-1');
  });

  it('구간 포함 판정은 달력일 양끝 포함', () => {
    const w = [{ start: '2026-07-21', end: '2026-08-21' }];
    expect(isInWindows('2026-07-21', w)).toBe(true);
    expect(isInWindows('2026-08-21', w)).toBe(true);
    expect(isInWindows('2026-07-20', w)).toBe(false);
    expect(isInWindows('2026-08-24', w)).toBe(false);
  });
});
