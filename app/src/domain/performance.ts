/**
 * 실질 공헌이익 (R-CP-01 ~ R-CP-06) — 커머스 표본(SAMPLE) 기준. 결론은 비중 · 순위 · 부호까지.
 *
 * 공식값 cp (A05 5절 단일 차감, R-CP-01):
 *   NetRevenue − COGS − MarketingSpend − ChannelFee − Fulfillment − ReturnLogistics
 *   (GMV 는 이미 쿠폰 반영 후, 환불은 NetRevenue 에서 한 번만 차감)
 * 참고값 cpRefDef14 (calculation_definitions 1.4 문자 그대로, R-CP-02):
 *   위 식에서 CouponDiscount 와 ReturnRefund 를 한 번 더 뺀다 — **이중 차감**. 판단 · 등급 · 순위에 쓰지 않는다.
 *
 * 가정: A-01 주문 1건 = 1EA (원가 · 배송비 주문당 1회), A-02 채널수수료 = GMV × pct (주문별 소수 유지, 그룹 합계에서 1회 half-up 반올림),
 * A-03 반품물류비 반품 주문당 1회, A-04 환불 시 원가 · 수수료 회수 없음, A-05 campaign_id = last-click 7일 귀속, A-06 표본 전 기간.
 */
import type { MasilDataset } from './dataset';
import { roundHalfUp } from './money';
import type { CampaignPerformance, CpGrade, LineStatus } from './types';

export type PerformanceGroupBy = 'CAMPAIGN' | 'INFLUENCER';

type Acc = {
  orderCount: number;
  returnOrderCount: number;
  gmv: number;
  couponDiscount: number;
  returnRefund: number;
  cogs: number;
  /** Σ gmv × pct(×10 정수) — 정수 누적 후 마지막에 1회 반올림 */
  channelFeeScaled: number;
  fulfillmentCost: number;
  returnLogisticsCost: number;
  marketingSpend: number;
};

const FEE_SCALE = 1000; // pct 는 소수 1자리 → ×10, /100 → 합계 /1000

function emptyAcc(): Acc {
  return { orderCount: 0, returnOrderCount: 0, gmv: 0, couponDiscount: 0, returnRefund: 0, cogs: 0, channelFeeScaled: 0, fulfillmentCost: 0, returnLogisticsCost: 0, marketingSpend: 0 };
}

function finalize(key: string, a: Acc): CampaignPerformance {
  const channelFee = roundHalfUp(a.channelFeeScaled / FEE_SCALE);
  const netRevenue = a.gmv - a.returnRefund;
  const cp = netRevenue - a.cogs - a.marketingSpend - channelFee - a.fulfillmentCost - a.returnLogisticsCost;
  const cpRefDef14 = cp - a.couponDiscount - a.returnRefund;
  const div = (x: number, y: number) => (y === 0 ? null : x / y);
  return {
    key,
    orderCount: a.orderCount,
    returnOrderCount: a.returnOrderCount,
    gmv: a.gmv,
    couponDiscount: a.couponDiscount,
    returnRefund: a.returnRefund,
    netRevenue,
    cogs: a.cogs,
    channelFee,
    fulfillmentCost: a.fulfillmentCost,
    returnLogisticsCost: a.returnLogisticsCost,
    marketingSpend: a.marketingSpend,
    cp,
    cpRefDef14,
    nominalRoas: div(a.gmv, a.marketingSpend),
    realRoas: div(cp, a.marketingSpend),
    realRoasRefDef14: div(cpRefDef14, a.marketingSpend),
    returnRate: div(a.returnRefund, a.gmv),
    scale: 'SAMPLE',
  };
}

type PerfInput = Pick<MasilDataset, 'orders' | 'returns' | 'costMaster' | 'adSpend' | 'campaigns'>;

function accumulate(ds: PerfInput, keyOfCampaign: (campaignId: string) => string): Map<string, Acc> {
  const cost = new Map(ds.costMaster.map((c) => [`${c.skuId}|${c.channelId}`, c]));
  const refundByOrder = new Map(ds.returns.map((r) => [r.orderId, r.refundAmountKrw as number]));
  const acc = new Map<string, Acc>();
  const get = (k: string) => {
    let a = acc.get(k);
    if (!a) acc.set(k, (a = emptyAcc()));
    return a;
  };
  for (const o of ds.orders) {
    const c = cost.get(`${o.skuId}|${o.channelId}`);
    if (!c) throw new Error(`원가 마스터 없음: ${o.skuId}×${o.channelId} (주문 ${o.id})`);
    const a = get(keyOfCampaign(o.campaignId));
    a.orderCount++;
    a.gmv += o.gmvKrw;
    a.couponDiscount += o.couponDiscountKrw;
    a.cogs += c.productCostKrw;
    a.channelFeeScaled += o.gmvKrw * Math.round(c.channelFeePct * 10);
    a.fulfillmentCost += c.shippingCostKrw;
    const refund = refundByOrder.get(o.id);
    if (refund !== undefined) {
      a.returnOrderCount++;
      a.returnRefund += refund;
      a.returnLogisticsCost += c.returnLogisticsCostKrw;
    }
  }
  for (const s of ds.adSpend) get(keyOfCampaign(s.campaignId)).marketingSpend += s.adCostKrw;
  return acc;
}

