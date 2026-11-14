/**
 * 원본 파일 경로 상수 (04_원본데이터 기준 상대 경로). 도메인 · 서버 · 화면이 출처(refs)를 달 때 같은 문자열을 쓴다.
 * 읽기는 server/raw/loader 가 한다 — 이 파일은 경로 이름만 가진다(파일 접근 없음).
 */
export const MASIL_FILES = {
  influencer: '02_masil/master/m_influencer_ms.csv',
  campaign: '02_masil/master/m_campaign_ms.csv',
  channel: '02_masil/master/m_channel_ms.csv',
  sku: '02_masil/master/m_sku_ms.csv',
  budgetPlan: '02_masil/marketing/mkt_budget_plan_ms.csv',
  orders: '02_masil/marketing/mkt_orders_ms.csv',
  returns: '02_masil/marketing/mkt_returns_ms.csv',
  coupons: '02_masil/marketing/mkt_coupons_ms.csv',
  adSpend: '02_masil/marketing/mkt_ad_spend_ms.csv',
  costMaster: '02_masil/marketing/mkt_cost_master_ms.csv',
  inventory: '02_masil/inventory/sku_inventory_ms.csv',
  weeklySales: '02_masil/inventory/sku_weekly_sales_ms.csv',
  purchaseOrders: '02_masil/inventory/sc_purchase_orders_ms.csv',
  cashDaily: '02_masil/financials/fin_cash_daily_ms.csv',
  ar: '02_masil/financials/fin_ar_aging_ms.csv',
  ap: '02_masil/financials/fin_ap_aging_ms.csv',
  cashForecast: '02_masil/financials/fin_cash_forecast_ms.csv',
} as const;

export type MasilFileKey = keyof typeof MASIL_FILES;

/** 문서형 원본 (시드 상수의 출처) */
export const DOC_FILES = {
  policy: '00_common/approval_authority_policy.md',
  calc: '00_common/calculation_definitions.md',
  covenant: '02_masil/financials/covenant_terms_ms.md',
  contractNotice: '02_masil/marketing/inf001_exclusive_contract_notice.md',
  meetingNotes: '00_common/mkt_meeting_notes_ms.md',
  paymentTermNotice: '02_masil/financials/lc0001_payment_term_notice.md',
} as const;

/** 파일 키 → 스케일 (data_dictionary 6항). 표본 계열은 SAMPLE, 계약 · 재고 · 자금은 FULL, 마스터는 NONE */
export const FILE_SCALE: Record<MasilFileKey, 'FULL' | 'SAMPLE' | 'NONE'> = {
  influencer: 'NONE',
  campaign: 'NONE',
  channel: 'NONE',
  sku: 'NONE',
  budgetPlan: 'SAMPLE',
  orders: 'SAMPLE',
  returns: 'SAMPLE',
  coupons: 'SAMPLE',
  adSpend: 'SAMPLE',
  costMaster: 'NONE',
  inventory: 'FULL',
  weeklySales: 'FULL',
  purchaseOrders: 'FULL',
  cashDaily: 'FULL',
  ar: 'FULL',
  ap: 'FULL',
  cashForecast: 'FULL',
};
