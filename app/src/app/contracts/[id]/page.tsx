/** S-03 전속계약 상세 — 계약 갱신 결정을 권한자에게 올리고 통보 · 수령확인까지 추적 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertOctagon } from 'lucide-react';
import { InlineWarning } from '@/components/alerts/alert-item';
import { SourceBadgeStatic } from '@/components/badges/source-badge';
import { MoneyValue, NumValue, TextValue, UnknownChip } from '@/components/badges/values';
import { ApprovalStatusBadge, AuditTable, LineStatusBadge, PageHeader, RoleChip, Section, StubNotice } from '@/components/common';
import { DeadlineChip } from '@/components/deadline/deadline-chip';
import { fmtDateTime } from '@/components/format';
import { decisionText } from '@/components/labels';
import { PerfSummary, SampleNotice } from '@/components/perf-summary';
import { StatusStepper, contractSteps } from '@/components/status-stepper';
import { TabLinks } from '@/components/tab-links';
import { Button } from '@/components/ui/button';
import type { ContractTermRow } from '../../_data/types';
import { getContract, getInfluencerRows, getSession } from '../../_data/views';

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
  const { role } = await getSession();
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
        <Section title="판단안" id="asm">
          {v.assessmentId ? (
            <div className="space-y-2 text-sm">
              <p>
                최신 판단안{' '}
                <Link href={`/assessments/${v.assessmentId}`} className="font-mono underline">
                  {v.assessmentId}
                </Link>{' '}
                <span className="rounded border border-dashed border-zinc-500 px-1 text-[11px]">모의</span> — 대안 A 동일 조건 갱신 · B 조건변경 통보(권고) · C 해지 통보
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled title="2단계 API 연결 후 활성">
                  승인 요청 만들기
                </Button>
                <Button size="sm" variant="outline" disabled title="2단계 API 연결 후 활성">
                  판단안 다시 만들기
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm">
              아직 판단안이 없습니다.{' '}
              <Button size="sm" disabled title="2단계 API 연결 후 활성">
                AI 판단안 만들기 <span className="ml-1 rounded border border-dashed px-1 text-[10px]">모의</span>
              </Button>
            </p>
          )}
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
                  v{a.version} <RoleChip role={a.requiredRole} /> 권고 {decisionText(a.proposed[0]?.decision ?? '')} <ApprovalStatusBadge status={a.status} />
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
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" disabled title="2단계 API 연결 후 활성">
              통보 발송 기록 {role.actorRole === 'CONTRACT_OFFICER' ? '(현재 역할 가능 · API 연결 전)' : '(계약 담당만)'}
            </Button>
            <Button size="sm" variant="outline" disabled title="2단계 API 연결 후 활성">
              수령확인 회신 {role.id === 'AGENCY' ? '(현재 역할 가능 · API 연결 전)' : '(에이전시(모의)만)'}
            </Button>
          </div>
          <div className="mt-2">
            <StubNotice>통보 발송 · 수령확인 기록은 2단계 API(작업 완료 · 외부 회신) 연결 후 저장됩니다. 지금은 시연 프리셋(시점 이동 창)으로 결과 상태를 확인하세요.</StubNotice>
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
