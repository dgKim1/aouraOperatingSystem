/** S-06 승인 요청 상세 — 권한자가 근거(권고 · 권한 근거 · 기한 · 경고)를 보고 회신한다 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertList, InlineWarning } from '@/components/alerts/alert-item';
import { ReplyPanel } from '@/components/approval/reply-panel';
import { SourceBadgeStatic } from '@/components/badges/source-badge';
import { MoneyValue } from '@/components/badges/values';
import { ApprovalStatusBadge, AuditTable, FlagChip, PageHeader, RoleChip, Section } from '@/components/common';
import { DeadlineChip } from '@/components/deadline/deadline-chip';
import { fmtDateTime } from '@/components/format';
import { ROLE_KO } from '@/domain/types';
import { cn } from '@/lib/utils';
import { getApproval, getSession } from '../../_data/views';

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [v, { role }] = await Promise.all([getApproval(decodeURIComponent(id)), getSession()]);
  if (!v) notFound();
  const a = v.request;
  return (
    <div className="space-y-4">
      <PageHeader id="S-06" title={`승인 요청 ${a.id}`} decision={`${ROLE_KO[a.requiredRole]}이(가) ${v.subjectText}에 대해 권고안을 승인 · 조건부 승인 · 반려 · 정보 요청 중 하나로 결정합니다.`}>
        <ApprovalStatusBadge status={a.status} />
        <span className="text-xs text-zinc-600">v{a.version}</span>
      </PageHeader>

      {a.status === 'SUPERSEDED' && <InlineWarning tone="info">이 요청은 {v.supersededBy ? <Link className="underline" href={`/approvals/${v.supersededBy}`}>{v.supersededBy}</Link> : '새 요청'} 로 대체됨 — 대체된 요청에는 회신할 수 없습니다.</InlineWarning>}
      {a.status === 'EXPIRED' && <InlineWarning tone="danger">기한 경과로 만료 — 미회신 상태로 원본 기한({a.hardDeadline})이 지났습니다.</InlineWarning>}
      {a.supersedesId && (
        <InlineWarning tone="info">
          재상신 v{a.version} — 이전 요청 <Link className="underline" href={`/approvals/${a.supersedesId}`}>{a.supersedesId}</Link> 대체
        </InlineWarning>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <Section title="요청 요약 · 권고" id="sum">
            <p className="mb-2 text-sm">
              대상 <Link href={v.subjectHref} className="underline">{v.subjectText}</Link>
            </p>
            <ul className="space-y-2">
              {v.items.map((i) => (
                <li key={i.itemId} className="rounded-md border p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={i.href} className="text-sm font-medium underline underline-offset-2">
                      {i.title}
                    </Link>
                    {i.status && <span className="text-xs text-zinc-600">현재 {i.status}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                    <span className={cn('font-semibold', i.proposedDecision === 'REJECT' ? 'text-red-800' : i.proposedDecision === 'CONDITIONAL' ? 'text-amber-800' : 'text-blue-900')}>권고: {i.proposedText}</span>
                    {i.requested && <MoneyValue m={i.requested} />}
                    {i.grade && <span className={cn('text-xs', i.grade === 'CP_NEGATIVE' ? 'text-red-800' : 'text-emerald-800')}>{i.grade === 'CP_NEGATIVE' ? '실질 공헌이익 음수' : '실질 공헌이익 양수'}</span>}
                  </div>
                  {i.flags && i.flags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {i.flags
                        .filter((f) => f !== 'CP_POSITIVE' && f !== 'CP_NEGATIVE')
                        .map((f) => (
                          <FlagChip key={f} flag={f} />
                        ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-zinc-600">
              권고는 규칙 엔진 결과 <SourceBadgeStatic label="AGGREGATED" />.{' '}
              {v.assessmentId ? (
                <Link href={`/assessments/${v.assessmentId}`} className="underline">
                  판단안 {v.assessmentId} 보기
                </Link>
              ) : (
                '판단안 스냅샷 없음'
              )}
            </p>
          </Section>

          <Section title="권한 근거" id="routing">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <RoleChip role={a.requiredRole} />
              {a.alsoReportTo.length > 0 && <span className="text-xs">+ 그룹 보고 ({a.alsoReportTo.map((r) => ROLE_KO[r]).join(', ')})</span>}
            </div>
            <ul className="space-y-1 text-sm">
              {a.routingReasons.map((r) => (
                <li key={r.ruleId + r.text} className="flex flex-wrap items-start gap-2">
                  <span className="font-mono text-xs">{r.ruleId}</span>
                  <SourceBadgeStatic label={r.label} />
                  <span>{r.text}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="관련 경고" id="alerts">
            <AlertList alerts={v.alerts} empty="관련 경고가 없습니다." />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="기한" id="dl">
            <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
              <dt className="text-zinc-600">원본 기한</dt>
              <dd>
                <DeadlineChip date={a.hardDeadline} daysLeft={v.daysLeft} level={v.level} />
              </dd>
              <dt className="text-zinc-600">내부 기한</dt>
              <dd className="flex items-center gap-1">
                <span className="font-mono text-xs">{fmtDateTime(a.internalDueAt)}</span>
                <SourceBadgeStatic label="ASSUMPTION" />
                <span className="text-xs">A-12</span>
              </dd>
            </dl>
            <p className="mt-2 text-xs text-zinc-700">
              기한 경과 시: {a.subjectType === 'CONTRACT' ? '미통보 자동 갱신 = 권한 미경유 체결' : a.subjectType === 'EXPANSION_LINES' ? '미결 건 자동 확정 (철회 불가)' : '요청 만료'}
            </p>
          </Section>

          <Section title={`회신 — 현재 역할 ${role.label}`} id="reply">
            <ReplyPanel
              requestId={a.id}
              requiredRole={a.requiredRole}
              status={a.status}
              subjectType={a.subjectType}
              items={v.items}
              contractDecisions={v.contractDecisionAllowed}
              current={{ actorRole: role.actorRole, label: role.label }}
            />
          </Section>

          {v.replies.length > 0 && (
            <Section title="회신 기록" id="replies">
              <ul className="space-y-2 text-sm">
                {v.replies.map((r) => (
                  <li key={r.id} className="rounded-md border border-dashed border-zinc-400 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs">{r.id}</span>
                      <RoleChip role={r.respondentRole} />
                      <strong>{r.outcome}</strong>
                      <SourceBadgeStatic label={r.label} />
                      <span className="font-mono text-xs text-zinc-600">{fmtDateTime(r.simAt)}</span>
                    </div>
                    <p className="mt-1 text-xs">{r.reason}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>

      <Section title="이 요청의 처리 이력" id="audit">
        <AuditTable rows={[...v.audit].reverse()} />
      </Section>
    </div>
  );
}
