/** S-07 작업 — 판단 이후 반복 처리(통보 · 재통보 · 재검토 · 재상신 · 정보 요청 · 그룹 보고 · 일정 조정 · 보충 검토 · 사고 대응)를 끝까지 추적 */
import Link from 'next/link';
import { PageHeader, RoleChip, Section, StubNotice } from '@/components/common';
import { fmtDateTime } from '@/components/format';
import { TASK_STATUS_KO } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getSession, getTasks } from '../_data/views';

export default async function TasksPage() {
  const [tasks, { role }] = await Promise.all([getTasks(), getSession()]);
  const open = tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const done = tasks.filter((t) => t.status === 'DONE' || t.status === 'CANCELLED');
  return (
    <div className="space-y-4">
      <PageHeader id="S-07" title="작업" decision={`담당 역할(현재 ${role.label})이 열린 작업을 시작 · 완료 · 취소해 다음 상태로 넘깁니다.`} />
      <StubNotice>작업 시작 · 완료 · 취소(PATCH /api/tasks/:id)는 2단계 API 연결 후 활성화됩니다. 완료 시 연결된 계약 · 기안 상태 전이가 결과로 표시됩니다.</StubNotice>
      <Section title={`열린 작업 (${open.length})`} id="open">
        {open.length === 0 ? <p className="text-sm text-muted-foreground">열린 작업이 없습니다.</p> : <TaskTable rows={open} roleActor={role.actorRole} />}
      </Section>
      <Section title={`완료 · 취소 (${done.length})`} id="done">
        {done.length === 0 ? <p className="text-sm text-muted-foreground">없음</p> : <TaskTable rows={done} roleActor={role.actorRole} closed />}
      </Section>
    </div>
  );
}

function TaskTable({ rows, roleActor, closed = false }: { rows: Awaited<ReturnType<typeof getTasks>>; roleActor: string; closed?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead className="text-left text-xs text-zinc-600">
          <tr className="border-b">
            <th className="p-2 font-medium">ID · 유형</th>
            <th className="p-2 font-medium">대상</th>
            <th className="p-2 font-medium">담당 역할</th>
            <th className="p-2 font-medium">기한</th>
            <th className="p-2 font-medium">상태</th>
            <th className="p-2 font-medium">지시 · 결과</th>
            <th className="p-2 font-medium">생성 원인</th>
            {!closed && <th className="p-2 font-medium">행동</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const mine = t.ownerRole === roleActor;
            return (
              <tr key={t.id} className={cn('border-b align-top last:border-0', t.status === 'OVERDUE' && 'bg-red-50')}>
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
                <td className={cn('p-2 text-xs font-semibold', t.status === 'OVERDUE' && 'text-red-700')}>{TASK_STATUS_KO[t.status]}</td>
                <td className="p-2 text-xs">
                  {t.instruction}
                  {t.resultNote && <div className="mt-1 text-zinc-600">결과: {t.resultNote}</div>}
                </td>
                <td className="p-2 font-mono text-xs">
                  {t.createdByEventId ? <Link href={`/history?eventId=${t.createdByEventId}`} className="underline">{t.createdByEventId}</Link> : '-'}
                </td>
                {!closed && (
                  <td className="p-2">
                    <div className="flex gap-1">
                      <Button size="xs" variant="outline" disabled title={mine ? '2단계 API 연결 후 활성' : '담당 역할만'}>
                        시작
                      </Button>
                      <Button size="xs" disabled title={mine ? '2단계 API 연결 후 활성' : '담당 역할만'}>
                        완료
                      </Button>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-600">{mine ? '내 작업 · API 연결 전' : '담당 역할만'}</div>
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
