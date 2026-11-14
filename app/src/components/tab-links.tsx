/** 서버 렌더 탭 (링크 기반, ?tab=) — JS 없이 동작하고 새로고침 · 링크 공유가 된다 */
import Link from 'next/link';
import { cn } from '@/lib/utils';

export function TabLinks({ base, tabs, current }: { base: string; tabs: { id: string; label: string }[]; current: string }) {
  return (
    <nav aria-label="탭" className="mb-3 flex flex-wrap gap-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={`${base}?tab=${t.id}`}
          aria-current={t.id === current ? 'page' : undefined}
          className={cn('-mb-px rounded-t-md border border-transparent px-3 py-1.5 text-sm hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', t.id === current && 'border-zinc-200 border-b-white bg-white font-semibold')}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
