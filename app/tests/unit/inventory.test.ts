/** R-INV-01 ~ R-INV-04 — 골든 값: DEMO_SCENARIOS 부록 A-3, ④ S4-1/S4-2, AC-4-01/04 */
import { describe, expect, it } from 'vitest';
import {
  avg4w,
  coverWeeks,
  inventoryGate,
  mainSkus,
  replenishmentSuggestionsForLine,
  skuCoverTable,
  stockoutDate,
  suggestOrder,
  unitCostFromPurchaseOrders,
} from '@/domain/inventory';
import { masil } from '../helpers/raw';

// [sku, avg4w, cover, below min]
const A3: [string, number, number, boolean][] = [
  ['SKU-1001', 7910.5, 2.923, true],
  ['SKU-1002', 7222.0, 2.923, true],
  ['SKU-1003', 3782.25, 4.286, false],
  ['SKU-1004', 6499.0, 2.209, true],
  ['SKU-2001', 4448.5, 5.658, false],
  ['SKU-2002', 3928.0, 4.934, false],
  ['SKU-2003', 3840.5, 5.925, false],
  ['SKU-3001', 882.5, 15.882, false],
  ['SKU-3002', 869.25, 17.827, false],
  ['SKU-3003', 4279.75, 5.003, false],
  ['SKU-4001', 3936.75, 4.234, false],
  ['SKU-4002', 3820.5, 4.922, false],
  ['SKU-5001', 4362.25, 5.231, false],
  ['SKU-5002', 3503.75, 5.202, false],
];

describe('R-INV-01 재고 커버 (AC-4-01)', () => {
  const ds = masil();
  const table = skuCoverTable(ds);

  it.each(A3)('%s', (sku, avg, cover, below) => {
    expect(avg4w(ds.weeklySales, sku, '2026-06-30')).toBe(avg);
    const row = table.find((r) => r.skuId === sku)!;
    expect(row.coverWeeks).toBeCloseTo(cover, 3);
    expect(row.belowMin).toBe(below);
    // 원본 stock_cover_weeks 와 소수 1자리 일치
    expect(Math.round(row.coverWeeks! * 10) / 10).toBe(row.stockCoverWeeksReported);
  });

  it('in_transit 은 커버에 합산하지 않는다', () => {
    expect(coverWeeks(23123, 7910.5)).toBeCloseTo(2.923, 3);
  });

  it('평균 0 이면 null', () => {
    expect(coverWeeks(100, 0)).toBeNull();
  });
});

describe('R-INV-02 예상 품절일 (in_transit 제외)', () => {
  it('1001 · 1002 → 07-20, 1003 → 07-30, 1004 → 07-15', () => {
    expect(stockoutDate('2026-06-30', 23123 / 7910.5)).toBe('2026-07-20');
    expect(stockoutDate('2026-06-30', 21111 / 7222)).toBe('2026-07-20');
    expect(stockoutDate('2026-06-30', 16210 / 3782.25)).toBe('2026-07-30');
    expect(stockoutDate('2026-06-30', 14359 / 6499)).toBe('2026-07-15');
  });
});

describe('A-16 주력 SKU (GMV 비중 ≥ 20%)', () => {
  it('CMP-0018 → SKU-1004 · 1001 · 1002 · 1003', () => {
    const m = mainSkus(masil().orders, 'CMP-0018');
    expect(m.map((x) => x.skuId)).toEqual(['SKU-1004', 'SKU-1001', 'SKU-1002', 'SKU-1003']);
    expect(m.map((x) => Math.round(x.share * 100))).toEqual([27, 26, 25, 22]);
  });
  it('7/17 마감 5건(PLAN-001~005) 캠페인의 주력 SKU 에 더마가 없다', () => {
    const ds = masil();
    for (const cmp of ['CMP-0003', 'CMP-0002', 'CMP-0001', 'CMP-0009', 'CMP-0014']) {
      expect(mainSkus(ds.orders, cmp).some((x) => x.skuId.startsWith('SKU-10'))).toBe(false);
    }
  });
});

describe('R-INV-03 재고 게이트 (AC-4-02)', () => {
  const ds = masil();
  it('PLAN-011 만 INVENTORY_BELOW_MIN · STOCKOUT_BEFORE_SETTLEMENT', () => {
    for (const plan of ds.budgetPlan) {
      const g = inventoryGate(ds, { campaignId: plan.campaignId, settlementDate: plan.settlementDate }, '2026-07-20T09:00:00+09:00');
      if (plan.id === 'PLAN-011') {
        expect(g.flags).toEqual(['INVENTORY_BELOW_MIN', 'STOCKOUT_BEFORE_SETTLEMENT']);
        expect(g.skus.find((s) => s.skuId === 'SKU-1001')!.arrivalIfOrderedNow).toBe('2026-10-12');
      } else {
        expect(g.flags).not.toContain('INVENTORY_BELOW_MIN');
      }
    }
  });
  it('집행일이 지금 발주 도착일 이후면 품절 플래그 없음 (min 미달은 유지)', () => {
    const g = inventoryGate(ds, { campaignId: 'CMP-0018', settlementDate: '2026-10-20' }, '2026-07-20T09:00:00+09:00');
    expect(g.flags).toEqual(['INVENTORY_BELOW_MIN']);
  });
});

describe('R-INV-04 보충 제안 (AC-4-04)', () => {
  it('suggestOrder: target = max × avg4w, MOQ 배수 올림', () => {
    expect(suggestOrder({ avg4w: 7910.5, onHand: 23123, inTransit: 15821, safetyMax: 6, moq: 24000 })).toEqual({
      targetQty: 47463,
      suggestedQty: 8519,
      finalQty: 24000,
    });
    expect(suggestOrder({ avg4w: 100, onHand: 1000, inTransit: 0, safetyMax: 6, moq: 50 }).finalQty).toBe(0);
  });
  it('PLAN-011: 1001 24000 · 1002 24000 · 1004 20000, 1003 제안 없음, 합계 1,485,120,000 (FULL)', () => {
    const ds = masil();
    const s = replenishmentSuggestionsForLine(ds, 'CMP-0018');
    expect(Object.fromEntries(s.map((x) => [x.skuId, x.finalQty]))).toEqual({ 'SKU-1001': 24000, 'SKU-1002': 24000, 'SKU-1004': 20000 });
    expect(s.map((x) => x.suggestedQty)).toEqual([8519, 7777, 11637]);
    expect(unitCostFromPurchaseOrders(ds.purchaseOrders, 'SKU-1001')).toBe(21840);
    expect(s.reduce((a, x) => a + x.amountKrw, 0)).toBe(1_485_120_000);
  });
});
