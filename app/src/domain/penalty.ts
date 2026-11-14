/**
 * R-PEN-01 자동 갱신 후 중도 해지 위약금 = 고정 피 × 잔여개월/12 × 50%. 원 단위 내림.
 * 50% 는 ORIGINAL(통보서), 12개월 균등(월할)은 ASSUMPTION A-15. 금액은 FULL — 표본 성과와 곱하지 않는다.
 * 잔여개월 = 해지일이 속한 달 다음 달부터 갱신 기간 마지막 달까지.
 */
import { addDays } from './dates';
import type { IsoDate, Krw } from './types';

export interface PenaltyResult {
  terminateOn: IsoDate;
  renewalStart: IsoDate;
  renewalEnd: IsoDate;
  remainingMonths: number;
  amountKrw: number;
  assumptionIds: string[];
}

const ym = (d: IsoDate) => {
  const [y, m] = d.split('-').map(Number) as [number, number];
  return y * 12 + (m - 1);
};

export function renewalTerm(c: { currentTermEnd: IsoDate; autoRenewalTermMonths: number }): { start: IsoDate; end: IsoDate } {
  const start = addDays(c.currentTermEnd, 1);
  const endYm = ym(start) + c.autoRenewalTermMonths; // 다음 기간 시작 월
  const y = Math.floor(endYm / 12);
  const m = (endYm % 12) + 1;
  const firstOfNext = `${y}-${String(m).padStart(2, '0')}-01`;
  return { start, end: addDays(firstOfNext, -1) };
}

export function penalty(
  c: { fixedFeeAnnualKrw: Krw<'FULL'>; earlyTerminationPenaltyRate: number; currentTermEnd: IsoDate; autoRenewalTermMonths: number },
  terminateOn: IsoDate,
): PenaltyResult {
  const { start, end } = renewalTerm(c);
  let remainingMonths = 0;
  if (terminateOn >= start && terminateOn < end) remainingMonths = ym(end) - ym(terminateOn);
  const amountKrw = Math.floor((c.fixedFeeAnnualKrw * remainingMonths * c.earlyTerminationPenaltyRate) / 12);
  return { terminateOn, renewalStart: start, renewalEnd: end, remainingMonths, amountKrw, assumptionIds: ['A-15'] };
}
