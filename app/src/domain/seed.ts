/**
 * 문서형 원본(.md)을 시드 상수로 옮긴 것 (ONTOLOGY 1-1 끝). refs 로 출처를 단다.
 */
import { krw } from './money';
import type { ExclusiveContract, IsoDateTime, SourceRef } from './types';

export const CONTRACT_REFS: SourceRef[] = [{ file: '02_masil/marketing/inf001_exclusive_contract_notice.md', note: 'INF-001 연간 전속계약 갱신 통보' }];

/** INF-001 전속계약 — 값은 ORIGINAL(통보서), id 는 ASSUMPTION */
export function seedContract(): ExclusiveContract {
  return {
    id: 'CTR-INF-001-2026',
    influencerId: 'INF-001',
    contractType: 'ANNUAL_EXCLUSIVE',
    fixedFeeAnnualKrw: krw('FULL', 2_800_000_000),
    performanceFeeTerms: null,
    currentTermEnd: '2026-08-31',
    noticeDeadline: '2026-07-17',
    autoRenewalTermMonths: 12,
    earlyTerminationPenaltyRate: 0.5,
    feePaymentSchedule: null,
    status: 'ACTIVE',
    decision: null,
  };
}

/** A-21 가상 기준시각 시작 */
export const SIM_START: IsoDateTime = '2026-07-01T09:00:00+09:00';
export const PROPOSAL_ID = 'PROP-2026-07';
