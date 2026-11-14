import type { Metadata } from 'next';
import { AppHeader } from '@/components/shell/app-header';
import { ResultDock } from '@/components/mutation/result-dock';
import { Legend } from '@/components/shell/legend';
import { SideNav } from '@/components/shell/side-nav';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DEMO_ROLES, getApprovals, getMeta, getSession, getTasks } from './_data/views';
import './globals.css';

export const metadata: Metadata = {
  title: 'W02 · Aoura 운영 시스템',
  description: 'W02 인플루언서 계약과 캠페인 집행 — AI 운영 시스템',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [meta, session, approvals, tasks] = await Promise.all([getMeta(), getSession(), getApprovals(), getTasks()]);
  const myPending = approvals.filter((a) => a.request.status === 'PENDING' && a.request.requiredRole === session.role.actorRole).length;
  const overdue = tasks.filter((t) => t.status === 'OVERDUE').length;
  return (
    <html lang="ko">
      <body className="min-h-screen bg-zinc-100 text-zinc-900 antialiased">
        <TooltipProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-2">
            본문으로 건너뛰기
          </a>
          <AppHeader
            meta={meta}
            roles={DEMO_ROLES.map((r) => ({ id: r.id, label: r.label }))}
            roleId={session.role.id}
          />
          <div className="flex">
            <aside className="hidden w-48 shrink-0 border-r bg-zinc-50 md:block">
              <SideNav badges={{ '/approvals': myPending, '/tasks': overdue }} />
            </aside>
            <main id="main" className="min-w-0 flex-1 p-4 pb-16 md:p-6">
              <ResultDock />
              {children}
            </main>
          </div>
          <Legend />
        </TooltipProvider>
      </body>
    </html>
  );
}
