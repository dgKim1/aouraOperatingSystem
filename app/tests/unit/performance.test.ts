/**
 * R-CP-01 ~ R-CP-06 — 골든 값: docs/DEMO_SCENARIOS.md 부록 A-1 · A-2 (원본 CSV 를 실제로 읽어 계산)
 * 가정 A-01 ~ A-06. 금액은 SAMPLE — 비중 · 순위 · 부호까지만 결론에 쓴다.
 */
import { describe, expect, it } from 'vitest';
import {
  computePerformance,
  cpGrade,
  cpRefSignDiffers,
  influencerShares,
  rankBy,
  requestShareRemaining,
  totalPerformance,
} from '@/domain/performance';
import { masil } from '../helpers/raw';

// 부록 A-1: [INF, GMV, MarketingSpend, cp 공식, cp 순위, realRoas, realRoas 순위, nominalRoas, returnRate, cpRef14, realRoasRef14]
const A1: [string, number, number, number, number, number, number, number, number, number, number][] = [
  ['INF-001', 422_424_676, 309_975_627, -61_308_789, 10, -0.198, 9, 1.36, 0.1307, -160_803_942, -0.519],
  ['INF-002', 121_676_523, 18_270_678, 67_656_962, 1, 3.703, 1, 6.66, 0.0366, 60_293_881, 3.3],
  ['INF-003', 227_740_572, 106_329_387, 31_962_708, 2, 0.301, 7, 2.14, 0.0956, -5_144_032, -0.048],
  ['INF-004', 87_561_341, 21_773_328, 28_586_292, 5, 1.313, 4, 4.02, 0.0527, 20_783_638, 0.955],
  ['INF-005', 222_552_519, 168_790_989, -36_162_212, 9, -0.214, 10, 1.32, 0.12, -81_377_407, -0.482],
  ['INF-006', 85_081_745, 21_189_240, 29_473_649, 4, 1.391, 3, 4.02, 0.0352, 23_959_100, 1.131],
  ['INF-007', 169_874_777, 75_875_979, 16_370_078, 7, 0.216, 8, 2.24, 0.1143, -16_006_095, -0.211],
  ['INF-008', 42_853_704, 10_324_251, 11_331_333, 8, 1.098, 6, 4.15, 0.0528, 7_930_912, 0.768],
  ['INF-009', 44_097_768, 6_742_335, 21_923_009, 6, 3.252, 2, 6.54, 0.0231, 19_932_216, 2.956],
  ['INF-010', 82_830_298, 24_641_979, 31_553_596, 3, 1.28, 5, 3.36, 0.0534, 23_921_338, 0.971],
];

// 부록 A-2: [plan, campaign, cp 공식, cp 1.4 참고]
const A2: [string, string, number, number][] = [
  ['PLAN-001', 'CMP-0003', -30_674_335, -68_260_866],
  ['PLAN-002', 'CMP-0002', -8_428_972, -41_699_851],
  ['PLAN-003', 'CMP-0001', -22_205_482, -50_843_225],
  ['PLAN-004', 'CMP-0009', 14_382_286, 1_020_593],
  ['PLAN-005', 'CMP-0014', -20_054_981, -37_642_810],
  ['PLAN-006', 'CMP-0008', 9_860_600, -3_005_739],
  ['PLAN-007', 'CMP-0013', -12_622_278, -27_891_455],
  ['PLAN-008', 'CMP-0007', 7_719_822, -3_158_886],
  ['PLAN-009', 'CMP-0012', -3_484_954, -15_843_143],
  ['PLAN-010', 'CMP-0019', 6_414_648, -5_146_741],
  ['PLAN-011', 'CMP-0018', 4_734_993, -6_703_541],
  ['PLAN-012', 'CMP-0017', 5_220_436, -4_155_814],
  ['PLAN-013', 'CMP-0011', 17_324_342, 13_235_443],
  ['PLAN-014', 'CMP-0006', 24_948_920, 22_139_747],
  ['PLAN-015', 'CMP-0016', 16_564_756, 13_535_113],
  ['PLAN-016', 'CMP-0025', 17_376_463, 12_939_952],
  ['PLAN-017', 'CMP-0010', 11_261_950, 7_548_195],
  ['PLAN-018', 'CMP-0015', 12_908_893, 10_423_987],
  ['PLAN-019', 'CMP-0005', 21_605_708, 19_273_579],
  ['PLAN-020', 'CMP-0024', 14_177_133, 10_981_386],
  ['PLAN-021', 'CMP-0004', 21_102_335, 18_880_556],
  ['PLAN-022', 'CMP-0023', 11_362_820, 10_399_104],
  ['PLAN-023', 'CMP-0021', 5_220_748, 3_186_075],
  ['PLAN-024', 'CMP-0022', 10_560_189, 9_533_112],
  ['PLAN-025', 'CMP-0020', 6_110_586, 4_744_838],
];

