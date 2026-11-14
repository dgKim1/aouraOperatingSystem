/**
 * 원본 CSV → 도메인 타입 변환 (읽기 전용). 각 행의 출처(src_file · src_row)는 rawIndex 로 보존한다.
 * 'NONE' 은 0 과 구분해 null 로 바꾼다 (A05).
 */
import type { MasilDataset } from '@/domain/dataset';
import { krw } from '@/domain/money';
import type { AdMedia, Country, FeeType, InfluencerTier, Platform, ProductLine, SalesChannelKind, SkuCategory } from '@/domain/types';
import type { RawRow, RawTable } from './csv';
import { MASIL_FILES, readRawTable, type MasilFileKey } from './loader';

function v(r: RawRow, col: string): string {
  const x = r.values[col];
  if (x === undefined) throw new Error(`${r.src_file}:${r.src_row}: 열 없음 ${col}`);
  return x;
}
function num(r: RawRow, col: string): number {
  const s = v(r, col);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`${r.src_file}:${r.src_row}: 숫자 아님 ${col}=${s}`);
  return n;
}
function nullable(r: RawRow, col: string): string | null {
  const s = v(r, col);
  return s === 'NONE' ? null : s;
}
function bool(r: RawRow, col: string): boolean {
  return v(r, col) === 'True';
}

export interface LoadedMasil {
  dataset: MasilDataset;
  /** 원본 테이블 (src_file · src_row 포함) — DB 적재(2단계)는 이것을 그대로 raw_* 테이블에 넣는다 */
  tables: Record<MasilFileKey, RawTable>;
}

