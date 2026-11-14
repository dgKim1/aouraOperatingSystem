/** S-06 승인함 — 내 역할 대상 요청 우선, 다른 역할 요청은 회색(조회만) */
import Link from 'next/link';
import { ApprovalStatusBadge, PageHeader, RoleChip, Section } from '@/components/common';
import { DeadlineChip } from '@/components/deadline/deadline-chip';
import { fmtDateTime } from '@/components/format';
import { cn } from '@/lib/utils';
import { getApprovals, getSession } from '../_data/views';

export default async function ApprovalsPage() {
  const [list, { role }] = await Promise.all([getApprovals(), getSession()]);
  const mine = (r: string) => r === role.actorRole;
  const sorted = [...list].sort((a, b) => Number(mine(b.request.requiredRole) && b.request.status === 'PENDING') - Number(mine(a.request.requiredRole) && a.request.status === 'PENDING') || a.request.id.localeCompare(b.request.id));
  return (
    <div className="space-y-4">
      <PageHeader id="S-06" title="승인함" decision={`권한자(현재 역할: ${role.label})가 근거를 보고 승인 · 조건부 승인 · 반려 · 정보 요청으로 회신합니다. 결정은 사람만 합니다.`} />
      <Section title={`승인 요청 (${list.length}건)`} id="apr">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">승인 요청이 없습니다. 기안 상세 · 전속계약에서 승인 요청을 만듭니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <caption className="sr-only">승인 요청 목록 — 내 역할 대상 우선</caption>
              <thead className="text-left text-xs text-zinc-600">
                <tr className="border-b">
                  <th className="p-2 font-medium">ID</th>
                  <th className="p-2 font-medium">대상</th>
                  <th className="p-2 font-medium">권한자</th>
                  <th className="p-2 font-medium">권한 근거</th>
                  <th className="p-2 font-medium">내부 기한</th>
                  <th className="p-2 font-medium">원본 기한</th>
                  <th className="p-2 font-medium">상태</th>
                  <th className="p-2 font-medium">버전</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => {
                  const m = mine(a.request.requiredRole);
                  return (
                    <tr key={a.request.id} className={cn('border-b align-top last:border-0', m ? 'bg-blue-50/60' : 'text-zinc-500')}>
                      <td className="p-2">
                        <Link href={`/approvals/${a.request.id}`} className="font-mono font-semibold text-zinc-900 underline">
                          {a.request.id}
                        </Link>
                        {m && a.request.status === 'PENDING' && <div className="text-[11px] font-semibold text-blue-800">내가 결정</div>}
                        {!m && <div className="text-[11px]">조회만</div>}
                      </td>
                      <td className="p-2">
                        <Link href={a.subjectHref} className="underline underline-offset-2">
                          {a.subjectText}
                        </Link>
                      </td>
                      <td className="p-2">
                        <RoleChip role={a.request.requiredRole} />
                        {a.request.alsoReportTo.length > 0 && <div className="text-[11px]">+ 그룹 보고</div>}
                      </td>
                      <td className="p-2 font-mono text-xs">{[...new Set(a.request.routingReasons.map((r) => r.ruleId))].join(' ')}</td>
                      <td className="p-2 font-mono text-xs whitespace-nowrap">{fmtDateTime(a.request.internalDueAt)}</td>
                      <td className="p-2">
                        <DeadlineChip date={a.request.hardDeadline} daysLeft={a.daysLeft} level={a.level} />
                      </td>
                      <td className="p-2">
                        <ApprovalStatusBadge status={a.request.status} />
                      </td>
                      <td className="p-2 text-xs">
                        v{a.request.version}
                        {a.request.supersedesId && <div>{a.request.supersedesId} 대체</div>}
                        {a.supersededBy && <div className="text-zinc-600">→ {a.supersededBy} 로 넘어감</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