describe('R-CP-01/02/03 인플루언서별 실질 공헌이익 (부록 A-1)', () => {
  const ds = masil();
  const byInf = computePerformance(ds, 'INFLUENCER');
  const cpRank = rankBy(Object.values(byInf), (p) => p.cp);
  const roasRank = rankBy(Object.values(byInf), (p) => p.realRoas ?? -Infinity);

  it.each(A1)('%s', (inf, gmv, spend, cp, cpR, roas, roasR, nroas, rr, cpRef, roasRef) => {
    const p = byInf[inf]!;
    expect(p.gmv).toBe(gmv);
    expect(p.marketingSpend).toBe(spend);
    expect(p.cp).toBe(cp);
    expect(p.cpRefDef14).toBe(cpRef);
    expect(cpRank[inf]).toBe(cpR);
    expect(roasRank[inf]).toBe(roasR);
    expect(p.realRoas!).toBeCloseTo(roas, 3);
    expect(p.realRoasRefDef14!).toBeCloseTo(roasRef, 3);
    expect(p.nominalRoas!).toBeCloseTo(nroas, 2);
    expect(p.returnRate!).toBeCloseTo(rr, 4);
    expect(p.scale).toBe('SAMPLE');
  });

  it('합계 재료가 부록 A-1 과 같다', () => {
    const t = totalPerformance(ds);
    expect(t).toMatchObject({
      gmv: 1_506_693_923,
      marketingSpend: 763_913_793,
      cp: 141_386_625,
      cpRefDef14: -106_510_392,
      couponDiscount: 105_032_379,
      returnRefund: 142_864_638,
      cogs: 234_626_280,
      channelFee: 170_438_549,
      fulfillmentCost: 47_169_640,
      returnLogisticsCost: 6_294_398,
      orderCount: 15_650,
      returnOrderCount: 1_719,
    });
    expect(t.realRoas!).toBeCloseTo(0.185, 3);
    expect(t.nominalRoas!).toBeCloseTo(1.97, 2);
  });

  it('공식값 = 참고값 + 쿠폰 + 환불 (이중 차감 차이만큼)', () => {
    for (const p of Object.values(byInf)) {
      expect(p.cp - p.cpRefDef14).toBe(p.couponDiscount + p.returnRefund);
    }
  });

  it('R-CP-03 분모 0 이면 ROAS 는 null', () => {
    const p = computePerformance({ ...ds, adSpend: [] }, 'INFLUENCER')['INF-001']!;
    expect(p.nominalRoas).toBeNull();
    expect(p.realRoas).toBeNull();
  });
});

describe('R-CP-04 집행 비중 · 요청 비중 (AC-1-03)', () => {
  it('INF-001 adSpendShare 0.4058 · requestShare 0.2804 · 둘 다 1위', () => {
    const s = influencerShares(masil());
    expect(s['INF-001']!.adSpendShare).toBeCloseTo(0.4058, 4);
    expect(s['INF-001']!.requestShare).toBeCloseTo(0.2804, 4);
    expect(s['INF-001']!.adSpendRank).toBe(1);
    expect(s['INF-001']!.requestRank).toBe(1);
    expect(s['INF-005']!.adSpendRank).toBe(2);
    expect(s['INF-003']!.requestRank).toBe(2);
  });
});

