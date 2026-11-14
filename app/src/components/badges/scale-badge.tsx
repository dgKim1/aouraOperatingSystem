/** 스케일 배지 — 금액 옆에 풀스케일 / 표본. 표본 금액과 풀스케일 금액은 한 합계 · 한 축에 두지 않는다 (UI-02) */
import type { Scale } from '@/domain/types';
import { cn } from '@/lib/utils';

export function ScaleBadge({ scale, className }: { scale: Scale; className?: string }) {
  if (scale === 'NONE') return null;
  const full = scale === 'FULL';
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-sm px-1.5 text-[11px] font-semibold leading-none whitespace-nowrap',
        full ? 'bg-slate-800 text-white' : 'bg-amber-100 text-amber-900 ring-1 ring-amber-400',
        className,
      )}
      title={full ? '풀스케일: 회사 실제 규모 (계약 · 재고 · 자금)' : '표본: 커머스 대표 표본 — 비중 · 순위 · 방향까지'}
    >
      {full ? '풀스케일' : '표본'}
    </span>
  );
}

/** 같은 카드에 두 스케일이 있을 때의 구분 문구 */
export function ScaleDivider() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground" role="note">
      <span className="h-px flex-1 bg-border" />
      표본 금액과 풀스케일 금액은 서로 더하거나 곱하지 않음
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
