/**
 * 값 표시 — 모든 숫자는 이 컴포넌트를 거친다 (UI-01: 숫자 옆 출처 배지, 금액 옆 스케일 배지).
 * 계산하지 않는다: 받은 값을 형식만 바꿔 보여준다.
 */
import Link from 'next/link';
import type { Sourced } from '@/domain/types';
import { cn } from '@/lib/utils';
import { fmtDec, fmtInt, fmtKrw, fmtPct } from '../format';
import { ScaleBadge } from './scale-badge';
import { SourceBadge } from './source-badge';

type MoneyLike = Sourced<number> & { scale: 'FULL' | 'SAMPLE' };

export function MoneyValue({
  m,
  claimArea = false,
  hideScale = false,
  className,
  strong = false,
}: {
  m: MoneyLike;
  /** 주장 값은 「주장 · 참고」 영역에서만 숫자를 보인다 (UI-03) */
  claimArea?: boolean;
  hideScale?: boolean;
  className?: string;
  strong?: boolean;
}) {
  if (m.label === 'CLAIM' && !claimArea) {
    return <span className="text-xs text-purple-800">주장 값 — 「주장 · 참고」 영역 참조</span>;
  }
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      <span className={cn('tabular-nums', strong && 'font-semibold', m.value < 0 && 'text-red-700')}>{fmtKrw(m.value)}</span>
      <SourceBadge label={m.label} refs={m.refs} method={m.method} assumptionIds={m.assumptionIds} />
      {!hideScale && <ScaleBadge scale={m.scale} />}
    </span>
  );
}

export type NumFormat = 'pct' | 'pct2' | 'int' | 'dec1' | 'dec2' | 'dec3' | 'weeks';

export function formatNum(v: number, f: NumFormat): string {
  switch (f) {
    case 'pct':
      return fmtPct(v, 1);
    case 'pct2':
      return fmtPct(v, 2);
    case 'int':
      return fmtInt(v);
    case 'dec1':
      return fmtDec(v, 1);
    case 'dec2':
      return fmtDec(v, 2);
    case 'dec3':
      return fmtDec(v, 3);
    case 'weeks':
      return `${fmtDec(v, 2)}주`;
  }
}

export function NumValue({ n, format = 'int', className, danger = false }: { n: Sourced<number> | null; format?: NumFormat; className?: string; danger?: boolean }) {
  if (n === null) return <span className="text-xs text-muted-foreground">계산 불가</span>;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      <span className={cn('tabular-nums', (danger || n.value < 0) && 'text-red-700 font-medium')}>{formatNum(n.value, format)}</span>
      <SourceBadge label={n.label} refs={n.refs} method={n.method} assumptionIds={n.assumptionIds} />
    </span>
  );
}

export function TextValue({ t, className }: { t: Sourced<string>; className?: string }) {
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      <span>{t.value}</span>
      <SourceBadge label={t.label} refs={t.refs} method={t.method} assumptionIds={t.assumptionIds} />
    </span>
  );
}

/** 미확인 값 — 빈칸 대신 칩 + 공백 ID 링크 (UI-07) */
export function UnknownChip({ gapId, note }: { gapId: string; note?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="inline-flex h-5 items-center rounded border border-dashed border-zinc-400 bg-zinc-50 px-1.5 text-[11px] font-medium text-zinc-700">미확인</span>
      <Link href={`/data?tab=gaps#${gapId}`} className="text-xs text-zinc-700 underline underline-offset-2">
        {gapId}
      </Link>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </span>
  );
}

/**
 * 공백 상태 칩 (FE-10 · FE-15) — S-05 미확인 목록 · S-03 판단안 탭 · S-12 공백 탭이 같은 표시를 쓴다.
 * 상태 · 문구는 서버 값 그대로: OPEN = 「미확인」 칩, FILLED_BY_MOCK = `모의` 배지 + 서버 문구. "해소"는 쓰지 않는다(원본 공백은 그대로 — A-33).
 */
export function GapStatusChip({ gapId, status, statusText }: { gapId?: string; status: 'OPEN' | 'FILLED_BY_MOCK'; statusText: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {status === 'OPEN' ? (
        <span className="inline-flex h-5 w-fit items-center rounded border border-dashed border-zinc-400 bg-zinc-50 px-1.5 text-[11px] font-medium text-zinc-700">{statusText || '미확인'}</span>
      ) : (
        <span className="inline-flex flex-wrap items-center gap-1 text-[11px] font-medium text-zinc-800">
          <span className="inline-flex h-5 shrink-0 items-center rounded border border-dashed border-zinc-500 bg-white px-1.5 text-[11px] leading-none font-medium whitespace-nowrap text-zinc-700">모의</span>
          {statusText}
        </span>
      )}
      {gapId && (
        <Link href={`/data?tab=gaps#${gapId}`} className="text-xs text-zinc-700 underline underline-offset-2">
          {gapId}
        </Link>
      )}
    </span>
  );
}