describe('R-CP-05 권고 등급 (공식값 부호) · 참고 플래그 (부록 A-2)', () => {
  const ds = masil();
  const byCmp = computePerformance(ds, 'CAMPAIGN');

  it.each(A2)('%s → %s', (_plan, cmp, cp, cpRef) => {
    const p = byCmp[cmp]!;
    expect(p.cp).toBe(cp);
    expect(p.cpRefDef14).toBe(cpRef);
    expect(cpGrade(p)).toBe(cp > 0 ? 'CP_POSITIVE' : 'CP_NEGATIVE');
  });

  it('CP_REF_SIGN_DIFFERS 는 PLAN-006 · 008 · 010 · 011 · 012 캠페인과 INF-003 · INF-007 에만', () => {
    const differs = A2.filter(([, cmp]) => cpRefSignDiffers(byCmp[cmp]!)).map(([plan]) => plan);
    expect(differs).toEqual(['PLAN-006', 'PLAN-008', 'PLAN-010', 'PLAN-011', 'PLAN-012']);
    const byInf = computePerformance(ds, 'INFLUENCER');
    expect(Object.keys(byInf).filter((k) => cpRefSignDiffers(byInf[k]!)).sort()).toEqual(['INF-003', 'INF-007']);
  });

  it('cp = 0 은 CP_NEGATIVE (cp ≤ 0 부결 권고)', () => {
    expect(cpGrade({ cp: 0 })).toBe('CP_NEGATIVE');
    expect(cpGrade({ cp: 1 })).toBe('CP_POSITIVE');
  });

  it('등급 요청액 합: NEG 6건 77,397,264 · POS 19건 103,406,008 · REF≠ 5건 37,533,514', () => {
    let neg = 0, pos = 0, negN = 0, posN = 0, ref = 0;
    for (const plan of ds.budgetPlan) {
      const p = byCmp[plan.campaignId]!;
      if (cpGrade(p) === 'CP_NEGATIVE') { neg += plan.requestedKrw; negN++; } else { pos += plan.requestedKrw; posN++; }
      if (cpRefSignDiffers(p)) ref += plan.requestedKrw;
    }
    expect([negN, neg, posN, pos, ref]).toEqual([6, 77_397_264, 19, 103_406_008, 37_533_514]);
  });

  it('AC-1-03b 등급 · 순위에 cpRefDef14 가 쓰이지 않는다 (참고값을 바꿔도 불변)', () => {
    const rows = Object.values(computePerformance(ds, 'INFLUENCER'));
    const before = rows.map((p) => [p.key, cpGrade(p)]);
    const rankBefore = rankBy(rows, (p) => p.cp);
    const tampered = rows.map((p) => ({ ...p, cpRefDef14: -p.cpRefDef14 * 1000 - 1, realRoasRefDef14: 999 }));
    expect(tampered.map((p) => [p.key, cpGrade(p)])).toEqual(before);
    expect(rankBy(tampered, (p) => p.cp)).toEqual(rankBefore);
  });
});

describe('R-CP-06 남은 기안 요청 비중 (AC-1-11)', () => {
  it('PLAN-001~005 중 4건 취소 후 INF-001 남은 요청 비중 0, 남은 총액 120,081,310', () => {
    const ds = masil();
    const cancelled = new Set(['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-005']);
    // 8/14 묶음 판단 시점: 7/17 마감 건은 결정됨 → PLAN-004 는 CONFIRMED. 남은 = CANCELLED/REJECTED 아닌 건
    const r = requestShareRemaining(
      ds,
      ds.budgetPlan.map((p) => ({ id: p.id, status: cancelled.has(p.id) ? 'CANCELLED' : 'VALIDATED' })),
    );
    expect(r.remainingTotal).toBe(180_803_272 - 18_962_703 - 16_801_646 - 14_926_612 - 10_031_001);
    expect(r.shares['INF-001'] ?? 0).toBe(0);
  });
});

describe('rankBy — 내림차순, 동점은 ID 오름차순', () => {
  it('동점 처리', () => {
    expect(rankBy([{ key: 'B', v: 1 }, { key: 'A', v: 1 }, { key: 'C', v: 2 }], (x) => x.v)).toEqual({ C: 1, A: 2, B: 3 });
  });
});
