/**
 * 접힘 영역 — 「주장 · 참고」(UI-03)와 「참고: 1.4 문자 그대로」(UI-10).
 * 기본으로 접혀 있다. 네이티브 details 를 써서 JS 없이 키보드로 열고 닫는다.
 */
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SourceBadgeStatic } from './source-badge';

export function ClaimsFold({ title = '주장 · 참고', children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <details className={cn('group rounded-md border border-purple-200 bg-purple-50/40', className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium text-purple-900 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
        {title}
        <SourceBadgeStatic label="CLAIM" />
        <span className="text-xs font-normal text-purple-800">판단 근거로 쓰지 않음 (R-CLAIM-01)</span>
      </summary>
      <div className="space-y-2 border-t border-purple-200 px-3 py-2 text-sm">{children}</div>
    </details>
  );
}

export function ReferenceFold({ title = '참고: calculation_definitions 1.4 문자 그대로 (이중 차감)', children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <details className={cn('group rounded-md border border-zinc-200 bg-zinc-50', className)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-600 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
        {title}
        <span className="font-normal">— 참고값, 판단 · 권고 · 순위에 쓰지 않음</span>
      </summary>
      <div className="space-y-2 border-t border-zinc-200 px-3 py-2 text-sm text-zinc-700">{children}</div>
    </details>
  );
}

/** 참고 플래그 칩 (경고 아님 — 회색) */
export function ReferenceChip({ text = '참고: 1.4 값 부호 다름' }: { text?: string }) {
  return <span className="inline-flex h-5 items-center rounded-full bg-zinc-100 px-2 text-[11px] text-zinc-600 ring-1 ring-zinc-300">{text}</span>;
}
