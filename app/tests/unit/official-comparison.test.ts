/** BE-10 공식 전망(주장) 대 재전망 주간 대조 — A-32 · R-CASH-03 · DEMO 부록 A-4-1 · AC-2-10 */
import { describe, expect, it } from 'vitest';
import { compareOfficialForecast, largestOfficialGap, simulateCash } from '@/domain/cash';
import { routeExpansionLine } from '@/domain/authority';
import { krw } from '@/domain/money';
import { ds } from '../helpers/scenario';

const v1 = simulateCash(ds, { id: 'CF-v1' });
const v2 = simulateCash(ds, { id: 'CF-v2', arDueOverrides: { 'MAR-0004': '2026-08-30' } });

// 부록 A-4-1: [week, periodStart, periodEnd, official, v1 recalculated, v1 belowDays, v2 recalculated, v2 belowDays]
const A41: [string, string, string, number, number, number, number, number][] = [
  ['2026-07-06', '2026-07-01', '2026-07-06', 5_468_884_369, 5_910_593_790, 0, 5_910_593_790, 0],
  ['2026-07-13', '2026-07-07', '2026-07-13', 5_881_606_616, 5_701_797_218, 0, 5_701_797_218, 0],
  ['2026-07-20', '2026-07-14', '2026-07-20', 6_091_722_355, 5_941_509_959, 0, 5_941_509_959, 0],
  ['2026-07-27', '2026-07-21', '2026-07-27', 6_136_050_378, 1_921_839_555, 5, 1_921_839_555, 5],
  ['2026-08-03', '2026-07-28', '2026-08-03', 6_229_754_096, 1_921_839_555, 5, 1_921_839_555, 5],
  ['2026-08-10', '2026-08-04', '2026-08-10', 6_636_836_205, 1_921_839_555, 5, 1_921_839_555, 5],
  ['2026-08-17', '2026-08-11', '2026-08-17', 6_825_284_247, 1_921_839_555, 5, 1_921_839_555, 5],
  ['2026-08-24', '2026-08-18', '2026-08-24', 7_108_078_432, 3_328_583_411, 4, 1_921_839_555, 5],
  ['2026-08-31', '2026-08-25', '2026-08-31', 7_501_099_433, 4_920_098_644, 0, 4_920_098_644, 4],
  ['2026-09-07', '2026-09-01', '2026-09-07', 7_644_362_414, 6_323_145_302, 0, 6_323_145_302, 0],
  ['2026-09-14', '2026-09-08', '2026-09-14', 7_501_108_694, 6_323_145_302, 0, 6_323_145_302, 0],
  ['2026-09-21', '2026-09-15', '2026-09-21', 7_930_058_460, 6_323_145_302, 0, 6_323_145_302, 0],
  ['2026-09-28', '2026-09-22', '2026-09-28', 8_201_637_153, 6_323_145_302, 0, 6_323_145_302, 0],
];

describe('BE-10 compareOfficialForecast (A-32)', () => {
  it('v1 13행이 부록 A-4-1 과 같다 (기간 · 공식 · 재전망 · 차이 · 하회 영업일)', () => {
    const rows = compareOfficialForecast(v1, ds.officialForecast);
    expect(rows.map((r) => [r.week, r.periodStart, r.periodEnd, r.official, r.recalculated, r.belowDays])).toEqual(A41.map((a) => [a[0], a[1], a[2], a[3], a[4], a[5]]));
    expect(rows[0]!.diff).toBe(441_709_421);
    expect(rows.every((r) => r.diff === r.recalculated - r.official && r.belowThreshold === r.belowDays > 0)).toBe(true);
    expect(largestOfficialGap(rows)).toMatchObject({ week: '2026-08-17', diff: -4_903_444_692 });
  });

  it('v2 13행이 부록 A-4-1 과 같고 최대 차이 주가 08-24 로 이동', () => {
    const rows = compareOfficialForecast(v2, ds.officialForecast);
    expect(rows.map((r) => [r.week, r.recalculated, r.belowDays])).toEqual(A41.map((a) => [a[0], a[6], a[7]]));
    expect(largestOfficialGap(rows)).toMatchObject({ week: '2026-08-24', diff: -5_186_238_877 });
  });

  it('AC-2-10 공식 전망 값을 바꿔도 하회 구간 · 권한 판정은 그대로 (공식 전망은 판단 입력 아님)', () => {
    const altered = { ...ds, officialForecast: ds.officialForecast.map((w) => ({ ...w, projectedClosingKrw: krw('FULL', 1) })) };
    const a = simulateCash(altered, { id: 'CF-v2', arDueOverrides: { 'MAR-0004': '2026-08-30' } });
    expect(a.breachWindows).toEqual(v2.breachWindows);
    expect(a.breachWindows).toEqual([{ start: '2026-07-21', end: '2026-08-28' }]);
    const line = { requestedKrw: krw('SAMPLE', 10_180_328), settlementDate: '2026-08-28' };
    expect(routeExpansionLine(line, krw('SAMPLE', 180_803_272), a.breachWindows).requiredRole).toBe('GROUP_CEO_BOARD');
    expect(largestOfficialGap(compareOfficialForecast(a, altered.officialForecast))!.week).not.toBe(undefined);
  });
});
