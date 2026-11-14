/** 도메인 함수가 받는 원본 데이터 묶음 (적재 방식과 무관 — 파일 · DB 어디서 읽어도 같은 모양). */
import type {
  AdSpend,
  ApItem,
  ArItem,
  Campaign,
  CashDaily,
  Channel,
  CostMaster,
  Influencer,
  InventorySnapshot,
  Krw,
  OfficialForecastWeek,
  Order,
  PurchaseOrder,
  ReturnRow,
  Sku,
  WeeklySales,
  IsoDate,
} from './types';

/** 기안 원본 행 (mkt_budget_plan_ms) — SAMPLE. expectedGmvKrw 는 CLAIM */
export interface BudgetPlanRow {
  id: string;
  campaignId: string;
  requestedKrw: Krw<'SAMPLE'>;
  expectedGmvKrw: Krw<'SAMPLE'>;
  settlementDate: IsoDate;
  contractDeadline: IsoDate;
}

export interface CouponUse {
  id: string;
  orderId: string;
  couponId: string;
  discountKrw: Krw<'SAMPLE'>;
  stackedFlag: boolean;
}

export interface MasilDataset {
  influencers: Influencer[];
  campaigns: Campaign[];
  channels: Channel[];
  skus: Sku[];
  budgetPlan: BudgetPlanRow[];
  orders: Order[];
  returns: ReturnRow[];
  coupons: CouponUse[];
  adSpend: AdSpend[];
  costMaster: CostMaster[];
  inventory: InventorySnapshot[];
  weeklySales: WeeklySales[];
  purchaseOrders: PurchaseOrder[];
  cashDaily: CashDaily[];
  ar: ArItem[];
  ap: ApItem[];
  /** CLAIM — 재무팀 공식 전망 */
  officialForecast: OfficialForecastWeek[];
}
