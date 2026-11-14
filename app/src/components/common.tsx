/** 화면 공통 조각 — 페이지 머리 · 칩 · 처리 이력 표 */
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import type { ApprovalStatus, ApproverRole, ActorRole, AuditLogEntry, LineFlag, LineStatus } from '@/domain/types';
import { ROLE_KO } from '@/domain/types';
import { cn } from '@/lib/utils';
import { APPROVAL_STATUS_KO, FLAG_KO, FLAG_TONE, LINE_STATUS_KO } from './labels';
import { ReferenceChip } from './badges/fold';
import { fmtDateTime } from './format';
import { entityHref } from './links';

export function PageHeader({ id, title, decision, children }: { id: string; title: string; decision: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-xs text-zinc-700">{id}</span>
        <h2 className="text-xl font-semibold">{title}</h2>
        {children}
      </div>
      <p className="flex items-start gap-1.5 text-sm text-zinc-700">
        <HelpCircle className="mt-0.5 size-4 shrink-0 text-blue-700" aria-hidden />
        <span>
          <span className="font-semibold text-blue-900">이 화면의 결정</span> {decision}
        </span>
      </p>
    </div>
  );
}

export function Section({ title, children, className, actions, id }: { title: React.ReactNode; children: React.ReactNode; className?: string; actions?: React.ReactNode; id?: string }) {
  return (
    <section className={cn('rounded-lg border bg-white p-4 shadow-xs', className)} aria-labelledby={id}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id={id} className="text-sm font-semibold">
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

const ROLE_STYLE: Partial<Record<ActorRole, string>> = {
  GROUP_CEO_BOARD: 'bg-violet-800 text-white',
  MASIL_CEO: 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-300',
  MARKETING_TEAM: 'bg-zinc-100 text-zinc-800 ring-1 ring-zinc-300',
  SCM: 'bg-cyan-100 text-cyan-900 ring-1 ring-cyan-300',
};

export function RoleChip({ role, className }: { role: ActorRole; className?: string }) {
  return <span className={cn('inline-flex h-6 items-center rounded px-2 text-xs font-medium whitespace-nowrap', ROLE_STYLE[role] ?? 'bg-zinc-100 text-zinc-800 ring-1 ring-zinc-300', className)}>{ROLE_KO[role]}</span>;
}

export function RoleChange({ from, to }: { from: ApproverRole; to: ApproverRole }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <s className="text-xs text-zinc-500">{ROLE_KO[from]}</s>
      <span aria-hidden>→</span>
      <RoleChip role={to} />
      <span className="inline-flex h-5 items-center rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">변경됨</span>
    </span>
  );
}

const APPROVAL_TONE: Record<ApprovalStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-950 ring-amber-400',
  APPROVED: 'bg-emerald-100 text-emerald-900 ring-emerald-400',
  APPROVED_WITH_CONDITIONS: 'bg-emerald-50 text-emerald-900 ring-emerald-300',
  REJECTED: 'bg-red-100 text-red-900 ring-red-300',
  INFO_REQUESTED: 'bg-sky-100 text-sky-900 ring-sky-300',
  SUPERSEDED: 'bg-zinc-200 text-zinc-700 ring-zinc-300',
  EXPIRED: 'bg-zinc-800 text-white ring-zinc-800',
};

export function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return <span className={cn('inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ring-1 whitespace-nowrap', APPROVAL_TONE[status])}>{APPROVAL_STATUS_KO[status]}</span>;
}

const LINE_TONE: Partial<Record<LineStatus, string>> = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-950 ring-amber-400',
  APPROVED: 'bg-emerald-100 text-emerald-900 ring-emerald-400',
  CONDITIONALLY_APPROVED: 'bg-emerald-50 text-emerald-900 ring-emerald-300',
  CONFIRMED: 'bg-emerald-600 text-white ring-emerald-700',
  REJECTED: 'bg-zinc-200 text-zinc-800 ring-zinc-400',
  CANCELLED: 'bg-zinc-200 text-zinc-600 ring-zinc-300',
  REAPPROVAL_REQUIRED: 'bg-red-100 text-red-900 ring-red-400',
  AUTO_CONFIRMED: 'bg-red-700 text-white ring-red-800',
  ON_HOLD: 'bg-sky-100 text-sky-900 ring-sky-300',
  INFO_MISSING: 'bg-orange-100 text-orange-900 ring-orange-300',
};

export function LineStatusBadge({ status }: { status: LineStatus }) {
  return <span className={cn('inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ring-1 whitespace-nowrap', LINE_TONE[status] ?? 'bg-white text-zinc-800 ring-zinc-300')}>{LINE_STATUS_KO[status]}</span>;
}

const FLAG_CLS = {
  danger: 'bg-red-50 text-red-800 ring-red-300',
  warning: 'bg-amber-50 text-amber-900 ring-amber-300',
  info: 'bg-sky-50 text-sky-900 ring-sky-200',
  positive: 'bg-emerald-50 text-emerald-900 ring-emerald-300',
  reference: '',
};

