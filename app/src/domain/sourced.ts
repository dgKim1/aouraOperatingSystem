/**
 * Sourced<T> 값 생성 도우미 — 모든 숫자 · 문구에 출처 라벨 · 스케일 · 계산식 · 가정 ID 를 붙인다 (CLAUDE.md 규칙 5, UI-01).
 * 금액은 Money<'FULL'|'SAMPLE'> 로 스케일을 타입에 묶는다 (R-SCALE-01 / UI-02).
 */
import { DOC_FILES, MASIL_FILES } from './files';
import type { Sourced, SourceLabel, SourceRef } from './types';

export type Money<S extends 'FULL' | 'SAMPLE' = 'FULL' | 'SAMPLE'> = Sourced<number> & { scale: S };
export type Num = Sourced<number> & { scale: 'NONE' };
export type Txt = Sourced<string>;

function extra(method?: string, assumptionIds?: string[]) {
  return { ...(method ? { method } : {}), ...(assumptionIds?.length ? { assumptionIds } : {}) };
}

export function money<S extends 'FULL' | 'SAMPLE'>(scale: S, value: number, label: SourceLabel, refs: SourceRef[], method?: string, assumptionIds?: string[]): Money<S> {
  return { value, label, refs, scale, ...extra(method, assumptionIds) };
}
export function num(value: number, label: SourceLabel, refs: SourceRef[], method?: string, assumptionIds?: string[]): Num {
  return { value, label, refs, scale: 'NONE', ...extra(method, assumptionIds) };
}
export function txt(value: string, label: SourceLabel, refs: SourceRef[], method?: string, assumptionIds?: string[]): Txt {
  return { value, label, refs, scale: 'NONE', ...extra(method, assumptionIds) };
}

const F = MASIL_FILES;
/** 공헌이익 계산에 쓰는 원본 (R-CP) */
export const PERF_REFS: SourceRef[] = [{ file: F.orders }, { file: F.returns }, { file: F.adSpend }, { file: F.costMaster }];
export const PERF_ASSUMPTIONS = ['A-01', 'A-02', 'A-03', 'A-04', 'A-05', 'A-06'];
/** 자금 재전망에 쓰는 원본 (R-CASH) */
export const CASH_REFS: SourceRef[] = [{ file: F.cashDaily }, { file: F.ar }, { file: F.ap }, { file: F.purchaseOrders }, { file: DOC_FILES.calc, note: '1.2' }, { file: DOC_FILES.covenant }];
/** 재고 커버에 쓰는 원본 (R-INV) */
export const INV_REFS: SourceRef[] = [{ file: F.inventory }, { file: F.weeklySales }, { file: DOC_FILES.calc, note: '1.3' }];
export const planRef = (column: string, rowKey?: string): SourceRef[] => [{ file: F.budgetPlan, column, ...(rowKey ? { rowKey } : {}) }];
