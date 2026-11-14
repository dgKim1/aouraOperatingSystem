/**
 * 재고 커버 (R-INV-01 ~ R-INV-04) — calculation_definitions 1.3. 재고 · 발주는 FULL.
 * 표본 주문은 "주력 SKU 가 무엇인가"(비중, A-16)에만 쓰고, 수량 · 금액에는 쓰지 않는다 (R-SCALE-01, G-13).
 */
import type { MasilDataset } from './dataset';
import { addDays, kstDate } from './dates';
import { krw } from './money';
import type { IsoDate, IsoDateTime, Krw, LineFlag, Order, PurchaseOrder, WeeklySales } from './types';

/** A-16 주력 SKU 기준 */
export const MAIN_SKU_MIN_SHARE = 0.2;

/** R-INV-01 최근 4주 평균 (asOf 이전 주 중 최신 4개) */
export function avg4w(sales: readonly WeeklySales[], skuId: string, asOf: IsoDate): number {
  const rows = sales.filter((s) => s.skuId === skuId && s.week <= asOf).sort((a, b) => b.week.localeCompare(a.week)).slice(0, 4);
  if (rows.length === 0) return 0;
  return rows.reduce((a, r) => a + r.soldQty, 0) / rows.length;
}

/** R-INV-01 coverWeeks = on_hand / 4주 평균 (in_transit 미합산, reserved_qty 없음 G-12) */
export function coverWeeks(onHandQty: number, avg4wDemand: number): number | null {
  return avg4wDemand > 0 ? onHandQty / avg4wDemand : null;
}

/** R-INV-02 예상 품절일 = 스냅샷일 + floor(cover × 7)일 (캠페인 증분 없음, in_transit 입고 제외) */
export function stockoutDate(snapshotDate: IsoDate, cover: number | null): IsoDate | null {
  if (cover === null) return null;
  return addDays(snapshotDate, Math.floor(cover * 7));
}

export interface SkuCoverRow {
  skuId: string;
  name: string;
  category: string;
  snapshotDate: IsoDate;
  avg4w: number;
  onHandQty: number;
  inTransitQty: number;
  coverWeeks: number | null;
  stockCoverWeeksReported: number;
  safetyStockWeeksMin: number;
  safetyStockWeeksMax: number;
  leadTimeWeeks: number;
  moq: number;
  belowMin: boolean;
  stockoutDate: IsoDate | null;
}

export function skuCoverTable(ds: Pick<MasilDataset, 'skus' | 'inventory' | 'weeklySales'>): SkuCoverRow[] {
  return ds.skus.map((sku) => {
    const inv = ds.inventory.find((i) => i.skuId === sku.id);
    if (!inv) throw new Error(`재고 스냅샷 없음: ${sku.id}`);
    const a = avg4w(ds.weeklySales, sku.id, inv.snapshotDate);
    const c = coverWeeks(inv.onHandQty, a);
    return {
      skuId: sku.id,
      name: sku.name,
      category: sku.category,
      snapshotDate: inv.snapshotDate,
      avg4w: a,
      onHandQty: inv.onHandQty,
      inTransitQty: inv.inTransitQty,
      coverWeeks: c,
      stockCoverWeeksReported: inv.stockCoverWeeksReported,
      safetyStockWeeksMin: sku.safetyStockWeeksMin,
      safetyStockWeeksMax: sku.safetyStockWeeksMax,
      leadTimeWeeks: sku.leadTimeWeeks,
      moq: sku.moq,
      belowMin: c !== null && c < sku.safetyStockWeeksMin,
      stockoutDate: stockoutDate(inv.snapshotDate, c),
    };
  });
}

/** A-16 캠페인 주력 SKU = 캠페인 표본 GMV 비중 ≥ 20% (비중 내림차순) */
export function mainSkus(orders: readonly Order[], campaignId: string): { skuId: string; share: number }[] {
  const by = new Map<string, number>();
  let total = 0;
  for (const o of orders) {
    if (o.campaignId !== campaignId) continue;
    by.set(o.skuId, (by.get(o.skuId) ?? 0) + o.gmvKrw);
    total += o.gmvKrw;
  }
  if (total === 0) return [];
  return [...by]
    .map(([skuId, g]) => ({ skuId, share: g / total }))
    .filter((x) => x.share >= MAIN_SKU_MIN_SHARE)
    .sort((a, b) => b.share - a.share || a.skuId.localeCompare(b.skuId));
}

export interface InventoryGateResult {
  flags: LineFlag[];
  skus: (SkuCoverRow & { share: number; arrivalIfOrderedNow: IsoDate; stockoutBeforeSettlement: boolean })[];
}