/** 캠페인별 또는 인플루언서별 실질 성과 */
export function computePerformance(ds: PerfInput, by: PerformanceGroupBy): Record<string, CampaignPerformance> {
  const infOf = new Map(ds.campaigns.map((c) => [c.id, c.influencerId]));
  const keyOf =
    by === 'CAMPAIGN'
      ? (id: string) => id
      : (id: string) => {
          const inf = infOf.get(id);
          if (!inf) throw new Error(`캠페인 마스터 없음: ${id}`);
          return inf;
        };
  const out: Record<string, CampaignPerformance> = {};
  for (const [k, a] of [...accumulate(ds, keyOf)].sort(([x], [y]) => x.localeCompare(y))) out[k] = finalize(k, a);
  return out;
}

/** 표본 전체 합계 (채널수수료는 전체 합계에서 1회 반올림) */
export function totalPerformance(ds: PerfInput): CampaignPerformance {
  return finalize('TOTAL', accumulate(ds, () => 'TOTAL').get('TOTAL') ?? emptyAcc());
}

/** R-CP-05 권고 등급 — 공식 cp 부호만 읽는다 (cpRefDef14 를 받지도 않는다) */
export function cpGrade(p: Pick<CampaignPerformance, 'cp'>): CpGrade {
  return p.cp > 0 ? 'CP_POSITIVE' : 'CP_NEGATIVE';
}

/** 참고 플래그 — 1.4 참고값과 공식값의 부호(양수 / 0 이하)가 다름. 화면 참고 표시만 */
export function cpRefSignDiffers(p: Pick<CampaignPerformance, 'cp' | 'cpRefDef14'>): boolean {
  return p.cp > 0 !== p.cpRefDef14 > 0;
}

/** 순위: 값 내림차순, 동점은 key 오름차순 (R-CP-04). 1부터 */
export function rankBy<T extends { key: string }>(rows: readonly T[], value: (r: T) => number): Record<string, number> {
  const sorted = [...rows].sort((a, b) => value(b) - value(a) || a.key.localeCompare(b.key));
  return Object.fromEntries(sorted.map((r, i) => [r.key, i + 1]));
}

export interface InfluencerShare {
  influencerId: string;
  adSpend: number;
  adSpendShare: number;
  adSpendRank: number;
  requested: number;
  requestShare: number;
  requestRank: number;
}

/** R-CP-04 집행 비중(mkt_ad_spend_ms 전액) · 기안 요청 비중 — 인플루언서별 */
export function influencerShares(ds: Pick<MasilDataset, 'adSpend' | 'budgetPlan' | 'campaigns' | 'influencers'>): Record<string, InfluencerShare> {
  const infOf = new Map(ds.campaigns.map((c) => [c.id, c.influencerId]));
  const spend = new Map<string, number>();
  const req = new Map<string, number>();
  for (const s of ds.adSpend) {
    const k = infOf.get(s.campaignId)!;
    spend.set(k, (spend.get(k) ?? 0) + s.adCostKrw);
  }
  for (const p of ds.budgetPlan) {
    const k = infOf.get(p.campaignId)!;
    req.set(k, (req.get(k) ?? 0) + p.requestedKrw);
  }
  const totalSpend = [...spend.values()].reduce((a, b) => a + b, 0);
  const totalReq = [...req.values()].reduce((a, b) => a + b, 0);
  const rows = ds.influencers.map((i) => ({ key: i.id, s: spend.get(i.id) ?? 0, r: req.get(i.id) ?? 0 }));
  const sRank = rankBy(rows, (x) => x.s);
  const rRank = rankBy(rows, (x) => x.r);
  return Object.fromEntries(
    rows.map((x) => [
      x.key,
      {
        influencerId: x.key,
        adSpend: x.s,
        adSpendShare: totalSpend === 0 ? 0 : x.s / totalSpend,
        adSpendRank: sRank[x.key]!,
        requested: x.r,
        requestShare: totalReq === 0 ? 0 : x.r / totalReq,
        requestRank: rRank[x.key]!,
      },
    ]),
  );
}

const DROPPED: ReadonlySet<LineStatus> = new Set<LineStatus>(['CANCELLED', 'REJECTED']);

/**
 * R-CP-06 배분 점검 — 남은 기안(CANCELLED/REJECTED 제외) 기준 인플루언서별 요청 비중.
 * 권한 판정용 '기안 총액'(R-AUTH-01)은 이 값과 무관하게 원래 총액을 쓴다.
 */
export function requestShareRemaining(
  ds: Pick<MasilDataset, 'budgetPlan' | 'campaigns'>,
  lineStatuses: readonly { id: string; status: LineStatus }[],
): { remainingTotal: number; shares: Record<string, number> } {
  const status = new Map(lineStatuses.map((l) => [l.id, l.status]));
  const infOf = new Map(ds.campaigns.map((c) => [c.id, c.influencerId]));
  const by = new Map<string, number>();
  let total = 0;
  for (const p of ds.budgetPlan) {
    const st = status.get(p.id);
    if (st && DROPPED.has(st)) continue;
    const k = infOf.get(p.campaignId)!;
    by.set(k, (by.get(k) ?? 0) + p.requestedKrw);
    total += p.requestedKrw;
  }
  const shares: Record<string, number> = {};
  for (const [k, v] of by) shares[k] = total === 0 ? 0 : v / total;
  return { remainingTotal: total, shares };
}
