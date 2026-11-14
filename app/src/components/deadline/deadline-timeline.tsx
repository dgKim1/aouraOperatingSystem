/**
 * 기한 타임라인 (S-01) — 가로축 7/1 ~ 9/30. 레인별로 나눠 표본 금액과 풀스케일 금액이 한 축에 섞이지 않게 한다 (UI-02).
 * covenant 하회 예상 구간 음영: 최초 재전망(v1)과 현재 재전망이 다르면 둘 다 보여 늘어난 구간이 보인다 (UI-08).
 * 위치 계산은 그리기용(날짜 → 가로 위치)일 뿐 판정이 아니다.
 */
import Link from 'next/link';
import type { CovenantWindowView, MarkerState, TimelineItem } from '@/domain/api-types';
import { diffDays } from '@/domain/dates';
import { cn } from '@/lib/utils';
import { SourceBadge } from '../badges/source-badge';
import { MoneyValue, NumValue } from '../badges/values';
import { DeadlineChip } from './deadline-chip';

const START = '2026-07-01';
const END = '2026-09-30';
const SPAN = diffDays(START, END);
const pos = (d: string) => Math.min(100, Math.max(0, (diffDays(START, d) / SPAN) * 100));

export const MARKER_STYLE: Record<MarkerState, { dot: string; text: string; glyph: string }> = {
  OPEN: { dot: 'bg-amber-500 ring-amber-700', text: '미결', glyph: '!' },
  APPROVED: { dot: 'bg-emerald-600 ring-emerald-800', text: '승인', glyph: '✓' },
  REJECTED: { dot: 'bg-zinc-400 ring-zinc-600', text: '부결', glyph: '×' },
  AUTO: { dot: 'bg-red-600 ring-red-800', text: '자동 확정 · 갱신', glyph: 'A' },
  DONE: { dot: 'bg-emerald-500 ring-emerald-700', text: '처리됨', glyph: '✓' },
  INFO: { dot: 'bg-slate-400 ring-slate-600', text: '참고', glyph: 'i' },
};

const MONTHS = [
  { d: '2026-07-01', t: '7월' },
  { d: '2026-08-01', t: '8월' },
  { d: '2026-09-01', t: '9월' },
];

