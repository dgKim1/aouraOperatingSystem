/** S-11 처리 이력 — 판단 이후 무엇이 생성 · 갱신됐는지의 증거 */
import Link from 'next/link';
import { AuditTable, PageHeader, Section } from '@/components/common';
import { cn } from '@/lib/utils';
import { getAudit } from '../_data/views';

type SP = Record<string, string | string[] | undefined>;
const KINDS = [
  { v: undefined, t: '전체' },
  { v: 'HUMAN', t: '사람' },
  { v: 'SYSTEM', t: '시스템' },
  { v: 'MOCK', t: '모의' },
  { v: 'AI', t: 'AI' },
];
const TYPES = [undefined, 'CONTRACT', 'EXPANSION_LINE', 'APPROVAL_REQUEST', 'TASK', 'REPLENISHMENT', 'CASH_FORECAST'];

export default async function HistoryPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const s = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const f = { entityType: s('entityType'), entityId: s('entityId'), actorKind: s('actorKind') };
  const eventId = s('eventId');
  let rows = await getAudit(Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as typeof f);
  if (eventId) rows = rows.filter((r) => r.eventId === eventId);
  const link = (k: string, v?: string) => {
    const q = new URLSearchParams(Object.entries({ ...f, eventId }).filter(([kk, vv]) => vv && kk !== k) as [string, string][]);
    if (v) q.set(k, v);
    return `/history${q.toString() ? `?${q}` : ''}`;
  };
  const chip = (k: string, v: string | undefined, t: string, cur: string | undefined) => (
    <Link key={`${k}${v}`} href={link(k, v)} aria-current={cur === v ? 'true' : undefined} className={cn('rounded-full border px-2 py-0.5 text-xs', cur === v && 'bg-zinc-900 text-white')}>
      {t}
    </Link>
  );
  return (
    <div className="space-y-4">
      <PageHeader id="S-11" title="처리 이력" decision="판단 이후 어떤 상태가 누구에 의해 왜 바뀌었는지 확인합니다 (심사 증거)." />
      <Section title={`이력 ${rows.length}건 (최신순)`} id="h">
        <div className="mb-3 space-y-1">
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-14 text-xs text-zinc-600">행위자</span>
            {KINDS.map((k) => chip('actorKind', k.v, k.t, f.actorKind))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-14 text-xs text-zinc-600">대상</span>
            {TYPES.map((t) => chip('entityType', t, t ?? '전체', f.entityType))}
          </div>
          {(f.entityId || eventId) && (
            <p className="text-xs">
              필터: {f.entityId && <>대상 {f.entityId} </>}
              {eventId && <>사건 {eventId} </>}
              <Link href="/history" className="underline">
                해제
              </Link>
            </p>
          )}
        </div>
        <AuditTable rows={rows} empty="조건에 맞는 이력이 없습니다." />
        <p className="mt-2 text-xs text-muted-foreground">타임라인 보기(대상별 레인)는 2단계에서 추가합니다. 시나리오 실행 ID 필터는 API 연결 후.</p>
      </Section>
    </div>
  );
}
