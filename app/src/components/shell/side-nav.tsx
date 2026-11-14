'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV: { href: string; label: string; group?: string }[] = [
  { href: '/', label: '운영 현황' },
  { href: '/events', label: '사건 입력' },
  { href: '/contracts/CTR-INF-001-2026', label: '전속계약' },
  { href: '/proposals/PROP-2026-07', label: '확대 기안' },
  { href: '/approvals', label: '승인함' },
  { href: '/tasks', label: '작업' },
  { href: '/analysis/influencers', label: '성과', group: '분석' },
  { href: '/analysis/inventory', label: '재고', group: '분석' },
  { href: '/analysis/cash', label: '자금', group: '분석' },
  { href: '/assessments/recorded', label: 'AI 실행 기록' },
  { href: '/history', label: '처리 이력' },
  { href: '/data', label: '데이터 출처' },
  { href: '/scenarios', label: '시연 시나리오' },
];

export function SideNav({ badges }: { badges: Record<string, number> }) {
  const path = usePathname();
  const active = (href: string) => {
    if (href === '/') return path === '/';
    const key = href.startsWith('/analysis') || href.startsWith('/assessments') ? href : `/${href.split('/')[1]}`;
    return path === key || path.startsWith(`${key}/`) || path === href;
  };
  return (
    <nav aria-label="주 메뉴" className="space-y-0.5 p-2 text-sm">
      {NAV.map((n, i) => (
        <div key={n.href}>
          {n.group && NAV[i - 1]?.group !== n.group && <div className="mt-2 px-2 pb-1 text-[11px] font-semibold text-zinc-500">{n.group}</div>}
          <Link
            href={n.href}
            aria-current={active(n.href) ? 'page' : undefined}
            className={cn(
              'flex items-center justify-between rounded px-2 py-1.5 hover:bg-zinc-200 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              n.group && 'pl-4',
              active(n.href) && 'bg-zinc-900 text-white hover:bg-zinc-800',
            )}
          >
            {n.label}
            {badges[n.href] ? <span className={cn('rounded-full px-1.5 text-[11px] font-semibold', active(n.href) ? 'bg-white text-zinc-900' : 'bg-red-600 text-white')}>{badges[n.href]}</span> : null}
          </Link>
        </div>
      ))}
    </nav>
  );
}