function Marker({ item }: { item: TimelineItem }) {
  const st = MARKER_STYLE[item.state];
  const left = pos(item.date);
  const body = (
    <span
      className={cn('flex size-5 -translate-x-1/2 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2', st.dot)}
      aria-label={`${item.date} ${item.title} — ${st.text}`}
    >
      {st.glyph}
    </span>
  );
  return (
    <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${left}%` }} title={`${item.date} ${item.title} · ${item.stateText}`}>
      {item.href ? (
        <Link href={item.href} className="block rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          {body}
        </Link>
      ) : (
        body
      )}
      <span className="absolute top-6 left-0 -translate-x-1/2 text-[10px] whitespace-nowrap text-zinc-700 tabular-nums">{item.date.slice(5).replace('-', '/')}</span>
    </div>
  );
}

function Lane({ title, scaleNote, children }: { title: string; scaleNote?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-center gap-2">
      <div className="text-xs font-medium text-zinc-700">
        {title}
        {scaleNote && <div className="text-[10px] font-normal text-muted-foreground">{scaleNote}</div>}
      </div>
      <div className="relative h-12 rounded bg-zinc-50 ring-1 ring-zinc-200">{children}</div>
    </div>
  );
}

export function DeadlineTimeline({ items, windows, simNow }: { items: TimelineItem[]; windows: CovenantWindowView[]; simNow: string }) {
  const nowLeft = pos(simNow.slice(0, 10));
  const nowLine = <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-blue-700" style={{ left: `${nowLeft}%` }} aria-hidden />;
  const deadlines = items.filter((i) => i.kind === 'CONTRACT_NOTICE' || i.kind === 'LINE_DEADLINE' || i.kind === 'CONTRACT_END');
  const cash = items.filter((i) => i.kind === 'PO_PAYMENT');
  const arrivals = items.filter((i) => i.kind === 'PO_ARRIVAL');
  const prior = windows.filter((w) => !w.current);
  const current = windows.filter((w) => w.current);

  return (
    <figure className="space-y-2" aria-label="기한 타임라인 2026-07-01 ~ 2026-09-30">
      <div className="grid grid-cols-[8rem_1fr] gap-2">
        <div />
        <div className="relative h-5 text-[11px] text-zinc-600">
          {MONTHS.map((m) => (
            <span key={m.d} className="absolute -translate-x-0" style={{ left: `${pos(m.d)}%` }}>
              {m.t}
            </span>
          ))}
          <span className="absolute -translate-x-1/2 rounded bg-blue-700 px-1 text-[10px] text-white" style={{ left: `${nowLeft}%` }}>
            기준시각
          </span>
        </div>
      </div>
      <Lane title="결정 기한" scaleNote="계약 · 기안">
        {current.map((w) => (
          <div key={`d-${w.forecastId}`} className="absolute inset-y-0 bg-red-100/70" style={{ left: `${pos(w.start)}%`, width: `${pos(w.end) - pos(w.start)}%` }} aria-hidden />
        ))}
        {nowLine}
        {deadlines.map((i) => (
          <Marker key={i.id} item={i} />
        ))}
      </Lane>
      <Lane title="covenant 하회 예상" scaleNote="자금 · 풀스케일">
        {prior.map((w) => (
          <div
            key={`p-${w.forecastId}-${w.start}`}
            className="absolute top-1 flex h-4 items-center justify-center overflow-hidden border border-dashed border-red-400 bg-red-50"
            style={{ left: `${pos(w.start)}%`, width: `${pos(w.end) - pos(w.start)}%` }}
            title={`${w.forecastId}: ${w.start} ~ ${w.end}`}
          >
            <span className="px-1 text-[10px] leading-none whitespace-nowrap text-red-800">{w.forecastId} ~{w.end.slice(5).replace('-', '/')}</span>
          </div>
        ))}
        {current.map((w) => (
          <div
            key={`c-${w.forecastId}-${w.start}`}
            className={cn('absolute flex h-4 items-center justify-center overflow-hidden bg-red-600/80', prior.length ? 'bottom-1' : 'top-1/2 -translate-y-1/2')}
            style={{ left: `${pos(w.start)}%`, width: `${pos(w.end) - pos(w.start)}%` }}
            title={`${w.forecastId}: ${w.start} ~ ${w.end}`}
          >
            <span className="px-1 text-[10px] leading-none font-semibold whitespace-nowrap text-white">
              {w.forecastId} {w.start.slice(5).replace('-', '/')}~{w.end.slice(5).replace('-', '/')}
            </span>
          </div>
        ))}
        {nowLine}
        {cash.map((i) => (
          <Marker key={i.id} item={i} />
        ))}
      </Lane>
      <Lane title="재고 입고" scaleNote="SCM · 가정 A-20">
        {arrivals.map((i) => (
          <div
            key={i.id}
            className="absolute top-1/2 h-3 -translate-y-1/2 rounded bg-slate-400"
            style={{ left: `${pos(i.date)}%`, width: `${Math.max(1, pos(i.endDate ?? i.date) - pos(i.date))}%` }}
            title={`${i.title} ${i.date} ~ ${i.endDate}`}
          />
        ))}
        {nowLine}
      </Lane>
      <figcaption className="flex flex-wrap gap-3 pt-1 text-[11px] text-zinc-700">
        {(['OPEN', 'APPROVED', 'REJECTED', 'AUTO', 'INFO'] as MarkerState[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={cn('flex size-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white', MARKER_STYLE[k].dot)}>{MARKER_STYLE[k].glyph}</span>
            {MARKER_STYLE[k].text}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-5 bg-red-600/80" /> 현재 하회 구간
        </span>
        {prior.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-5 border border-dashed border-red-400 bg-red-50" /> 이전 재전망 구간
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/** 타임라인 항목 표 (텍스트 대안 · 금액은 레인별 스케일 배지와 함께) */
export function TimelineTable({ items, windows }: { items: TimelineItem[]; windows: CovenantWindowView[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">기한 · 일정 목록</caption>
        <thead className="text-left text-xs text-zinc-600">
          <tr className="border-b">
            <th className="py-1 pr-2 font-medium">날짜</th>
            <th className="py-1 pr-2 font-medium">항목</th>
            <th className="py-1 pr-2 font-medium">상태</th>
            <th className="py-1 pr-2 font-medium">규모</th>
          </tr>
        </thead>
        <tbody>
          {windows.map((w) => (
            <tr key={`w-${w.forecastId}-${w.start}`} className="border-b last:border-0">
              <td className="py-1.5 pr-2 tabular-nums">
                {w.start} ~ {w.end}
              </td>
              <td className="py-1.5 pr-2">
                covenant 하회 예상 구간 ({w.forecastId}{w.current ? ', 현재' : ', 이전'})
              </td>
              <td className="py-1.5 pr-2 text-xs">{w.businessDays}영업일</td>
              <td className="py-1.5 pr-2">
                <SourceBadge label={w.source.label} refs={w.source.refs} method={w.source.method} assumptionIds={w.source.assumptionIds} />
              </td>
            </tr>
          ))}
          {items.map((i) => (
            <tr key={i.id} className="border-b last:border-0">
              <td className="py-1.5 pr-2 tabular-nums">
                {i.level && i.daysLeft !== undefined ? <DeadlineChip date={i.date} daysLeft={i.daysLeft} level={i.level} /> : i.endDate ? `${i.date} ~ ${i.endDate}` : i.date}
              </td>
              <td className="py-1.5 pr-2">{i.href ? <Link href={i.href} className="underline underline-offset-2">{i.title}</Link> : i.title}</td>
              <td className="py-1.5 pr-2 text-xs">
                <span className="inline-flex items-center gap-1">
                  <span className={cn('size-2.5 rounded-full', MARKER_STYLE[i.state].dot)} aria-hidden />
                  {i.stateText}
                </span>
              </td>
              <td className="py-1.5 pr-2">
                <div className="flex flex-col gap-0.5">
                  {i.amount && <MoneyValue m={i.amount} />}
                  {i.count && <NumValue n={i.count} format="int" />}
                  {!i.amount && !i.count && <SourceBadge label={i.label} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