export function loadMasil(): LoadedMasil {
  const t = {} as Record<MasilFileKey, RawTable>;
  for (const key of Object.keys(MASIL_FILES) as MasilFileKey[]) {
    t[key] = readRawTable(MASIL_FILES[key]);
  }
  const dataset: MasilDataset = {
    influencers: t.influencer.rows.map((r) => ({
      id: v(r, 'influencer_id'),
      name: v(r, 'influencer_name'),
      tier: v(r, 'tier') as InfluencerTier,
      primaryCountry: v(r, 'primary_country') as Country,
      platform: v(r, 'platform') as Platform,
      feeType: v(r, 'fee_type') as FeeType,
    })),
    campaigns: t.campaign.rows.map((r) => ({
      id: v(r, 'campaign_id'),
      name: v(r, 'campaign_name'),
      influencerId: v(r, 'influencer_id'),
      country: v(r, 'country') as Country,
      snsChannel: v(r, 'sns_channel'),
      snsFormat: v(r, 'sns_format'),
      salesChannel: v(r, 'sales_channel') as SalesChannelKind,
      productLine: v(r, 'product_line') as ProductLine,
      startDate: v(r, 'start_date'),
      endDate: v(r, 'end_date'),
      attributionWindowDays: num(r, 'attribution_window_days'),
    })),
    channels: t.channel.rows.map((r) => ({
      id: v(r, 'channel_id'),
      name: v(r, 'channel_name'),
      channelType: v(r, 'channel_type'),
      partnerCode: nullable(r, 'partner_code'),
      country: v(r, 'country'),
      paymentTermsDays: num(r, 'payment_terms_days'),
      effectiveDate: v(r, 'effective_date'),
    })),
    skus: t.sku.rows.map((r) => ({
      id: v(r, 'sku_id'),
      name: v(r, 'sku_name'),
      category: v(r, 'category') as SkuCategory,
      productId: v(r, 'product_id'),
      sourceCompany: v(r, 'source_company'),
      safetyStockWeeksMin: num(r, 'safety_stock_weeks_min'),
      safetyStockWeeksMax: num(r, 'safety_stock_weeks_max'),
      moq: num(r, 'moq'),
      leadTimeWeeks: num(r, 'lead_time_weeks'),
    })),
    budgetPlan: t.budgetPlan.rows.map((r) => ({
      id: v(r, 'plan_id'),
      campaignId: v(r, 'campaign_id'),
      requestedKrw: krw('SAMPLE', num(r, 'requested_budget_krw')),
      expectedGmvKrw: krw('SAMPLE', num(r, 'expected_gmv_krw')),
      settlementDate: v(r, 'settlement_date'),
      contractDeadline: v(r, 'contract_deadline'),
    })),
    orders: t.orders.rows.map((r) => ({
      id: v(r, 'order_id'),
      orderDate: v(r, 'order_date'),
      customerRef: v(r, 'customer_ref'),
      channelId: v(r, 'channel_id'),
      country: v(r, 'country'),
      skuId: v(r, 'sku_id'),
      campaignId: v(r, 'campaign_id'),
      gmvKrw: krw('SAMPLE', num(r, 'gmv_krw')),
      couponDiscountKrw: krw('SAMPLE', num(r, 'coupon_discount_krw')),
    })),
    returns: t.returns.rows.map((r) => ({
      id: v(r, 'return_id'),
      orderId: v(r, 'order_id'),
      refundCompletedDate: v(r, 'refund_completed_date'),
      originalOrderDate: v(r, 'original_order_date'),
      refundAmountKrw: krw('SAMPLE', num(r, 'refund_amount_krw')),
      reason: v(r, 'reason'),
    })),
    coupons: t.coupons.rows.map((r) => ({
      id: v(r, 'coupon_use_id'),
      orderId: v(r, 'order_id'),
      couponId: v(r, 'coupon_id'),
      discountKrw: krw('SAMPLE', num(r, 'discount_krw')),
      stackedFlag: bool(r, 'stacked_flag'),
    })),
    adSpend: t.adSpend.rows.map((r) => {
      const fee = nullable(r, 'influencer_fee_krw');
      return {
        id: v(r, 'spend_id'),
        campaignId: v(r, 'campaign_id'),
        spendDate: v(r, 'spend_date'),
        media: v(r, 'media') as AdMedia,
        platform: v(r, 'platform'),
        snsFormat: v(r, 'sns_format'),
        adCostKrw: krw('SAMPLE', num(r, 'ad_cost_krw')),
        influencerFeeKrw: fee === null ? null : krw('SAMPLE', Number(fee)),
      };
    }),
    costMaster: t.costMaster.rows.map((r) => ({
      skuId: v(r, 'sku_id'),
      channelId: v(r, 'channel_id'),
      productCostKrw: num(r, 'product_cost_krw'),
      channelFeePct: num(r, 'channel_fee_pct'),
      shippingCostKrw: num(r, 'shipping_cost_krw'),
      returnLogisticsCostKrw: num(r, 'return_logistics_cost_krw'),
    })),
    inventory: t.inventory.rows.map((r) => ({
      skuId: v(r, 'sku_id'),
      snapshotDate: v(r, 'snapshot_date'),
      onHandQty: num(r, 'on_hand_qty'),
      inTransitQty: num(r, 'in_transit_qty'),
      stockCoverWeeksReported: num(r, 'stock_cover_weeks'),
    })),
    weeklySales: t.weeklySales.rows.map((r) => ({
      week: v(r, 'week'),
      skuId: v(r, 'sku_id'),
      soldQty: num(r, 'sold_qty'),
    })),
    purchaseOrders: t.purchaseOrders.rows.map((r) => ({
      id: v(r, 'po_id'),
      skuId: v(r, 'sku_id'),
      supplierId: v(r, 'supplier_id'),
      orderDate: v(r, 'order_date'),
      orderQty: num(r, 'order_qty'),
      moq: num(r, 'moq'),
      leadTimeWeeks: num(r, 'lead_time_weeks'),
      amountKrw: krw('FULL', num(r, 'amount_krw')),
      paymentDueDate: v(r, 'payment_due_date'),
    })),
    cashDaily: t.cashDaily.rows.map((r) => ({
      date: v(r, 'date'),
      openingBalance: krw('FULL', num(r, 'opening_balance')),
      inflowKrw: krw('FULL', num(r, 'inflow_krw')),
      outflowKrw: krw('FULL', num(r, 'outflow_krw')),
      closingBalance: krw('FULL', num(r, 'closing_balance')),
      covenantMinKrw: krw('FULL', num(r, 'covenant_min_krw')),
      breachFlag: bool(r, 'breach_flag'),
    })),
    ar: t.ar.rows.map((r) => ({
      id: v(r, 'ar_id'),
      channelId: v(r, 'channel_id'),
      invoiceDate: v(r, 'invoice_date'),
      dueDate: v(r, 'due_date'),
      amountKrw: krw('FULL', num(r, 'amount_krw')),
      outstandingKrw: krw('FULL', num(r, 'outstanding_krw')),
      agingDays: num(r, 'aging_days'),
    })),
    ap: t.ap.rows.map((r) => ({
      id: v(r, 'ap_id'),
      supplierId: v(r, 'supplier_id'),
      poId: nullable(r, 'po_id'),
      invoiceDate: v(r, 'invoice_date'),
      paymentDueDate: v(r, 'payment_due_date'),
      amountKrw: krw('FULL', num(r, 'amount_krw')),
      agingDays: num(r, 'aging_days'),
    })),
    officialForecast: t.cashForecast.rows.map((r) => ({
      forecastDate: v(r, 'forecast_date'),
      week: v(r, 'week'),
      projectedInflowKrw: krw('FULL', num(r, 'projected_inflow_krw')),
      projectedOutflowKrw: krw('FULL', num(r, 'projected_outflow_krw')),
      projectedClosingKrw: krw('FULL', num(r, 'projected_closing_krw')),
    })),
  };
  return { dataset, tables: t };
}

let cache: LoadedMasil | null = null;
/** 프로세스 내 캐시 (원본은 바뀌지 않으므로) */
export function getMasil(): LoadedMasil {
  cache ??= loadMasil();
  return cache;
}
