'use client';
/**
 * S-10 일별 종가 차트 (풀스케일만 — 표본 금액 없음, UI-02).
 * - 재전망: 현재 실선 · 이전(v1) 점선 겹쳐 보기, 30억 covenant 기준선, 하회 구간 음영(현재 실선 · 이전 점선 테두리).
 * - 재무팀 공식 전망(주장): 다른 색(보라) · 다른 모양(마름모) 점을 `week` 날짜(월요일)에 찍는다(A-32). 범례 · 툴팁에 `주장` 배지 + 출처.
 *   공식 전망은 대조용 — 하회 구간 · 경고 · 권고는 재전망만 쓴다(UI-03). 화면은 받은 값을 그리기만 한다.
 * - 같은 값은 차트 아래 비교표로도 있다(색만으로 구분하지 않도록 모양 · 선 종류를 달리함, 표가 접근성 대체 수단).
 */
import { useState } from 'react';
import { diffDays } from '@/domain/dates';
import type { Money } from '@/domain/api-types';
import { SourceBadgeStatic } from '../badges/source-badge';
import { ScaleBadge } from '../badges/scale-badge';
import { fmtKrw } from '../format';

interface Daily {
  date: string;
  closingKrw: number;
}

export interface OfficialPoint {
  week: string;
  closing: Money<'FULL'>;
}

const PURPLE = '#7c3aed';

