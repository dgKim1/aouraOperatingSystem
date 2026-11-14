/**
 * 날짜 · 시각 유틸 (순수). 날짜는 'YYYY-MM-DD', 시각은 KST(+09:00) ISO.
 * 영업일 = 월~금, 공휴일 없음 (data_dictionary 2항). 기한 시각 = 해당일 23:59:59 KST (A-13).
 */
import type { IsoDate, IsoDateTime } from './types';

const DAY_MS = 86_400_000;

function toUtcMs(d: IsoDate): number {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, day);
}
function fromUtcMs(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: IsoDate, n: number): IsoDate {
  return fromUtcMs(toUtcMs(d) + n * DAY_MS);
}
/** b − a (달력일) */
export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}
/** 0=일 … 6=토 */
export function weekday(d: IsoDate): number {
  return new Date(toUtcMs(d)).getUTCDay();
}
export function isBusinessDay(d: IsoDate): boolean {
  const w = weekday(d);
  return w !== 0 && w !== 6;
}
/** d 가 영업일이면 d, 아니면 다음 영업일 (A-09) */
export function nextBusinessDayOnOrAfter(d: IsoDate): IsoDate {
  let x = d;
  while (!isBusinessDay(x)) x = addDays(x, 1);
  return x;
}
export function addBusinessDays(d: IsoDate, n: number): IsoDate {
  let x = d;
  let left = n;
  while (left > 0) {
    x = addDays(x, 1);
    if (isBusinessDay(x)) left--;
  }
  return x;
}
export function businessDaysBetween(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let x = start; x <= end; x = addDays(x, 1)) if (isBusinessDay(x)) out.push(x);
  return out;
}
export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}

/** KST 시각 문자열 */
export function kst(date: IsoDate, time = '00:00:00'): IsoDateTime {
  const t = time.length === 5 ? `${time}:00` : time;
  return `${date}T${t}+09:00`;
}
/** 기한 시각: 해당일 23:59:59 KST (A-13, R-DL-06) */
export function deadlineAt(date: IsoDate): IsoDateTime {
  return kst(date, '23:59:59');
}
export function toMs(t: IsoDateTime): number {
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) throw new Error(`시각 형식 오류: ${t}`);
  return ms;
}
export function isAfter(a: IsoDateTime, b: IsoDateTime): boolean {
  return toMs(a) > toMs(b);
}
export function isOnOrAfter(a: IsoDateTime, b: IsoDateTime): boolean {
  return toMs(a) >= toMs(b);
}
/** KST 기준 날짜 부분 */
export function kstDate(t: IsoDateTime): IsoDate {
  return new Date(toMs(t) + 9 * 3_600_000).toISOString().slice(0, 10);
}
/** 기한 경과 여부: simNow > 기한일 23:59:59 KST */
export function isPastDeadline(simNow: IsoDateTime, deadline: IsoDate): boolean {
  return isAfter(simNow, deadlineAt(deadline));
}
