/**
 * 일별 종가 선 차트 (풀스케일만) — 30억 기준선 · 하회 구간 음영(현재 · 이전 재전망).
 * 표본 금액은 이 축에 넣지 않는다 (UI-02). 재무팀 공식 전망(주장)은 차트에 넣지 않고 「주장 · 참고」 표로만 (UI-03).
 */
import { diffDays } from '@/domain/dates';

export function CashLine({
  daily,
  priorDaily,
  covenant,
  windows,
  priorWindows,
  caption,
}: {
  daily: { date: string; closingKrw: number }[];
  priorDaily?: { date: string; closingKrw: number }[] | undefined;
  covenant: number;
  windows: { start: string; end: string }[];
  priorWindows?: { start: string; end: string }[] | undefined;
  caption: string;
}) {
  if (daily.length === 0) return null;
  const W = 760;
  const H = 260;
  const L = 70;
  const R = 12;
  const T = 12;
  const B = 28;
  const start = daily[0]!.date;
  const end = daily.at(-1)!.date;
  const span = Math.max(1, diffDays(start, end));
  const all = [...daily, ...(priorDaily ?? [])].map((d) => d.closingKrw).concat(covenant);
  const max = Math.max(...all);
  const min = Math.min(...all, 0);
  const x = (d: string) => L + (diffDays(start, d) / span) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const path = (rows: { date: string; closingKrw: number }[]) => rows.map((d, i) => `${i ? 'L' : 'M'}${x(d.date).toFixed(1)},${y(d.closingKrw).toFixed(1)}`).join(' ');
  const ticks = [0, 2e9, 4e9, 6e9].filter((t) => t <= max);
  const months = ['2026-07-01', '2026-08-01', '2026-09-01'].filter((m) => m >= start && m <= end);
  return (
    <figure className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption}>
        {(priorWindows ?? []).map((w) => (
          <rect key={`p${w.start}`} x={x(w.start)} y={T} width={x(w.end) - x(w.start)} height={H - T - B} className="fill-red-50 stroke-red-300" strokeDasharray="4 3" />
        ))}
        {windows.map((w) => (
          <rect key={`c${w.start}`} x={x(w.start)} y={T} width={x(w.end) - x(w.start)} height={H - T - B} className="fill-red-200/60" />
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-zinc-200" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="fill-zinc-600 text-[10px]">
              {t / 1e8}억
            </text>
          </g>
        ))}
        {months.map((m) => (
          <text key={m} x={x(m)} y={H - 10} className="fill-zinc-600 text-[10px]">
            {Number(m.slice(5, 7))}월
          </text>
        ))}
        <line x1={L} x2={W - R} y1={y(covenant)} y2={y(covenant)} className="stroke-red-700" strokeDasharray="6 4" strokeWidth={1.5} />
        <text x={W - R} y={y(covenant) - 4} textAnchor="end" className="fill-red-800 text-[10px] font-semibold">
          covenant 30억
        </text>
        {priorDaily && <path d={path(priorDaily)} className="fill-none stroke-zinc-400" strokeWidth={1.5} strokeDasharray="3 3" />}
        <path d={path(daily)} className="fill-none stroke-blue-800" strokeWidth={2} />
      </svg>
      <figcaption className="flex flex-wrap gap-3 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-0.5 w-5 bg-blue-800" /> 현재 재전망 일별 종가 (영업일)
        </span>
        {priorDaily && (
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-5 border-t border-dashed border-zinc-500" /> 이전 재전망 (v1)
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-5 bg-red-200" /> 하회 예상 구간
        </span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}
