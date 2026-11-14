/** 표시 형식만 (계산 없음). 금액: 원 단위 천 단위 구분 · 날짜: YYYY-MM-DD */

export function fmtKrw(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

export function fmtInt(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 비율(소수) → % (소수 digits 자리) */
export function fmtPct(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function fmtDec(n: number, digits = 2): string {
  return n.toFixed(digits);
}

/** ISO 시각 → 'YYYY-MM-DD HH:mm' (문자열 그대로 자름 — KST 오프셋 문자열 전제) */
export function fmtDateTime(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

export function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

/** 남은 일수 → 'D-16' / 'D-day' / '경과' */
export function fmtDays(days: number): string {
  if (days > 0) return `D-${days}`;
  if (days === 0) return 'D-day';
  return `경과 ${-days}일`;
}
