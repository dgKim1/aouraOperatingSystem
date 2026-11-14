/**
 * 원본 데이터 읽기 전용 로더. 원본 파일을 쓰거나 옮기지 않는다(CLAUDE.md 절대 규칙 1).
 * 경로: 환경변수 RAW_DATA_DIR 또는 app/ 기준 ../01_참가자_배포용/04_원본데이터
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parsePipeCsv, type RawTable } from './csv';

export function rawRoot(): string {
  return process.env.RAW_DATA_DIR ?? path.resolve(process.cwd(), '..', '01_참가자_배포용', '04_원본데이터');
}

/** relFile 예: '02_masil/marketing/mkt_budget_plan_ms.csv' */
export function readRawTable(relFile: string): RawTable {
  const abs = path.join(rawRoot(), relFile);
  return parsePipeCsv(readFileSync(abs, 'utf8'), relFile);
}

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
