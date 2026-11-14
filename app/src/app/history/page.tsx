/** S-11 처리 이력 — 판단 이후 무엇이 생성 · 갱신됐는지의 증거. 필터: 대상(유형 · ID) · 행위자(종류 · 역할) · 원인 사건 */
import Link from 'next/link';
import { AuditTable, PageHeader, Section } from '@/components/common';
import { ENTITY_KO } from '@/components/links';
import { Button } from '@/components/ui/button';
import type { ActorKind, ActorRole } from '@/domain/types';
import { ROLE_KO } from '@/domain/types';
import { cn } from '@/lib/utils';
import { getAudit } from '../_data/views';

type SP = Record<string, string | string[] | undefined>;
const KINDS: { v: ActorKind | undefined; t: string }[] = [
  { v: undefined, t: '전체' },
  { v: 'HUMAN', t: '사람' },
  { v: 'SYSTEM', t: '시스템' },
  { v: 'MOCK', t: '모의' },
  { v: 'AI', t: 'AI' },
];
const TYPES = [undefined, 'CONTRACT', 'EXPANSION_LINE', 'APPROVAL_REQUEST', 'TASK', 'REPLENISHMENT', 'ASSESSMENT', 'CASH_FORECAST'];
const ACTOR_KINDS = new Set(['AI', 'HUMAN', 'SYSTEM', 'MOCK']);

export default async function HistoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === 'string' && sp[k] ? (sp[k] as string) : undefined);
  const ak = s('actorKind');
  const f = { entityType: s('entityType'), entityId: s('entityId'), actorKind: ak && ACTOR_KINDS.has(ak) ? (ak as ActorKind) : undefined };
  const eventId = s('eventId');
  const actorRole = s('actorRole');
  const all = await getAudit({ ...(f.entityType ? { entityType: f.entityType } : {}), ...(f.entityId ? { entityId: f.entityId } : {}), ...(f.actorKind ? { actorKind: f.actorKind } : {}) });
  // 역할 · 사건 필터는 받은 행을 고르기만 한다 (API 는 actorKind 까지 지원)
  const rows = all.filter((r) => (!eventId || r.eventId === eventId) && (!actorRole || r.actorRole === actorRole));
  const roles = [...new Set(all.map((r) => r.actorRole))];
  const state: Record<string, string | undefined> = { ...f, eventId, actorRole };
  const link = (k: string, v?: string) => {
    const q = new URLSearchParams(Object.entries(state).filter(([kk, vv]) => vv && kk !== k) as [string, string][]);
    if (v) q.set(k, v);
    return `/history${q.toString() ? `?${q}` : ''}`;
  };
  const chip = (k: string, v: string | undefined, t: string) => (
    <Link key={`${k}${v}`} href={link(k, v)} aria-current={state[k] === v ? 'true' : undefined} className={cn('rounded-full border px-2 py-0.5 text-xs hover:bg-zinc-100', state[k] === v && 'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800')}>
      {t}
    </Link>
  );
  return (
    <div className="space-y-4">
      <PageHeader id="S-11" title="처리 이력" decision="판단 이후 어떤 상태가 누구에 의해 왜 바뀌었는지 확인합니다 (심사 증거)." />
      <Section title={`이력 ${rows.length}건 (최신순)`} id="h">
        <div className="mb-3 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-20 text-xs text-zinc-600">대상 유형</span>
            {TYPES.map((t) => chip('entityType', t, t ? (ENTITY_KO[t] ?? t) : '전체'))}
          </div>
          <form method="GET" action="/history" className="flex flex-wrap items-center gap-1">
            {Object.entries(state)
              .filter(([k, v]) => v && k !== 'entityId')
              .map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}
            <label htmlFor="h-entity" className="w-20 text-xs text-zinc-600">
              대상 ID
            </label>
            <input id="h-entity" name="entityId" defaultValue={f.entityId ?? ''} placeholder="예: PLAN-004 · CTR-INF-001-2026 · APR-003" className="h-7 w-72 rounded border px-2 font-mono text-xs" />
            <Button type="submit" size="xs" variant="outline">
              적용
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-20 text-xs text-zinc-600">행위자 종류</span>
            {KINDS.map((k) => chip('actorKind', k.v, k.t))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-20 text-xs text-zinc-600">행위자 역할</span>
            {chip('actorRole', undefined, '전체')}
            {roles.map((r) => chip('actorRole', r, ROLE_KO[r as ActorRole] ?? r))}
          </div>
          {(f.entityId || eventId) && (
            <p className="text-xs">
              필터: {f.entityId && <>대상 {f.entityId} </>}
              {eventId && <>사건 {eventId} </>}
              <Link href="/history" className="underline">
                모두 해제
              </Link>
            </p>
          )}
        </div>
        <AuditTable rows={rows} empty="조건에 맞는 이력이 없습니다." />
        <p className="mt-2 text-xs text-muted-foreground">같은 상태 유지 행(권한 재판정 · 재상신)도 사유와 함께 보입니다. 프리셋 초기화는 운영 테이블을 비우므로 이력에는 한 실행만 남습니다.</p>
      </Section>
    </div>
  );
}
