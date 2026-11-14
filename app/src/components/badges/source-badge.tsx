'use client';
/**
 * 출처 배지 6종 (SCREEN_SPEC 0-2). 클릭하면 근거(파일 · 컬럼 · 행 키 · 산식 · 가정 ID)를 펼친다.
 * 색: 원본 회색 · 집계 파랑 · 원본근거해석 청록 · 가정 주황 · 주장 보라(취소선 아님) · 모의 점선 테두리.
 */
import Link from 'next/link';
import type { SourceLabel, SourceRef } from '@/domain/types';
import { SOURCE_LABEL_KO } from '@/domain/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export const SOURCE_STYLE: Record<SourceLabel, string> = {
  ORIGINAL: 'bg-zinc-100 text-zinc-800 border-zinc-300',
  AGGREGATED: 'bg-blue-50 text-blue-800 border-blue-300',
  INTERPRETED: 'bg-teal-50 text-teal-800 border-teal-300',
  ASSUMPTION: 'bg-orange-50 text-orange-800 border-orange-300',
  CLAIM: 'bg-purple-50 text-purple-800 border-purple-300',
  MOCK: 'bg-white text-zinc-700 border-zinc-500 border-dashed',
};

export function SourceBadgeStatic({ label, className }: { label: SourceLabel; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 shrink-0 items-center rounded border px-1.5 text-[11px] font-medium leading-none whitespace-nowrap', SOURCE_STYLE[label], className)}>
      {SOURCE_LABEL_KO[label]}
    </span>
  );
}

export function SourceBadge({
  label,
  refs = [],
  method,
  assumptionIds = [],
  className,
}: {
  label: SourceLabel;
  refs?: SourceRef[];
  method?: string | undefined;
  assumptionIds?: string[] | undefined;
  className?: string;
}) {
  const hasDetail = refs.length > 0 || !!method || assumptionIds.length > 0;
  if (!hasDetail) return <SourceBadgeStatic label={label} className={className} />;
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'inline-flex h-5 shrink-0 cursor-pointer items-center rounded border px-1.5 text-[11px] font-medium leading-none whitespace-nowrap hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          SOURCE_STYLE[label],
          className,
        )}
        aria-label={`출처 ${SOURCE_LABEL_KO[label]} — 근거 보기`}
      >
        {SOURCE_LABEL_KO[label]}
      </PopoverTrigger>
      <PopoverContent className="w-96 text-xs" align="start">
        <div className="flex items-center gap-2">
          <SourceBadgeStatic label={label} />
          <span className="font-semibold">근거</span>
        </div>
        {refs.length > 0 && (
          <ul className="space-y-1">
            {refs.map((r, i) => (
              <li key={i} className="break-all">
                <code className="rounded bg-muted px-1">{r.file}</code>
                {r.column && <span> · 열 {r.column}</span>}
                {r.rowKey && <span> · 행 {r.rowKey}</span>}
                {r.row !== undefined && <span> · {r.row}행</span>}
                {r.note && <span className="text-muted-foreground"> — {r.note}</span>}
              </li>
            ))}
          </ul>
        )}
        {method && (
          <p>
            <span className="font-semibold">산식 · 방법</span> {method}
          </p>
        )}
        {assumptionIds.length > 0 && (
          <p>
            <span className="font-semibold">가정</span>{' '}
            {assumptionIds.map((a) => (
              <Link key={a} href={`/data?tab=assumptions#${a}`} className="mr-1 text-orange-800 underline">
                {a}
              </Link>
            ))}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