export function FlagChip({ flag }: { flag: LineFlag }) {
  if (FLAG_TONE[flag] === 'reference') return <ReferenceChip />;
  return <span className={cn('inline-flex h-5 items-center rounded-full px-1.5 text-[11px] ring-1 whitespace-nowrap', FLAG_CLS[FLAG_TONE[flag]])}>{FLAG_KO[flag]}</span>;
}

const ACTOR_KIND_KO = { AI: 'AI', HUMAN: '사람', SYSTEM: '시스템', MOCK: '모의' } as const;

export function AuditTable({ rows, empty = '처리 이력이 없습니다.' }: { rows: AuditLogEntry[]; empty?: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">처리 이력</caption>
        <thead className="text-left text-xs text-zinc-600">
          <tr className="border-b">
            <th className="py-1 pr-3 font-medium">시각 (가상 · 실제)</th>
            <th className="py-1 pr-3 font-medium">대상</th>
            <th className="py-1 pr-3 font-medium">이전 → 이후</th>
            <th className="py-1 pr-3 font-medium">행위자</th>
            <th className="py-1 pr-3 font-medium">규칙</th>
            <th className="py-1 pr-3 font-medium">원인 사건</th>
            <th className="py-1 pr-3 font-medium">사유</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b align-top last:border-0">
              <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap tabular-nums">
                {fmtDateTime(r.simAt)}
                <div className="text-[10px] text-zinc-500" title="실제 기록 시각">
                  {fmtDateTime(r.createdAt)}
                </div>
              </td>
              <td className="py-1.5 pr-3 text-xs whitespace-nowrap">
                <span className="text-muted-foreground">{r.entityType}</span> <AuditEntityLink type={r.entityType} id={r.entityId} />
              </td>
              <td className="py-1.5 pr-3 text-xs whitespace-nowrap">
                {r.fromStatus ?? '—'} → <strong>{r.toStatus}</strong>
                {r.fromStatus !== null && r.fromStatus === r.toStatus && <div className="text-[10px] text-zinc-600">같은 상태 유지</div>}
                <ReplenishmentCloseNote entry={r} />
              </td>
              <td className="py-1.5 pr-3 text-xs whitespace-nowrap">
                {ROLE_KO[r.actorRole]}
                <span className={cn('ml-1 rounded px-1 text-[10px]', r.actorKind === 'MOCK' ? 'border border-dashed border-zinc-500' : 'bg-zinc-100')}>{ACTOR_KIND_KO[r.actorKind]}</span>
              </td>
              <td className="py-1.5 pr-3 font-mono text-[11px] whitespace-nowrap">{r.ruleIds.join(' ')}</td>
              <td className="py-1.5 pr-3 font-mono text-[11px] whitespace-nowrap">
                {r.eventId ? (
                  <Link href={`/history?eventId=${r.eventId}`} className="underline">
                    {r.eventId}
                  </Link>
                ) : (
                  '—'
                )}
              </td>
              <td className="py-1.5 pr-3 text-xs">{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * FE-04 보충요청 종결 문구 3종 (A-30 · A-34) — 서버가 statusText 를 주면(BE-13) 그것을 쓰고, 없으면 이력의 이전 상태 + 사유 접두어로 나눈다.
 * DRAFT → REJECTED 사유 "불필요:" = SCM 검토 '불필요' 종결 · "보충 불가:" = SCM 검토 '보충 불가' 종결 (둘 다 승인 거절 아님)
 * SUBMITTED → REJECTED = 권한자 승인 거절
 */
export function replenishmentCloseText(fromStatus: string | null, toStatus: string, reason = ''): string | null {
  if (toStatus !== 'REJECTED') return null;
  if (fromStatus === 'DRAFT') {
    if (reason.includes('보충 불가')) return 'SCM 검토: 보충 불가로 종결 (승인 거절 아님)';
    return 'SCM 검토: 불필요로 종결 (승인 거절 아님)';
  }
  if (fromStatus === 'SUBMITTED' || fromStatus === 'INFO_REQUESTED') return '승인 거절';
  return null;
}

function ReplenishmentCloseNote({ entry }: { entry: AuditLogEntry }) {
  if (entry.entityType !== 'REPLENISHMENT') return null;
  const t = replenishmentCloseText(entry.fromStatus, entry.toStatus, entry.reason);
  if (!t) return null;
  return <div className={cn('mt-0.5 rounded px-1 text-[10px] font-medium', t === '승인 거절' ? 'bg-red-100 text-red-900' : 'bg-cyan-50 text-cyan-900')}>{t}</div>;
}

function AuditEntityLink({ type, id }: { type: string; id: string }) {
  const href = entityHref(type, id);
  return href ? (
    <Link href={href} className="font-mono underline underline-offset-2">
      {id}
    </Link>
  ) : (
    <span className="font-mono">{id}</span>
  );
}

export function StubNotice({ children, tag = '안내' }: { children: React.ReactNode; tag?: string }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-400 bg-zinc-50 px-3 py-2 text-xs text-zinc-700" role="note">
      <span className="mr-1 font-semibold">{tag}</span>
      {children}
    </p>
  );
}
