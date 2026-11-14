/** S-01 운영 현황 — "지금 기한 안에 누가 무엇을 결정해야 하는가" */
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AlertList } from '@/components/alerts/alert-item';
import { ReferenceChip } from '@/components/badges/fold';
import { MoneyValue, TextValue, UnknownChip } from '@/components/badges/values';
import { AuditTable, PageHeader, RoleChip, Section } from '@/components/common';
import { DeadlineChip } from '@/components/deadline/deadline-chip';
import { DeadlineTimeline, TimelineTable } from '@/components/deadline/deadline-timeline';
import { fmtDateTime } from '@/components/format';
import { ROLE_KO } from '@/domain/types';
import { cn } from '@/lib/utils';
import { getContract, getMeta, getOverview, getSession } from './_data/views';

/** 자동 갱신 뒤 보여 줄 해지 예시일 — 시연 ③-B(DEMO_SCENARIOS S3-4)의 두 날짜. 위약금은 서버(R-PEN-01)가 계산한 값만 표시 */
const PENALTY_EXAMPLES = ['2026-09-30', '2026-12-31'];

export default async function OverviewPage() {
  const [o, meta, { role }] = await Promise.all([getOverview(), getMeta(), getSession()]);
  const c = o.contract;
  const reviewing = c.status === 'REVIEW_BEFORE_DEADLINE';
  const penalties = c.autoRenewed ? (await Promise.all(PENALTY_EXAMPLES.map((d) => getContract(c.id, d)))).map((v) => v?.penaltyPreview ?? null).filter((x) => x !== null) : [];
  const renewal = c.autoRenewed ? ((await getContract(c.id))?.consequences ?? null) : null;
  return (
    <div className="space-y-4">
      <PageHeader id="S-01" title="운영 현황" decision="기한 안에 누가 무엇을 결정해야 하는지 보고, 승인 요청 · 회신 · 작업으로 바로 이동합니다." />

      {!o.received && (
        <p className="rounded-md border bg-white p-4 text-sm">
          접수된 통보 · 기안이 없습니다.{' '}
          <Link href="/events" className="underline">
            사건 입력
          </Link>{' '}
          또는{' '}
          <Link href="/scenarios" className="underline">
            시연 시나리오
          </Link>
        </p>
      )}

      <Section title="기한 타임라인 (2026-07-01 ~ 2026-09-30)" id="tl">
        <DeadlineTimeline items={o.timeline} windows={o.covenantWindows} simNow={meta.simNow} />
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-zinc-700 underline underline-offset-2">일정 목록 (표로 보기 · 금액은 레인별 스케일)</summary>
          <div className="mt-2">
            <TimelineTable items={o.timeline} windows={o.covenantWindows} />
          </div>
        </details>
      </Section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Section title={`결정 대기 (${o.pendingApprovals.length}건)`} id="pending" actions={<Link href="/approvals" className="text-xs underline">승인함</Link>}>
          {o.pendingApprovals.length === 0 ? (
            <p className="text-sm text-muted-foreground">대기 중인 승인 요청이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {o.pendingApprovals.map((p) => {
                const mine = p.requiredRole === role.actorRole;
                return (
                  <li key={p.id}>
                    <Link
                      href={`/approvals/${p.id}`}
                      className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border p-3 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none', mine && 'border-blue-600 ring-1 ring-blue-600')}
                    >
                      <span className="font-mono text-sm font-semibold">{p.id}</span>
                      <RoleChip role={p.requiredRole} />
                      <span className="text-sm">{p.subjectText}</span>
                      <DeadlineChip date={p.hardDeadline} daysLeft={p.daysLeft} level={p.level} />
                      <span className="text-xs text-zinc-600">내부 기한 {fmtDateTime(p.internalDueAt)}</span>
                      <span className="w-full text-sm font-medium text-blue-900">{p.recommendation}</span>
                      {mine && <span className="text-xs font-semibold text-blue-800">내 역할({role.label})이 결정할 요청</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title="전속계약" id="contract" actions={<Link href={`/contracts/${c.id}`} className="text-xs underline">상세</Link>}>
          {c.autoRenewalRisk && !c.autoRenewed && (
            <div className="mb-2 rounded-md border-2 border-red-500 bg-red-50 p-2 text-sm text-red-900" role="alert">
              {reviewing && <span className="mb-1 inline-block rounded bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white">반려 · 재검토 중</span>}
              <p className="font-semibold">
                {reviewing
                  ? `이대로 ${c.noticeDeadline.value} 이 지나면 자동 갱신(= 권한 미경유 체결)됩니다. 반려는 미갱신 확정이 아닙니다.`
                  : '자동 갱신 위험 — 유효 통보 없이 통보 기한이 지나면 계약이 권한 승인 없이 체결됩니다.'}
              </p>
              <p className="mt-1 text-xs">
                다음 행동:{' '}
                {reviewing ? (
                  <Link href="/tasks" className="underline">
                    계약 담당 — 정보 요청 · 기한 전 재검토 · 재상신 작업
                  </Link>
                ) : (
                  <Link href={`/contracts/${c.id}?tab=assessment`} className="underline">
                    계약 결정 상신
                  </Link>
                )}
              </p>
            </div>
          )}
          {c.autoRenewed && (
            <div className="mb-2 rounded-md border-2 border-red-500 bg-red-50 p-2 text-sm text-red-900" role="alert">
              <p className="font-semibold">1년 배분 선점 — 자동 갱신으로 고정 피가 확정되었습니다 (권한 미경유 체결)</p>
              {renewal?.committed && (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                  {renewal.renewalStart} ~ {renewal.renewalEnd} 고정 피 <MoneyValue m={renewal.committed} /> — 다음 확대 판단에서 이 금액이 먼저 묶입니다
                </p>
              )}
              {penalties.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {penalties.map((p) => (
                    <li key={p.terminateOn} className="flex flex-wrap items-center gap-1">
                      {p.terminateOn} 해지 시 잔여 {p.remainingMonths}개월 → 위약금 <MoneyValue m={p.amount} />
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-1 text-xs">
                다음 행동:{' '}
                <Link href="/tasks" className="underline">
                  그룹 CEO/이사회 사고 대응 작업
                </Link>{' '}
                ·{' '}
                <Link href={`/contracts/${c.id}?tab=assessment`} className="underline">
                  유지 · 중도 해지 판단안
                </Link>{' '}
                · 표본 성과와 곱하지 않음
              </p>
            </div>
          )}
          <dl className={cn('grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm', c.autoRenewed && 'rounded-md bg-red-50 p-2 ring-2 ring-red-500')}>
            <dt className="text-zinc-600">대상</dt>
            <dd>{c.influencerName}</dd>
            <dt className="text-zinc-600">상태</dt>
            <dd className={cn('font-semibold', c.autoRenewed && 'text-red-700')}>{c.statusText}</dd>
            <dt className="text-zinc-600">고정 피 (연)</dt>
            <dd>
              <MoneyValue m={c.fixedFee} />
            </dd>
            <dt className="text-zinc-600">성과 피</dt>
            <dd>
              {'gapId' in c.performanceFee ? (
                <UnknownChip gapId={c.performanceFee.gapId} note={c.performanceFee.note} />
              ) : (
                <span className="inline-flex flex-wrap items-center gap-1">
                  <TextValue t={c.performanceFee} />
                  <Link href="/data?tab=gaps#G-02" className="text-xs underline">
                    G-02 (원본 공백 그대로)
                  </Link>
                </span>
              )}
            </dd>
            <dt className="text-zinc-600">통보 기한</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <TextValue t={c.noticeDeadline} />
              <DeadlineChip date={c.noticeDeadline.value} daysLeft={c.daysLeft} level={c.level} />
            </dd>
            <dt className="text-zinc-600">수령확인</dt>
            <dd className={cn(c.receiptConfirmed ? 'text-emerald-800' : 'text-zinc-800')}>{c.receiptText}</dd>
          </dl>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Section title={`경고 (${o.alerts.length})`} id="alerts">
          <AlertList alerts={o.alerts} />
          {o.referenceFlags.length > 0 && (
            <div className="mt-3 border-t pt-2">
              <p className="mb-1 text-xs text-zinc-600">참고 (경고 아님 — 판단에 쓰지 않음)</p>
              <ul className="flex flex-wrap gap-1">
                {o.referenceFlags.map((f) => (
                  <li key={f.subjectId} className="inline-flex items-center gap-1 text-xs">
                    <span className="font-mono">{f.subjectId}</span>
                    <ReferenceChip text="참고: 1.4 값 음수" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section title="작업 요약" id="tasks" actions={<Link href="/tasks" className="text-xs underline">작업</Link>}>
          <p className="text-sm">
            열린 작업 <strong className="tabular-nums">{o.taskCounts.open}</strong>건 · 기한 경과{' '}
            <strong className={cn('tabular-nums', o.taskCounts.overdue > 0 && 'text-red-700')}>{o.taskCounts.overdue}</strong>건
          </p>
          {o.taskCounts.byRole.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm">
              {o.taskCounts.byRole.map((r) => (
                <li key={r.role} className="flex items-center gap-2">
                  <span className="w-32">{ROLE_KO[r.role]}</span>
                  <span className="tabular-nums">열림 {r.open}</span>
                  {r.overdue > 0 && <span className="text-red-700 tabular-nums">경과 {r.overdue}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">열린 작업이 없습니다.</p>
          )}
        </Section>
      </div>

      <Section title="최근 처리 이력 5건" id="recent" actions={<Link href="/history" className="inline-flex items-center gap-1 text-xs underline">전체 <ArrowRight className="size-3" aria-hidden /></Link>}>
        <AuditTable rows={o.recentAudit} />
      </Section>
    </div>
  );
}