export function CashLine({
  daily,
  currentId,
  priorDaily,
  priorId,
  covenant,
  windows,
  priorWindows,
  official,
  caption,
}: {
  daily: Daily[];
  currentId: string;
  priorDaily?: Daily[] | undefined;
  priorId?: string | undefined;
  covenant: number;
  windows: { start: string; end: string }[];
  priorWindows?: { start: string; end: string }[] | undefined;
  official: OfficialPoint[];
  caption: string;
}) {
  const [hover, setHover] = useState<{ kind: 'official'; p: OfficialPoint } | { kind: 'daily'; d: Daily; prior?: Daily | undefined } | null>(null);
  if (daily.length === 0) return null;
  const W = 820;
  const H = 300;
  const L = 64;
  const R = 16;
  const T = 14;
  const B = 30;
  const start = daily[0]!.date;
  const lastOfficial = official.at(-1)?.week ?? start;
  const end = [daily.at(-1)!.date, lastOfficial].sort().at(-1)!;
  const span = Math.max(1, diffDays(start, end));
  const values = [...daily, ...(priorDaily ?? [])].map((d) => d.closingKrw).concat(covenant, ...official.map((o) => o.closing.value));
  const max = Math.ceil(Math.max(...values) / 1e9) * 1e9;
  const min = Math.min(0, ...values);
  const x = (d: string) => L + (diffDays(start, d) / span) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const path = (rows: Daily[]) => rows.map((d, i) => `${i ? 'L' : 'M'}${x(d.date).toFixed(1)},${y(d.closingKrw).toFixed(1)}`).join(' ');
  const ticks: number[] = [];
  for (let t = 0; t <= max; t += 2e9) ticks.push(t);
  const months = ['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'].filter((m) => m >= start && m <= end);
  const priorByDate = new Map((priorDaily ?? []).map((d) => [d.date, d]));
  const tipX = hover ? (hover.kind === 'official' ? x(hover.p.week) : x(hover.d.date)) : 0;

  return (
    <figure className="space-y-2">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={caption} onMouseLeave={() => setHover(null)}>
          {(priorWindows ?? []).map((w) => (
            <rect key={`p${w.start}`} x={x(w.start)} y={T} width={Math.max(1, x(w.end) - x(w.start))} height={H - T - B} fill="none" stroke="#f87171" strokeDasharray="4 3" />
          ))}
          {windows.map((w) => (
            <rect key={`c${w.start}`} x={x(w.start)} y={T} width={Math.max(1, x(w.end) - x(w.start))} height={H - T - B} fill="#fecaca" fillOpacity={0.55} />
          ))}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e4e4e7" />
              <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#52525b">
                {t / 1e8}억
              </text>
            </g>
          ))}
          {months.map((m) => (
            <text key={m} x={x(m)} y={H - 10} fontSize={10} fill="#52525b">
              {Number(m.slice(5, 7))}월
            </text>
          ))}
          <line x1={L} x2={W - R} y1={y(covenant)} y2={y(covenant)} stroke="#b91c1c" strokeDasharray="6 4" strokeWidth={1.5} />
          <text x={W - R} y={y(covenant) - 4} textAnchor="end" fontSize={10} fontWeight={600} fill="#991b1b">
            covenant 30억 (원본)
          </text>
          {priorDaily && <path d={path(priorDaily)} fill="none" stroke="#71717a" strokeWidth={1.5} strokeDasharray="4 3" />}
          <path d={path(daily)} fill="none" stroke="#1e40af" strokeWidth={2} />
          {/* 일별 값 hover 영역 */}
          {daily.map((d) => (
            <rect
              key={`h${d.date}`}
              x={x(d.date) - 3}
              y={T}
              width={6}
              height={H - T - B}
              fill="transparent"
              onMouseEnter={() => setHover({ kind: 'daily', d, prior: priorByDate.get(d.date) })}
            />
          ))}
          {/* 공식 전망 (주장) — 보라 마름모 */}
          {official.map((o) => {
            const cx = x(o.week);
            const cy = y(o.closing.value);
            return (
              <g
                key={o.week}
                tabIndex={0}
                role="button"
                aria-label={`재무팀 공식 전망 (주장) 주 ${o.week} 종가 ${fmtKrw(o.closing.value)}`}
                onMouseEnter={() => setHover({ kind: 'official', p: o })}
                onFocus={() => setHover({ kind: 'official', p: o })}
                onBlur={() => setHover(null)}
                className="cursor-pointer outline-none focus-visible:[&>path]:stroke-black"
              >
                <path d={`M${cx},${cy - 6} L${cx + 6},${cy} L${cx},${cy + 6} L${cx - 6},${cy} Z`} fill={PURPLE} stroke="white" strokeWidth={1.5} />
              </g>
            );
          })}
          {hover && <line x1={tipX} x2={tipX} y1={T} y2={H - B} stroke="#a1a1aa" strokeDasharray="2 2" pointerEvents="none" />}
        </svg>
        {hover && (
          <div className="pointer-events-none absolute top-1 z-10 w-72 rounded-md border bg-white p-2 text-xs shadow-md" style={{ left: `${Math.min(70, Math.max(0, (tipX / W) * 100 - 15))}%` }} role="status">
            {hover.kind === 'official' ? (
              <>
                <p className="flex items-center gap-1 font-semibold" style={{ color: PURPLE }}>
                  ◆ 재무팀 공식 전망 · 주 {hover.p.week} <SourceBadgeStatic label="CLAIM" />
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-1 tabular-nums">
                  예상 종가 {fmtKrw(hover.p.closing.value)} <ScaleBadge scale="FULL" />
                </p>
                <p className="mt-1 text-zinc-600">
                  출처 {hover.p.closing.refs.map((r) => `${r.file.split('/').at(-1)} · week ${r.rowKey ?? hover.p.week} · ${r.column ?? 'projected_closing_krw'}`).join(', ')}
                </p>
                <p className="mt-1 text-purple-900">대조용 주장 — 하회 구간 · 권한 판정 · 경고에 쓰지 않음</p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-1 font-semibold text-blue-900">
                  {hover.d.date} 재전망 종가 <SourceBadgeStatic label="AGGREGATED" />
                </p>
                <p className="mt-1 tabular-nums">
                  {currentId}: {fmtKrw(hover.d.closingKrw)}
                </p>
                {hover.prior && hover.prior.closingKrw !== hover.d.closingKrw && (
                  <p className="tabular-nums text-zinc-600">
                    {priorId}: {fmtKrw(hover.prior.closingKrw)}
                  </p>
                )}
                {hover.d.closingKrw < covenant && <p className="font-semibold text-red-800">30억 하회</p>}
              </>
            )}
          </div>
        )}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-700">
        <span className="inline-flex items-center gap-1">
          <svg width="22" height="6" aria-hidden>
            <line x1="0" x2="22" y1="3" y2="3" stroke="#1e40af" strokeWidth="2" />
          </svg>
          현재 재전망 {currentId} 일별 종가 <SourceBadgeStatic label="AGGREGATED" />
        </span>
        {priorDaily && (
          <span className="inline-flex items-center gap-1">
            <svg width="22" height="6" aria-hidden>
              <line x1="0" x2="22" y1="3" y2="3" stroke="#71717a" strokeWidth="1.5" strokeDasharray="4 3" />
            </svg>
            이전 재전망 {priorId} (점선)
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <svg width="12" height="12" aria-hidden>
            <path d="M6,0 L12,6 L6,12 L0,6 Z" fill={PURPLE} />
          </svg>
          재무팀 공식 전망 주간 종가 <SourceBadgeStatic label="CLAIM" /> <span className="text-zinc-500">(fin_cash_forecast_ms.csv · week · projected_closing_krw)</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-5 bg-red-200" aria-hidden /> 하회 예상 구간 (현재 재전망)
          {priorWindows && (
            <>
              {' '}
              · <span className="inline-block h-3 w-5 border border-dashed border-red-400" aria-hidden /> 이전 구간
            </>
          )}
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width="22" height="6" aria-hidden>
            <line x1="0" x2="22" y1="3" y2="3" stroke="#b91c1c" strokeWidth="1.5" strokeDasharray="6 4" />
          </svg>
          covenant 30억
        </span>
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}
