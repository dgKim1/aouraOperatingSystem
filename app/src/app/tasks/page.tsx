/** S-07 작업 — 판단 이후 반복 처리(통보 · 재통보 · 재검토 · 재상신 · 정보 요청 · 그룹 보고 · 일정 조정 · 보충 검토 · 사고 대응)를 끝까지 추적 */
import Link from 'next/link';
import { PageHeader, RoleChip, Section } from '@/components/common';
import { fmtDateTime } from '@/components/format';
import type { TaskView } from '@/domain/api-types';
import type { ActorRole } from '@/domain/types';
import { cn } from '@/lib/utils';
import { getAssessments, getInventory, getMeta, getSession, getTasks } from '../_data/views';
import { TaskActions, type ResubmitBasis } from './task-actions';
import { ReplenishmentList } from '../analysis/inventory/replenishment-list';

export default async function TasksPage() {
  const [tasks, { role }, meta, assessments, inv] = await Promise.all([getTasks(), getSession(), getMeta(), getAssessments(), getInventory()]);
  const open = tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const done = tasks.filter((t) => t.status === 'DONE' || t.status === 'CANCELLED');
  // 재상신 작업의 근거 판단안 후보: 같은 대상을 다룬 판단안 (최신 먼저 — 기본 선택 = 최신). 버전 · 권고는 판단안 값 그대로 (FE-16)
  const asmFor = (subjectId: string): ResubmitBasis[] =>
    assessments
      .filter((a) => a.subjectIds.includes(subjectId))
      .reverse()
      .map((a) => {
        const title = a.alternatives.find((x) => x.id === a.recommendation.alternativeId)?.title ?? '';
        return { id: a.id, version: a.version, mock: a.mock, text: `${a.id} · v${a.version} · 권고 ${a.recommendation.alternativeId}${title ? ` ${title}` : ''}` };
      });
  const mineOpen = open.filter((t) => t.ownerRole === role.actorRole).length;
  return (
    <div className="space-y-4">
      <PageHeader id="S-07" title="작업" decision={`담당 역할(현재 ${role.label})이 열린 작업을 시작 · 완료 · 취소해 다음 상태로 넘깁니다. 완료하면 연결된 계약 · 기안 상태가 바뀝니다.`} />
      <Section title={`열린 작업 (${open.length}, 내 역할 ${mineOpen})`} id="open">
        {open.length === 0 ? <p className="text-sm text-muted-foreground">열린 작업이 없습니다.</p> : <TaskTable rows={open} role={role.actorRole} roleLabel={role.label} asmFor={asmFor} today={meta.simNow.slice(0, 10)} />}
      </Section>
      {inv.replenishments.length > 0 && (
        <Section title="보충요청 상태 (SCM 검토 · 승인)" id="rep">
          <ReplenishmentList items={inv.replenishments} />
        </Section>
      )}
      <Section title={`완료 · 취소 (${done.length})`} id="done">
        {done.length === 0 ? <p className="text-sm text-muted-foreground">없음</p> : <TaskTable rows={done} role={role.actorRole} roleLabel={role.label} asmFor={asmFor} today={meta.simNow.slice(0, 10)} closed />}
      </Section>
    </div>
  );
}

function TaskTable({ rows, role, roleLabel, asmFor, today, closed = false }: { rows: TaskView[]; role: ActorRole; roleLabel: string; asmFor: (id: string) => ResubmitBasis[]; today: string; closed?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <caption className="sr-only">{closed ? '완료 · 취소된 작업' : '열린 작업 — 기한 경과는 빨강'}</caption>
        <thead className="text-left text-xs text-zinc-600">
          <tr className="border-b">
            <th className="p-2 font-medium">ID · 유형</th>
            <th className="p-2 font-medium">대상</th>
            <th className="p-2 font-medium">담당 역할</th>
            <th className="p-2 font-medium">기한</th>
            <th className="p-2 font-medium">상태</th>
            <th className="p-2 font-medium">지시 · 결과</th>
            <th className="p-2 font-medium">생성 원인</th>
            {!closed && <th className="w-72 p-2 font-medium">행동</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const mine = t.ownerRole === role;
            return (
              <tr key={t.id} id={`task-${t.id}`} className={cn('scroll-mt-24 border-b align-top last:border-0 target:bg-yellow-50', t.status === 'OVERDUE' && 'bg-red-50', !closed && mine && t.status !== 'OVERDUE' && 'bg-blue-50/50')}>
                <td className="p-2">
                  <span className="font-mono text-xs">{t.id}</span>
                  <div className="font-medium">{t.typeText}</div>
                </td>
                <td className="p-2">
                  <Link href={t.subjectHref} className="font-mono text-xs underline">
                    {t.subjectId}
                  </Link>
                </td>
                <td className="p-2">
                  <RoleChip role={t.ownerRole} />
                </td>
                <td className="p-2 font-mono text-xs whitespace-nowrap">{fmtDateTime(t.dueAt)}</td>
                <td className={cn('p-2 text-xs font-semibold', t.status === 'OVERDUE' && 'text-red-700')}>{t.statusText}</td>
                <td className="p-2 text-xs">
                  {t.instruction}
                  {t.resultNote && <div className="mt-1 text-zinc-600">결과: {t.resultNote}</div>}
                </td>
                <td className="p-2 font-mono text-xs">
                  {t.createdByEventId ? (
                    <Link href={`/history?eventId=${t.createdByEventId}`} className="underline">
                      {t.createdByEventId}
                    </Link>
                  ) : (
                    '-'
                  )}
                </td>
                {!closed && (
                  <td className="p-2">
                    <TaskActions task={t} role={role} roleLabel={roleLabel} assessments={t.type === 'RESUBMIT' ? asmFor(t.subjectId) : []} today={today} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
