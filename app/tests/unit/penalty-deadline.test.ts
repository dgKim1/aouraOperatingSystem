/** R-PEN-01 · R-DL-03/04/05 */
import { describe, expect, it } from 'vitest';
import { penalty } from '@/domain/penalty';
import { daysLeft, deadlineLevel, decisionNeededBy, internalDueAt } from '@/domain/deadline';
import { krw } from '@/domain/money';

const CONTRACT = { fixedFeeAnnualKrw: krw('FULL', 2_800_000_000), earlyTerminationPenaltyRate: 0.5, currentTermEnd: '2026-08-31', autoRenewalTermMonths: 12 };

describe('R-PEN-01 자동 갱신 후 중도 해지 위약금 (AC-3-07)', () => {
  it('2026-09-30 해지 → 잔여 11개월 → 1,283,333,333', () => {
    expect(penalty(CONTRACT, '2026-09-30')).toMatchObject({ remainingMonths: 11, amountKrw: 1_283_333_333 });
  });
  it('2026-12-31 해지 → 잔여 8개월 → 933,333,333', () => {
    expect(penalty(CONTRACT, '2026-12-31')).toMatchObject({ remainingMonths: 8, amountKrw: 933_333_333 });
  });
  it('갱신 기간 시작 전(만료 전) 해지는 위약금 없음', () => {
    expect(penalty(CONTRACT, '2026-08-31').amountKrw).toBe(0);
  });
  it('갱신 기간 종료 이후는 0', () => {
    expect(penalty(CONTRACT, '2027-08-31').amountKrw).toBe(0);
  });
});

describe('R-DL-03 경고 단계 (A-25)', () => {
  it('7/1 기준 7/17 → D-16 정보', () => {
    expect(daysLeft('2026-07-01T09:00:00+09:00', '2026-07-17')).toBe(16);
    expect(deadlineLevel('2026-07-01T09:00:00+09:00', '2026-07-17')).toBe('INFO');
  });
  it('D-7 경고 · D-3 위험 · 경과', () => {
    expect(deadlineLevel('2026-07-10T14:00:00+09:00', '2026-07-17')).toBe('WARNING');
    expect(deadlineLevel('2026-07-14T09:00:00+09:00', '2026-07-17')).toBe('DANGER');
    expect(deadlineLevel('2026-07-17T23:59:59+09:00', '2026-07-17')).toBe('DANGER');
    expect(deadlineLevel('2026-07-18T00:00:00+09:00', '2026-07-17')).toBe('PASSED');
  });
});

describe('R-DL-04 내부 처리 기한 (A-12)', () => {
  it('계약 승인 D-2 · 통보 D-1 · 기안 승인 D-1', () => {
    expect(internalDueAt('CONTRACT_APPROVAL', '2026-07-17')).toBe('2026-07-15T23:59:59+09:00');
    expect(internalDueAt('SEND_NOTICE', '2026-07-17')).toBe('2026-07-16T23:59:59+09:00');
    expect(internalDueAt('LINE_APPROVAL', '2026-07-17')).toBe('2026-07-16T23:59:59+09:00');
    expect(internalDueAt('CONFIRM_RECEIPT', '2026-07-17')).toBe('2026-07-17T23:59:59+09:00');
  });
});

describe('R-DL-05 결정 필요 시점 (A-26)', () => {
  it('집행일 < 기한이면 집행일, 아니면 기한', () => {
    expect(decisionNeededBy({ settlementDate: '2026-07-17', contractDeadline: '2026-08-14' })).toEqual({ date: '2026-07-17', settlementBeforeDeadline: true });
    expect(decisionNeededBy({ settlementDate: '2026-08-31', contractDeadline: '2026-08-14' })).toEqual({ date: '2026-08-14', settlementBeforeDeadline: false });
  });
});
