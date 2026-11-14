/**
 * 경고 7종 (SCREEN_SPEC 0-3) — 색 · 아이콘 · 문구로 구분하고 다음 행동을 같이 보여준다.
 * 조건 판정은 API(데이터 경계)가 하고, 여기서는 받은 경고를 그린다.
 */
import Link from 'next/link';
import { AlertOctagon, AlertTriangle, CalendarClock, FileWarning, Link2, Mailbox, PackageX, ShieldAlert, TrendingDown } from 'lucide-react';
import type { AlertKind, AlertView, Severity } from '@/app/_data/types';
import { ROLE_KO } from '@/domain/types';
import { cn } from '@/lib/utils';
import { SourceBadgeStatic } from '../badges/source-badge';

export const ALERT_KIND_KO: Record<AlertKind, string> = {
  AUTHORITY: '승인 권한',
  DEADLINE: '기한',
  AUTO_RENEWAL: '자동 갱신',
  CONTRACT_LINK: '계약 연결',
  INVENTORY: '재고 커버',
  CP_NEGATIVE: '성과 방향',
  NOTICE_UNCONFIRMED: '수령 미확인',
};

const ICON: Record<AlertKind, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  AUTHORITY: ShieldAlert,
  DEADLINE: CalendarClock,
  AUTO_RENEWAL: AlertOctagon,
  CONTRACT_LINK: Link2,
  INVENTORY: PackageX,
  CP_NEGATIVE: TrendingDown,
  NOTICE_UNCONFIRMED: Mailbox,
};

export const SEVERITY_STYLE: Record<Severity, { box: string; icon: string; text: string }> = {
  DANGER: { box: 'border-red-300 bg-red-50', icon: 'text-red-700', text: '위험' },
  WARNING: { box: 'border-amber-300 bg-amber-50', icon: 'text-amber-700', text: '경고' },
  INFO: { box: 'border-sky-200 bg-sky-50', icon: 'text-sky-700', text: '정보' },
};

export function AlertItem({ a, compact = false }: { a: AlertView; compact?: boolean }) {
  const Icon = ICON[a.kind] ?? AlertTriangle;
  const st = SEVERITY_STYLE[a.severity];
  return (
    <div role={a.severity === 'DANGER' ? 'alert' : 'status'} className={cn('flex gap-3 rounded-md border p-3', st.box)}>
      <Icon className={cn('mt-0.5 size-5 shrink-0', st.icon)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn('font-semibold', st.icon)}>[{st.text}]</span>
          <span className="font-medium">{ALERT_KIND_KO[a.kind]}</span>
          <SourceBadgeStatic label={a.label} />
          <span className="text-muted-foreground">{a.ruleIds.join(' · ')}</span>
        </div>
        <p className="text-sm font-medium">{a.title}</p>
        {!compact && <p className="text-sm text-zinc-700">{a.detail}</p>}
        {a.previousRole && (
          <p className="text-xs">
            이전 권한자 <s className="text-zinc-500">{ROLE_KO[a.previousRole]}</s>
          </p>
        )}
        <p className="flex flex-wrap items-center gap-1 text-sm">
          <span className="text-xs font-semibold text-zinc-600">다음 행동</span>
          {a.nextAction.href ? (
            <Link href={a.nextAction.href} className="underline underline-offset-2">
              {a.nextAction.text}
            </Link>
          ) : (
            <span>{a.nextAction.text}</span>
          )}
          {a.nextAction.role && <span className="text-xs text-muted-foreground">({ROLE_KO[a.nextAction.role]})</span>}
        </p>
      </div>
    </div>
  );
}

export function AlertList({ alerts, empty = '현재 경고가 없습니다.', compact }: { alerts: AlertView[]; empty?: string; compact?: boolean }) {
  if (alerts.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <li key={a.id}>
          <AlertItem a={a} compact={compact ?? false} />
        </li>
      ))}
    </ul>
  );
}

export function InlineWarning({ children, tone = 'warning' }: { children: React.ReactNode; tone?: 'warning' | 'danger' | 'info' }) {
  const cls = tone === 'danger' ? 'border-red-300 bg-red-50 text-red-900' : tone === 'info' ? 'border-sky-200 bg-sky-50 text-sky-900' : 'border-amber-300 bg-amber-50 text-amber-900';
  return (
    <p className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-sm', cls)} role="note">
      <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
