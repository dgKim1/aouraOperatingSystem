/**
 * 명목 ROAS vs 실질 ROAS(공식) 가로 막대 — 비율(배수)이라 금액 축이 아니다. 0 기준선 · 음수는 왼쪽.
 * 색 2개(명목 회색 · 실질 진한 파랑, 음수는 빨강)와 막대 끝 숫자 라벨.
 */
export interface RoasRow {
  id: string;
  name: string;
  nominal: number | null;
  real: number | null;
}

export function RoasBars({ rows, caption }: { rows: RoasRow[]; caption: string }) {
  const vals = rows.flatMap((r) => [r.nominal ?? 0, r.real ?? 0]);
  const max = Math.max(...vals, 0.1);
  const min = Math.min(...vals, 0);
  const W = 560;
  const L = 130;
  const R = 50;
  const plot = W - L - R;
  const x = (v: number) => L + ((v - min) / (max - min)) * plot;
  const rowH = 30;
  const H = 24 + rows.length * rowH;
  return (
    <figure className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl" role="img" aria-label={caption}>
        <line x1={x(0)} x2={x(0)} y1={16} y2={H} className="stroke-zinc-500" />
        <text x={x(0)} y={11} textAnchor="middle" className="fill-zinc-600 text-[10px]">
          0
        </text>
        {rows.map((r, i) => {
          const top = 20 + i * rowH;
          const bar = (v: number | null, off: number, cls: string) =>
            v === null ? null : (
              <g>
                <rect x={Math.min(x(0), x(v))} y={top + off} width={Math.max(1, Math.abs(x(v) - x(0)))} height={10} className={cls} />
                <text x={v >= 0 ? x(v) + 4 : x(v) - 4} y={top + off + 9} textAnchor={v >= 0 ? 'start' : 'end'} className="fill-zinc-800 text-[10px] tabular-nums">
                  {v.toFixed(2)}
                </text>
              </g>
            );
          return (
            <g key={r.id}>
              <text x={L - 8} y={top + 14} textAnchor="end" className="fill-zinc-700 text-[11px]">
                {r.name}
              </text>
              {bar(r.nominal, 0, 'fill-zinc-400')}
              {bar(r.real, 12, (r.real ?? 0) < 0 ? 'fill-red-600' : 'fill-blue-800')}
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap items-center gap-3 text-xs text-zinc-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-4 bg-zinc-400" /> 명목 ROAS (GMV / Spend)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-4 bg-blue-800" /> 실질 ROAS (공식 cp / Spend)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-4 bg-red-600" /> 실질 음수
        </span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}
