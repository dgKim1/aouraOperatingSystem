/**
 * 기울기 차트 — 집행 비중 순위(왼쪽) vs 실질 공헌이익(공식값) 순위(오른쪽). 순위만 그린다(금액 축 없음).
 * 강조: 받은 highlight 목록만 색, 나머지는 회색. 양 끝에 직접 라벨. 표가 같은 값을 텍스트로 제공한다.
 */
export interface SlopeRow {
  id: string;
  name: string;
  left: number;
  right: number;
}

export function SlopeChart({ rows, leftTitle, rightTitle, highlight, caption }: { rows: SlopeRow[]; leftTitle: string; rightTitle: string; highlight: string[]; caption: string }) {
  const n = Math.max(...rows.map((r) => Math.max(r.left, r.right)), 1);
  const W = 520;
  const H = 40 + n * 28;
  const x1 = 150;
  const x2 = W - 150;
  const y = (rank: number) => 30 + (rank - 1) * 28;
  const sorted = [...rows].sort((a, b) => Number(highlight.includes(a.id)) - Number(highlight.includes(b.id)));
  return (
    <figure className="space-y-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img" aria-label={caption}>
        <text x={x1} y={14} textAnchor="middle" className="fill-zinc-700 text-[11px] font-semibold">
          {leftTitle}
        </text>
        <text x={x2} y={14} textAnchor="middle" className="fill-zinc-700 text-[11px] font-semibold">
          {rightTitle}
        </text>
        <line x1={x1} x2={x1} y1={22} y2={H - 6} className="stroke-zinc-300" />
        <line x1={x2} x2={x2} y1={22} y2={H - 6} className="stroke-zinc-300" />
        {sorted.map((r) => {
          const hi = highlight.includes(r.id);
          const cls = hi ? 'stroke-red-600' : 'stroke-zinc-400';
          const txt = hi ? 'fill-red-800 font-semibold' : 'fill-zinc-600';
          return (
            <g key={r.id}>
              <line x1={x1} x2={x2} y1={y(r.left)} y2={y(r.right)} className={cls} strokeWidth={hi ? 2.5 : 1.25} />
              <circle cx={x1} cy={y(r.left)} r={4} className={hi ? 'fill-red-600' : 'fill-zinc-400'} />
              <circle cx={x2} cy={y(r.right)} r={4} className={hi ? 'fill-red-600' : 'fill-zinc-400'} />
              <text x={x1 - 8} y={y(r.left) + 4} textAnchor="end" className={`text-[11px] ${txt}`}>
                {r.left}위 {r.name}
              </text>
              <text x={x2 + 8} y={y(r.right) + 4} className={`text-[11px] ${txt}`}>
                {r.right}위 {r.name}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs text-zinc-600">{caption}</figcaption>
    </figure>
  );
}
