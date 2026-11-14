/** 기한 (R-DL-03 ~ R-DL-06) */
import { addDays, deadlineAt, diffDays, isPastDeadline, kstDate } from './dates';
import type { DeadlineLevel, IsoDate, IsoDateTime } from './types';

/** 남은 달력일 (KST 날짜 기준) */
export function daysLeft(simNow: IsoDateTime, deadline: IsoDate): number {
  return diffDays(kstDate(simNow), deadline);
}

/** R-DL-03 (A-25): > 7 정보 · ≤ 7 경고 · ≤ 3 위험 · 경과 */
export function deadlineLevel(simNow: IsoDateTime, deadline: IsoDate): DeadlineLevel {
  if (isPastDeadline(simNow, deadline)) return 'PASSED';
  const d = daysLeft(simNow, deadline);
  if (d <= 3) return 'DANGER';
  if (d <= 7) return 'WARNING';
  return 'INFO';
}

export type InternalDueKind = 'CONTRACT_APPROVAL' | 'SEND_NOTICE' | 'CONFIRM_RECEIPT' | 'LINE_APPROVAL';
const OFFSET: Record<InternalDueKind, number> = { CONTRACT_APPROVAL: -2, SEND_NOTICE: -1, CONFIRM_RECEIPT: 0, LINE_APPROVAL: -1 };

/** R-DL-04 (A-12) 내부 처리 기한 */
export function internalDueAt(kind: InternalDueKind, hardDeadline: IsoDate): IsoDateTime {
  return deadlineAt(addDays(hardDeadline, OFFSET[kind]));
}

/** R-DL-05 (A-26) 결정 필요 시점 = min(집행일, 확정기한). 기한 전이는 확정기한 기준 유지 */
export function decisionNeededBy(l: { settlementDate: IsoDate; contractDeadline: IsoDate }): { date: IsoDate; settlementBeforeDeadline: boolean } {
  const before = l.settlementDate < l.contractDeadline;
  return { date: before ? l.settlementDate : l.contractDeadline, settlementBeforeDeadline: before };
}
