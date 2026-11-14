/** 기한 칩 — R-DL-03 단계(API 결과)를 색 · 문구로. 정보 > 7일 · 경고 ≤ 7 · 위험 ≤ 3 · 경과 */
import { CalendarClock } from 'lucide-react';
import type { DeadlineLevel } from '@/domain/types';
import { cn } from '@/lib/utils';
import { fmtDays } from '../format';

const STYLE: Record<DeadlineLevel, { cls: string; text: string }> = {
  INFO: { cls: 'bg-sky-50 text-sky-900 ring-sky-200', text: '정보' },
  WARNING: { cls: 'bg-amber-100 text-amber-950 ring-amber-400', text: '경고 D-7 이내' },
  DANGER: { cls: 'bg-red-100 text-red-900 ring-red-400', text: '위험 D-3 이내' },
  PASSED: { cls: 'bg-zinc-800 text-white ring-zinc-800', text: '기한 경과' },
};

export function DeadlineChip({ date, daysLeft, level, className }: { date: string; daysLeft: number; level: DeadlineLevel; className?: string }) {
  const st = STYLE[level];
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium ring-1 whitespace-nowrap', st.cls, className)} title={`R-DL-03 (A-25) · ${st.text}`}>
      <CalendarClock className="size-3.5" aria-hidden />
      <span className="tabular-nums">{date}</span>
      <span className="font-semibold">{level === 'PASSED' ? '경과' : fmtDays(daysLeft)}</span>
      <span className="sr-only">({st.text})</span>
    </span>
  );
}