/**
 * R-INV-03 재고 게이트. 주력 SKU 중 하나라도 cover < min → INVENTORY_BELOW_MIN.
 * 그 SKU 의 예상 품절일 < 집행일 이고 지금 발주해도 도착(simNow + 리드타임) > 집행일 → STOCKOUT_BEFORE_SETTLEMENT.
 * min 이상 SKU 는 in_transit 입고일 미상이라 품절 플래그를 붙이지 않는다.
 */
export function inventoryGate(
  ds: Pick<MasilDataset, 'skus' | 'inventory' | 'weeklySales' | 'orders'>,
  line: { campaignId: string; settlementDate: IsoDate },
  simNow: IsoDateTime,
): InventoryGateResult {
  const table = new Map(skuCoverTable(ds).map((r) => [r.skuId, r]));
  const today = kstDate(simNow);
  const skus = mainSkus(ds.orders, line.campaignId).map(({ skuId, share }) => {
    const row = table.get(skuId)!;
    const arrivalIfOrderedNow = addDays(today, row.leadTimeWeeks * 7);
    const stockoutBeforeSettlement =
      row.belowMin && row.stockoutDate !== null && row.stockoutDate < line.settlementDate && arrivalIfOrderedNow > line.settlementDate;
    return { ...row, share, arrivalIfOrderedNow, stockoutBeforeSettlement };
  });
  const flags: LineFlag[] = [];
  if (skus.some((s) => s.belowMin)) flags.push('INVENTORY_BELOW_MIN');
  if (skus.some((s) => s.stockoutBeforeSettlement)) flags.push('STOCKOUT_BEFORE_SETTLEMENT');
  return { flags, skus };
}

/** R-INV-04 보충 제안 — target = 안전재고 max × 4주 평균 (A-17), MOQ 배수 올림 (A-18) */
export function suggestOrder(i: { avg4w: number; onHand: number; inTransit: number; safetyMax: number; moq: number }): {
  targetQty: number;
  suggestedQty: number;
  finalQty: number;
} {
  const targetQty = i.safetyMax * i.avg4w;
  const suggestedQty = Math.max(targetQty - i.onHand - i.inTransit, 0);
  const finalQty = suggestedQty > 0 ? Math.ceil(suggestedQty / i.moq) * i.moq : 0;
  return { targetQty, suggestedQty, finalQty };
}

/** 기발주 단가 = amount / qty (가장 최근 발주) [AGGREGATED] */
export function unitCostFromPurchaseOrders(pos: readonly PurchaseOrder[], skuId: string): number | null {
  const po = pos.filter((p) => p.skuId === skuId).sort((a, b) => b.orderDate.localeCompare(a.orderDate))[0];
  return po ? po.amountKrw / po.orderQty : null;
}

export interface ReplenishmentSuggestion {
  skuId: string;
  avg4wDemand: number;
  coverWeeks: number | null;
  targetQty: number;
  suggestedQty: number;
  finalQty: number;
  unitCostKrw: number;
  amountKrw: Krw<'FULL'>;
}

/**
 * 기안 건(캠페인)의 주력 SKU 중 **안전재고 min 미달 SKU 에 대해서만** 보충을 제안한다 (AC-4-04 "1003 은 제안 없음(min 이상)").
 * 수량 · 금액은 FULL(재고 · 발주) 원본만 쓴다.
 */
export function replenishmentSuggestionsForLine(
  ds: Pick<MasilDataset, 'skus' | 'inventory' | 'weeklySales' | 'orders' | 'purchaseOrders'>,
  campaignId: string,
): ReplenishmentSuggestion[] {
  const table = new Map(skuCoverTable(ds).map((r) => [r.skuId, r]));
  return mainSkus(ds.orders, campaignId)
    .map((m) => table.get(m.skuId)!)
    .filter((r) => r.belowMin)
    .sort((a, b) => a.skuId.localeCompare(b.skuId))
    .map((r) => {
      const s = suggestOrder({ avg4w: r.avg4w, onHand: r.onHandQty, inTransit: r.inTransitQty, safetyMax: r.safetyStockWeeksMax, moq: r.moq });
      const unit = unitCostFromPurchaseOrders(ds.purchaseOrders, r.skuId) ?? 0;
      return { skuId: r.skuId, avg4wDemand: r.avg4w, coverWeeks: r.coverWeeks, ...s, unitCostKrw: unit, amountKrw: krw('FULL', s.finalQty * unit) };
    });
}

/** A-19 신규 발주 지급일 = 발주일 + 25일 */
export const NEW_PO_PAYMENT_DAYS = 25;
export function expectedPaymentDate(orderDate: IsoDate): IsoDate {
  return addDays(orderDate, NEW_PO_PAYMENT_DAYS);
}
/** A-20 기발주 예상 입고 = 발주일 + 리드타임 */
export function expectedArrivalDate(po: Pick<PurchaseOrder, 'orderDate' | 'leadTimeWeeks'>): IsoDate {
  return addDays(po.orderDate, po.leadTimeWeeks * 7);
}
