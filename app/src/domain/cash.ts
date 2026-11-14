/**
 * 자금 재전망 (R-CASH-01 ~ R-CASH-04) — calculation_definitions 1.2 · covenant_terms_ms. 모두 FULL.
 * Opening = 자금일보 as-of 직전 종가. + AR.outstanding @due, − AP(po_id = NONE 만) @due, − PO.amount @due.
 * AP 중 po_id 가 있는 행은 발주 대금 이중계상이라 제외. 기안 요청액(SAMPLE)은 입력으로 받지 않는다 (R-CASH-04).
 * A-08 기준일 이전 만기: 기본 제외 / 민감도 as-of 반영. A-09 주말 만기 → 다음 영업일.
 */
import type { MasilDataset } from './dataset';
import { addDays, businessDaysBetween, nextBusinessDayOnOrAfter } from './dates';
import type { CashForecastRun, DateWindow, IsoDate } from './types';

export const COVENANT_MIN_KRW = 3_000_000_000;
export const AS_OF: IsoDate = '2026-07-01';

export interface CashSimOptions {
  id: string;
  asOf?: IsoDate;
  /** 기본 as-of + 90일 (1.2 "향후 90일") */
  horizonEnd?: IsoDate;
  overdueAr?: 'EXCLUDE' | 'AS_OF';
  overdueAp?: 'EXCLUDE' | 'AS_OF';
  /** 조건 변경: AR 회수일 변경 (예: MAR-0004 → 2026-08-30) */
  arDueOverrides?: Record<string, IsoDate>;
  /** 원본 전망과 분리한 추가 유출 (신규 보충 발주 등, FULL) */
  extraOutflows?: { id: string; date: IsoDate; amountKrw: number }[];
  inputsVersion?: string[];
  createdAt?: string;
}

export interface CashSimResult extends CashForecastRun {
  opening: number;
  breachBusinessDays: number;
  covenantMinKrw: number;
  options: Omit<CashSimOptions, 'id'>;
}

type Ds = Pick<MasilDataset, 'cashDaily' | 'ar' | 'ap' | 'purchaseOrders'>;

export function simulateCash(ds: Ds, opts: CashSimOptions): CashSimResult {
  const asOf = opts.asOf ?? AS_OF;
  const horizonEnd = opts.horizonEnd ?? addDays(asOf, 90);
  const overdueAr = opts.overdueAr ?? 'EXCLUDE';
  const overdueAp = opts.overdueAp ?? 'EXCLUDE';
  const prior = ds.cashDaily.filter((d) => d.date < asOf).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!prior) throw new Error('자금일보 기초 잔액 없음');
  const opening = prior.closingBalance as number;

  const flows = new Map<IsoDate, number>();
  const place = (date: IsoDate, amount: number, overdue: 'EXCLUDE' | 'AS_OF') => {
    let d = date;
    if (d < asOf) {
      if (overdue === 'EXCLUDE') return;
      d = asOf;
    }
    d = nextBusinessDayOnOrAfter(d);
    flows.set(d, (flows.get(d) ?? 0) + amount);
  };
  for (const ar of ds.ar) place(opts.arDueOverrides?.[ar.id] ?? ar.dueDate, ar.outstandingKrw, overdueAr);
  for (const ap of ds.ap) if (ap.poId === null) place(ap.paymentDueDate, -ap.amountKrw, overdueAp);
  for (const po of ds.purchaseOrders) place(po.paymentDueDate, -po.amountKrw, overdueAp);
  for (const x of opts.extraOutflows ?? []) place(x.date, -x.amountKrw, 'AS_OF');

  const daily: { date: IsoDate; closingKrw: number }[] = [];
  let bal = opening;
  for (const d of businessDaysBetween(asOf, horizonEnd)) {
    bal += flows.get(d) ?? 0;
    daily.push({ date: d, closingKrw: bal });
  }
  let min = daily[0] ?? { date: asOf, closingKrw: opening };
  for (const d of daily) if (d.closingKrw < min.closingKrw) min = d;

  const breachWindows: DateWindow[] = [];
  let breachBusinessDays = 0;
  let cur: DateWindow | null = null;
  for (const d of daily) {
    if (d.closingKrw < COVENANT_MIN_KRW) {
      breachBusinessDays++;
      if (cur) cur.end = d.date;
      else cur = { start: d.date, end: d.date };
    } else if (cur) {
      breachWindows.push(cur);
      cur = null;
    }
  }
  if (cur) breachWindows.push(cur);

  const inputsVersion = [
    ...(opts.inputsVersion ?? []),
    ...Object.entries(opts.arDueOverrides ?? {}).map(([k, v]) => `${k}→${v}`),
    ...(opts.extraOutflows ?? []).map((x) => x.id),
  ];
  const { id: _id, ...rest } = opts;
  void _id;
  return {
    id: opts.id,
    asOf,
    inputsVersion,
    assumptionIds: ['A-08', 'A-09', ...(opts.extraOutflows?.length ? ['A-19'] : [])],
    daily,
    minClosing: { date: min.date, krw: min.closingKrw },
    breachWindows,
    createdAt: opts.createdAt ?? `${asOf}T09:00:00+09:00`,
    opening,
    breachBusinessDays,
    covenantMinKrw: COVENANT_MIN_KRW,
    options: rest,
  };
}

