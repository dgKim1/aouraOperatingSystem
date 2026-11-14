import { describe, expect, it } from 'vitest';
import { parsePipeCsv } from '@/server/raw/csv';
import { getMasil } from '@/server/raw/masil';

describe('원본 로더 (읽기 전용, | 구분)', () => {
  it('파이프 CSV 를 파싱하고 src_file · src_row(헤더 제외 1부터)를 보존한다', () => {
    const t = parsePipeCsv('a|b\n1|NONE\n2|x\n', 'f.csv');
    expect(t.header).toEqual(['a', 'b']);
    expect(t.rows[0]).toEqual({ src_file: 'f.csv', src_row: 1, values: { a: '1', b: 'NONE' } });
    expect(t.rows[1]?.src_row).toBe(2);
  });

  it('열 수가 헤더와 다르면 오류', () => {
    expect(() => parsePipeCsv('a|b\n1\n', 'f.csv')).toThrow();
  });

  it('W02 원본 행 수가 ONTOLOGY 1-1 과 같다', () => {
    const { tables, dataset } = getMasil();
    expect(tables.orders.rows).toHaveLength(15650);
    expect(tables.returns.rows).toHaveLength(1719);
    expect(tables.coupons.rows).toHaveLength(4672);
    expect(tables.adSpend.rows).toHaveLength(225);
    expect(tables.budgetPlan.rows).toHaveLength(25);
    expect(dataset.campaigns).toHaveLength(25);
    expect(dataset.influencers).toHaveLength(10);
    expect(dataset.inventory).toHaveLength(14);
    expect(dataset.purchaseOrders).toHaveLength(14);
    expect(tables.budgetPlan.rows[0]).toMatchObject({
      src_file: '02_masil/marketing/mkt_budget_plan_ms.csv',
      src_row: 1,
      values: { plan_id: 'PLAN-001' },
    });
  });

  it("'NONE' 은 0 이 아니라 null 로 변환한다", () => {
    const { dataset } = getMasil();
    expect(dataset.ap.filter((a) => a.poId === null)).toHaveLength(10);
    expect(dataset.adSpend.filter((a) => a.media !== '인플루언서').every((a) => a.influencerFeeKrw === null)).toBe(true);
  });

  it('데이터 정합 확인: 반품은 주문당 최대 1건, 쿠폰 행 금액 = 주문 쿠폰액, 인플루언서 fee = ad_cost', () => {
    const { dataset } = getMasil();
    const ret = new Set<string>();
    for (const r of dataset.returns) {
      expect(ret.has(r.orderId)).toBe(false);
      ret.add(r.orderId);
    }
    const orderCoupon = new Map(dataset.orders.map((o) => [o.id, o.couponDiscountKrw as number]));
    for (const c of dataset.coupons) expect(orderCoupon.get(c.orderId)).toBe(c.discountKrw);
    const inf = dataset.adSpend.filter((a) => a.media === '인플루언서');
    expect(inf).toHaveLength(75);
    for (const a of inf) expect(a.influencerFeeKrw).toBe(a.adCostKrw);
  });
});
