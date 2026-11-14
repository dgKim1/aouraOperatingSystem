/** S-03 전속계약 상세 — 계약 갱신 결정을 권한자에게 올리고 통보 · 수령확인까지 추적 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertOctagon } from 'lucide-react';
import { InlineWarning } from '@/components/alerts/alert-item';
import { SourceBadgeStatic } from '@/components/badges/source-badge';
import { MoneyValue, NumValue, TextValue, UnknownChip } from '@/components/badges/values';
import { ApprovalStatusBadge, AuditTable, LineStatusBadge, PageHeader, RoleChip, Section } from '@/components/common';
import { DeadlineChip } from '@/components/deadline/deadline-chip';
import { fmtDateTime } from '@/components/format';
import { decisionText } from '@/components/labels';
import { PerfSummary, SampleNotice } from '@/components/perf-summary';
import { StatusStepper, contractSteps } from '@/components/status-stepper';
import { TabLinks } from '@/components/tab-links';
import { AssessButton, RequestApprovalButton } from '@/components/mutation/assessment-actions';
import { CounterpartyReplyForm } from '@/components/mutation/counterparty-reply-form';
import { Button } from '@/components/ui/button';
import type { ContractTermRow } from '@/domain/api-types';
import { getContract, getInfluencerRows, getMeta, getSession, getTasks } from '../../_data/views';

const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'performance', label: '성과 근거' },
  { id: 'assessment', label: '판단안' },
  { id: 'notice', label: '통보' },
  { id: 'history', label: '이력' },
];

type SP = Record<string, string | string[] | undefined>;

export default async function ContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const terminateOn = typeof sp.terminateOn === 'string' ? sp.terminateOn : undefined;
  const v = await getContract(decodeURIComponent(id), terminateOn);
  if (!v) notFound();
  const [{ role }, meta, tasks] = await Promise.all([getSession(), getMeta(), getTasks()]);
  const contractTasks = tasks.filter((t) => t.subjectId === v.contract.id && (t.status === 'OPEN' || t.status === 'IN_PROGRESS' || t.status === 'OVERDUE'));
  const tab = typeof sp.tab === 'string' && TABS.some((t) => t.id === sp.tab) ? sp.tab : 'overview';
  const c = v.contract;
  const base = `/contracts/${c.id}`;

  return (
    <div className="space-y-4">
      <PageHeader id="S-03" title={`전속계약 ${c.id}`} decision="통보 기한 전에 동일 조건 갱신 · 조건변경 통보 · 해지 통보 중 하나를 권한자(그룹 CEO/이사회)에게 승인받고, 통보 수령까지 확인합니다.">
        <span className="text-sm text-zinc-700">{c.influencerName}</span>
      </PageHeader>

      {c.autoRenewed && (
        <div className="flex items-start gap-3 rounded-md border-2 border-red-500 bg-red-50 p-3 text-red-900" role="alert">
          <AlertOctagon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">자동 갱신됨 — 권한 미경유 체결</p>
            <p>
              갱신 기간 {v.consequences.renewalStart} ~ {v.consequences.renewalEnd} · 고정 피 {v.consequences.committed && <MoneyValue m={v.consequences.committed} />} 확정 [원본 조건 · 상태 자동 갱신]
            </p>
          </div>
        </div>
      )}

      {c.status === 'REVIEW_BEFORE_DEADLINE' && (
        <div className="rounded-md border-2 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
          <p className="font-semibold">반려 · 기한 전 재검토 — 미갱신 확정이 아닙니다</p>
          <p>
            이대로 통보 기한 {c.noticeDeadline.value} 이 지나면 자동 갱신(= 권한 미경유 체결)됩니다. 통보(조건변경 · 해지)만 기한 후 선택지를 남깁니다.
          </p>
          {contractTasks.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-x-3 text-xs">
              {contractTasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks#task-${t.id}`} className="underline">
                    {t.typeText} ({t.id})
                  </Link>{' '}
                  · 기한 {fmtDateTime(t.dueAt)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <TabLinks base={base} tabs={TABS} current={tab} />

      {tab === 'overview' && (
        <div className="space-y-4">
          <Section title="진행 상태" id="step">
            <StatusStepper steps={contractSteps(c.status)} label="계약 처리 단계" />
            <p className="mt-2 text-sm">
              현재 <strong>{c.statusText}</strong> · {c.receiptText}
            </p>
          </Section>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section title="기한" id="deadline">
              <ul className="space-y-2 text-sm">
                {v.deadlines.map((d) => (
                  <li key={d.kind} className="flex flex-wrap items-center gap-2">
                    <span className="w-40">{d.kind}</span>
                    <DeadlineChip date={d.date} daysLeft={d.daysLeft} level={d.level} />
                    <SourceBadgeStatic label={d.label} />
                    {d.assumptionIds?.map((a) => (
                      <span key={a} className="text-xs">
                        {a}
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-zinc-700">기한(23:59:59 KST, A-13) 경과 시 유효 통보가 없으면 동일 조건 1년 자동 갱신 = 체결 (R-DL-02).</p>
            </Section>

            <Section title="권한 판정" id="authority">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                연 금액 {v.routing.lowerBound && <strong>하한</strong>} <MoneyValue m={v.routing.annualAmount} /> → <RoleChip role={v.routing.requiredRole} />
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {v.routing.reasons.map((r) => (
                  <li key={r.ruleId}>
                    <span className="font-mono">{r.ruleId}</span> <SourceBadgeStatic label={r.label} /> {r.text}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-zinc-700">
                covenant 대조: 고정 피 지급 일정이 없어 판정 불가 <UnknownChip gapId="G-09" /> — 이미 최상위 권한자라 권한자는 바뀌지 않음.
              </p>
            </Section>
          </div>

          <Section title="계약 조건" id="terms">
            <table className="w-full text-sm">
              <caption className="sr-only">계약 조건 — inf001_exclusive_contract_notice.md</caption>
              <tbody>
                {v.terms.map((t) => (
                  <tr key={t.key} className="border-b last:border-0">
                    <th scope="row" className="w-48 py-1.5 pr-3 text-left font-normal text-zinc-600">
                      {t.name}
                    </th>
                    <td className="py-1.5">
                      <TermValue v={t.value} />
                      {t.key === 'perfFee' && !('gapId' in t.value) && (
                        <span className="ml-2 text-xs text-zinc-700">
                          에이전시 모의 회신 문구 (A-33) — 금액으로 바꾸지 않음, 권한 판정은 연 금액 하한 그대로 ·{' '}
                          <Link href="/data?tab=gaps#G-02" className="underline">
                            G-02 원본 공백 그대로
                          </Link>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="연결된 기안 (별개 결정 — R-CON-01)" id="linked">
            <InlineWarning>기안을 부결해도 전속계약은 자동 갱신될 수 있습니다 — 기안 결정과 계약 결정은 별개 승인 요청입니다.</InlineWarning>
            <ul className="mt-2 space-y-1 text-sm">
              {v.linkedLines.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/proposals/PROP-2026-07?q=${l.id}`} className="font-mono underline">
                    {l.id}
                  </Link>
                  <span className="text-xs text-zinc-600">{l.campaignId}</span>
                  <MoneyValue m={l.requested} />
                  <span className="text-xs">기한 {l.contractDeadline}</span>
                  <LineStatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          </Section>

          {v.consequences.renewed && (
            <Section title="위약금 계산 (자동 갱신 후 중도 해지)" id="penalty">
              <form method="GET" action={base} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="tab" value="overview" />
                <label className="text-sm">
                  해지 예정일
                  <input type="date" name="terminateOn" defaultValue={terminateOn ?? '2026-09-30'} min={v.consequences.renewalStart} max={v.consequences.renewalEnd} className="ml-2 h-8 rounded border px-2" />
                </label>
                <Button type="submit" size="sm">
                  계산
                </Button>
              </form>
              {v.penaltyPreview ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {v.penaltyPreview.terminateOn} 해지 → 잔여 {v.penaltyPreview.remainingMonths}개월 → 위약금 <MoneyValue m={v.penaltyPreview.amount} strong />
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">해지 예정일을 넣으면 R-PEN-01 결과를 보여줍니다 (월할 균등 A-15).</p>
              )}
              <p className="mt-1 text-xs text-zinc-700">풀스케일 금액 — 표본 성과와 곱하지 않습니다.</p>
            </Section>
          )}
        </div>
      )}

      {tab === 'performance' && (
        <Section title="성과 근거 (표본 · 방향만)" id="perf" actions={<Link href="/analysis/influencers" className="text-xs underline">인플루언서 성과 순위</Link>}>
          <SampleNotice />
          <div className="mt-3">{v.performance ? <PerfSummary p={v.performance} refRow={(await getInfluencerRows(true)).rows.find((r) => r.influencerId === v.performance!.influencerId)} /> : <p className="text-sm">성과 없음</p>}</div>
          <p className="mt-3 text-xs text-zinc-700">
            INF-001 광고비(표본, 인플루언서 매체)에 고정 피가 들어 있는지는 대사하지 않음 <UnknownChip gapId="G-04" /> — 스케일이 다름.
          </p>
        </Section>
      )}

      {tab === 'assessment' && (
        <Section title="판단안 · 승인 요청" id="asm">
          {/* 버튼 위치를 판단안 유무와 상관없이 고정 — 서버 재조회 뒤에도 결과 패널(클라이언트 상태)이 유지되게 */}
          <div className="space-y-3 text-sm">
            {v.latestAssessment ? (
              <div className="rounded-md border p-3">
                <p className="flex flex-wrap items-center gap-2">
                  최신 판단안
                  <Link href={`/assessments/${v.latestAssessment.id}`} className="font-mono font-semibold underline">
                    {v.latestAssessment.id}
                  </Link>
                  <span>v{v.latestAssessment.version}</span>
                  <span className={v.latestAssessment.mock ? 'rounded border border-dashed border-zinc-600 px-1 text-[11px]' : 'rounded bg-emerald-600 px-1 text-[11px] text-white'}>AI: {v.latestAssessment.mock ? '모의' : '실시간'}</span>
                  <span className="font-mono text-xs text-zinc-600">{fmtDateTime(v.latestAssessment.createdAt)}</span>
                </p>
                <p className="mt-1">
                  <strong className="text-blue-900">
                    권고 {v.latestAssessment.recommendation.alternativeId}
                    {v.latestAssessment.recommendation.title ? ` · ${v.latestAssessment.recommendation.title}` : ''}
                  </strong>
                </p>
                <p className="mt-1 flex items-start gap-1 text-xs text-zinc-700">
                  {v.latestAssessment.mock && <SourceBadgeStatic label="MOCK" />} {v.latestAssessment.recommendation.rationale}
                </p>
              </div>
            ) : (
              <p>아직 판단안이 없습니다.</p>
            )}
            <AssessButton subjectType="CONTRACT" subjectIds={[c.id]} label={v.latestAssessment ? '판단안 다시 만들기' : 'AI 판단안 만들기'} aiMode={meta.aiMode} variant={v.latestAssessment ? 'outline' : 'default'} showRequestNext={false} actorRole={role.actorRole} />
            {v.latestAssessment && (
              <RequestApprovalButton key={v.latestAssessment.id} assessmentId={v.latestAssessment.id} actorRole={role.actorRole} disabledReason={v.canRequestApproval ? null : c.status === 'REVIEW_BEFORE_DEADLINE' ? '반려 뒤 재상신은 작업 화면의 「재상신」 작업을 완료해 만듭니다 (계약 담당, 이전 요청을 대체하는 v2)' : `지금 상태(${c.statusText})에서는 상신할 수 없습니다 — 검토 중일 때만`} />
            )}
            {v.assessments.length > 1 && (
              <div>
                <h4 className="mb-1 text-sm font-semibold">판단안 버전</h4>
                <ul className="space-y-0.5 text-xs">
                  {[...v.assessments].reverse().map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2">
                      <Link href={`/assessments/${a.id}`} className="font-mono underline">
                        {a.id}
                      </Link>
                      v{a.version} · {fmtDateTime(a.createdAt)} · 권고 {a.recommendation.alternativeId} {a.mock && <span className="rounded border border-dashed border-zinc-500 px-1">모의</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <h4 className="mt-4 mb-1 text-sm font-semibold">계약 승인 요청</h4>
          {v.approvals.length === 0 ? (
            <p className="text-sm text-muted-foreground">승인 요청 없음</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {v.approvals.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2">
                  <Link href={`/approvals/${a.id}`} className="font-mono underline">
                    {a.id}
                  </Link>
                  v{a.version} {a.supersedesId && <span className="text-xs text-zinc-600">({a.supersedesId} 대체)</span>} <RoleChip role={a.requiredRole} /> 권고 {decisionText(a.proposed[0]?.decision ?? '')} <ApprovalStatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs">
            미확인 공백:{' '}
            {v.openGaps.map((g) => (
              <span key={g} className="mr-2">
                <UnknownChip gapId={g} />
              </span>
            ))}
          </p>
        </Section>
      )}

      {tab === 'notice' && (
        <Section title="통보 · 수령확인 (확장 E1)" id="notice">
          {c.status === 'NOTICE_SENT' && <InlineWarning>통보 발송됨 · 수령 미확인 — 통보 완료로 보지 않음 (A-14)</InlineWarning>}
          <h4 className="mt-2 mb-1 text-sm font-semibold">통보 기록</h4>
          {v.notices.length === 0 ? (
            <p className="text-sm text-muted-foreground">통보 기록 없음</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {v.notices.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{n.id}</span> {decisionText(n.decision)} · {fmtDateTime(n.sentAt)} · {n.channel} <SourceBadgeStatic label={n.label} />
                </li>
              ))}
            </ul>
          )}
          <h4 className="mt-3 mb-1 text-sm font-semibold">수령확인</h4>
          {v.receipts.length === 0 ? (
            <p className="text-sm">
              없음 <UnknownChip gapId="G-03" />
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {v.receipts.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{r.id}</span> {fmtDateTime(r.receivedAt)} · 증빙 {r.evidence} <SourceBadgeStatic label={r.label} />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 space-y-2">
            <h4 className="text-sm font-semibold">열린 계약 작업</h4>
            {contractTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">없음</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {contractTasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/tasks#task-${t.id}`} className="font-mono underline">
                      {t.id}
                    </Link>
                    <strong>{t.typeText}</strong> <RoleChip role={t.ownerRole} /> <span className="font-mono text-xs">기한 {fmtDateTime(t.dueAt)}</span> <span className="text-xs">{t.statusText}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-zinc-700">
              [통보 발송 기록]은 <Link href="/tasks" className="underline">작업</Link>에서 계약 담당 역할로 「통보 발송」 작업을 완료합니다{role.actorRole === 'CONTRACT_OFFICER' ? ' (현재 역할 가능)' : ''}.
            </p>
            {role.actorRole === 'AGENCY' && !contractTasks.some((t) => t.type === 'CONFIRM_RECEIPT' || t.type === 'RENOTIFY' || t.type === 'INFO_REQUEST') ? (
              <p className="text-xs text-zinc-700">에이전시가 회신할 열린 작업(수령확인 · 재통보 · 정보 요청)이 없습니다.</p>
            ) : role.actorRole === 'AGENCY' ? (
              <div>
                <h4 className="mb-1 text-sm font-semibold">에이전시 회신 (모의)</h4>
                <CounterpartyReplyForm fixedFrom="AGENCY" defaultOutcome="RECEIPT_CONFIRMED" submitLabel="에이전시 회신 기록 (모의)" />
              </div>
            ) : (
              <p className="text-xs text-zinc-700">[수령확인 회신]은 상단 「현재 역할」을 에이전시(모의)로 바꾸면 여기서 넣을 수 있습니다 (또는 사건 입력의 외부 회신).</p>
            )}
          </div>
        </Section>
      )}

      {tab === 'history' && (
        <Section title="이 계약의 처리 이력" id="hist">
          <AuditTable rows={[...v.audit].reverse()} />
        </Section>
      )}
    </div>
  );
}

function TermValue({ v }: { v: ContractTermRow['value'] }) {
  if ('gapId' in v) return <UnknownChip gapId={v.gapId} note={v.note} />;
  if (typeof v.value === 'number') {
    if (v.scale === 'FULL') return <MoneyValue m={{ ...v, value: v.value, scale: 'FULL' }} />;
    return <NumValue n={{ ...v, value: v.value }} />;
  }
  return <TextValue t={{ ...v, value: v.value }} />;
}