/** 달력일 기준 양끝 포함 */
export function isInWindows(date: IsoDate, windows: readonly DateWindow[]): boolean {
  return windows.some((w) => date >= w.start && date <= w.end);
}

// ───────────────────────── BE-10 공식 전망(주장) 대 재전망 대조 (A-32 · R-CASH-03) ─────────────────────────

export interface OfficialComparisonRow {
  /** 공식 전망 week (월요일) */
  week: IsoDate;
  /** A-32: 직전 화요일 ~ week 월요일 (첫 행은 asOf ~ week) */
  periodStart: IsoDate;
  periodEnd: IsoDate;
  /** CLAIM — 재무팀 공식 전망 projected_closing_krw */
  official: number;
  /** AGGREGATED — 재전망의 week 날짜 종가 (영업일이 아니면 직전 영업일) */
  recalculated: number;
  /** 재전망 − 공식 (음수 = 재전망이 낮음) */
  diff: number;
  /** 기간 안 영업일 중 종가 < 30억 인 날 수 (재전망 기준) */
  belowDays: number;
  belowThreshold: boolean;
}

/**
 * 대조 전용 — 이 결과는 하회 구간 · 권한 판정 · 경고 · 권고의 입력이 아니다 (공식 전망은 주장, R-CLAIM-01).
 * run 은 재전망 1개(v1 또는 현재 버전), official 은 fin_cash_forecast_ms 행.
 */
export function compareOfficialForecast(
  run: Pick<CashSimResult, 'daily' | 'asOf'>,
  official: readonly { week: IsoDate; projectedClosingKrw: number }[],
): OfficialComparisonRow[] {
  const weeks = [...official].sort((a, b) => a.week.localeCompare(b.week));
  return weeks.map((w, i) => {
    const periodStart = i === 0 ? run.asOf : addDays(w.week, -6);
    const periodEnd = w.week;
    const inPeriod = run.daily.filter((d) => d.date >= periodStart && d.date <= periodEnd);
    const onOrBefore = run.daily.filter((d) => d.date <= w.week).at(-1);
    const recalculated = onOrBefore?.closingKrw ?? run.daily[0]?.closingKrw ?? 0;
    const belowDays = inPeriod.filter((d) => d.closingKrw < COVENANT_MIN_KRW).length;
    const off = w.projectedClosingKrw as number;
    return { week: w.week, periodStart, periodEnd, official: off, recalculated, diff: recalculated - off, belowDays, belowThreshold: belowDays > 0 };
  });
}

/** 차이 절댓값 최대 주 (동점은 이른 주) */
export function largestOfficialGap(rows: readonly OfficialComparisonRow[]): OfficialComparisonRow | null {
  let best: OfficialComparisonRow | null = null;
  for (const r of rows) if (!best || Math.abs(r.diff) > Math.abs(best.diff)) best = r;
  return best;
}
