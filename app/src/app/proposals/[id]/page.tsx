/** S-04 확대 기안 상세 — 기한 묶음별로 건마다 권한자 · 성과 방향 · 재고 · covenant 를 보고 상신 묶음을 만든다 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClaimsFold } from '@/components/badges/fold';
import { MoneyValue, NumValue } from '@/components/badges/values';
import { PageHeader, Section } from '@/components/common';
import { FLAG_KO } from '@/components/labels';
import { ProposalTable } from '@/components/proposal/proposal-table';
import type { LineFlag } from '@/domain/types';
import { ROLE_KO } from '@/domain/types';
import { cn } from '@/lib/utils';
import { getApprovals, getMeta, getProposal, type ProposalFilters } from '../../_data/views';

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ProposalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const filters: ProposalFilters = {};
  for (const k of ['deadline', 'role', 'grade', 'status', 'flag', 'approval'] as const) {
    const v = one(sp[k]);
    if (v) filters[k] = v;
  }
  const [v, meta, approvals] = await Promise.all([getProposal(decodeURIComponent(id), filters), getMeta(), getApprovals()]);
  if (!v) notFound();
  const approvalRefs = Object.fromEntries(approvals.map((a) => [a.request.id, { version: a.request.version, supersedesId: a.request.supersedesId, statusText: a.statusText }]));
  const focus = one(sp.q);

  if (!v.received || !v.proposal || !v.summary) {
    return (
      <div>
        <PageHeader id="S-04" title="확대 기안 상세" decision="기안 건별로 승인 · 부결 · 조건부를 권고하고 권한자별 상신 묶음을 만듭니다." />
        <p className="rounded-md border bg-white p-4 text-sm">
          기안이 접수되지 않았습니다. <Link href="/events" className="underline">사건 입력</Link>에서 확대 기안을 접수하세요.
        </p>
      </div>
    );
  }
  const p = v.proposal;
  const s = v.summary;
  const href = (k: keyof ProposalFilters, val?: string) => {
    const q = new URLSearchParams();
    for (const [kk, vv] of Object.entries(filters)) if (kk !== k && vv) q.set(kk, vv);
    if (val) q.set(k, val);
    const qs = q.toString();
    return `/proposals/${p.id}${qs ? `?${qs}` : ''}`;
  };
  const chip = (k: keyof ProposalFilters, val: string | undefined, label: string) => (
    <Link
      key={`${k}-${val ?? 'all'}`}
      href={href(k, val)}
      aria-current={filters[k] === val || (!val && !filters[k]) ? 'true' : undefined}
      className={cn('rounded-full border px-2 py-0.5 text-xs hover:bg-zinc-100', (filters[k] === val || (!val && !filters[k])) && 'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800')}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-4">
      <PageHeader id="S-04" title={`확대 기안 ${p.id}`} decision="기한이 임박한 묶음부터 건별 실질 성과 · 권한자 · 재고 · covenant 를 확인해 승인 요청(상신) 묶음을 만듭니다." />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Section title="요약" id="sum">
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-zinc-600">기안 총액</dt>
            <dd>
              <MoneyValue m={p.total} strong />
            </dd>
            <dt className="text-zinc-600">권한 판정</dt>
            <dd>
              <strong>{s.authorityText}</strong>
              <span className="ml-1 inline-flex h-5 items-center rounded border border-teal-300 bg-teal-50 px-1.5 text-[11px] text-teal-800">원본근거해석 W02 3-3</span>
              {s.authorityReasons.map((r) => (
                <div key={r.ruleId} className="text-xs text-zinc-600">
                  <span className="font-mono">{r.ruleId}</span> {r.text}
                </div>
              ))}
            </dd>
            <dt className="text-zinc-600">건별 1천만 초과</dt>
            <dd>
              <NumValue n={s.over10mCount} format="int" />건 / <NumValue n={p.lineCount} format="int" />건
            </dd>
            <dt className="text-zinc-600">성과 등급 (공식값)</dt>
            <dd className="text-sm">
              양수 {s.gradeCounts.positive}건 · <span className="text-red-700">음수(부결 권고) {s.gradeCounts.negative}건</span>
              <span className="ml-2 text-xs text-zinc-500">참고: 1.4 값 부호 다름 {s.gradeCounts.refDiffers}건 (판단에 쓰지 않음)</span>
            </dd>
          </dl>
        </Section>
        <Section title="확정기한별 묶음" id="groups">
          <ul className="space-y-2 text-sm">
            {s.groups.map((g) => (
              <li key={g.deadline} className="flex flex-wrap items-center gap-2">
                <Link href={href('deadline', g.deadline)} className="font-mono underline">
                  {g.deadline}
                </Link>
                <span>{g.count}건</span>
                <MoneyValue m={g.total} />
                <NumValue n={g.share} format="pct" />
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">기한이 지나면 미결 건은 자동 확정(철회 불가, R-DL-01).</p>
          {v.covenantWindow && (
            <p className="mt-1 text-xs text-red-800">
              현재 covenant 하회 예상 구간 {v.covenantWindow.start} ~ {v.covenantWindow.end} ({v.covenantWindow.forecastId}) — 이 구간에 집행일이 있으면 그룹 CEO/이사회 (R-AUTH-03)
            </p>
          )}
        </Section>
      </div>

      <ClaimsFold title="주장 · 참고 — 기안 예상 GMV · 회의록">
        <p className="flex flex-wrap items-center gap-2">
          기안 예상 GMV 합 <MoneyValue m={p.expectedGmvTotal} claimArea />
        </p>
        <p className="text-xs text-purple-900">예상 GMV 는 차감 전 금액이라 승인 근거가 될 수 없습니다 (approval_authority_policy · R-CLAIM-01). 판단은 확대 대상 캠페인의 실질 공헌이익(공식값)으로 합니다.</p>
      </ClaimsFold>

      <Section title={`기안 건 (${v.lines.length}건${Object.keys(filters).length ? ', 필터 적용' : ''})`} id="lines">
        <div className="mb-3 space-y-1.5" aria-label="필터">
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-16 text-xs text-zinc-600">기한</span>
            {chip('deadline', undefined, '전체')}
            {s.groups.map((g) => chip('deadline', g.deadline, g.deadline))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-16 text-xs text-zinc-600">권한자</span>
            {chip('role', undefined, '전체')}
            {(['GROUP_CEO_BOARD', 'MASIL_CEO', 'MARKETING_TEAM'] as const).map((r) => chip('role', r, ROLE_KO[r]))}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-16 text-xs text-zinc-600">등급</span>
            {chip('grade', undefined, '전체')}
            {chip('grade', 'CP_NEGATIVE', '음수 (부결 권고)')}
            {chip('grade', 'CP_POSITIVE', '양수')}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <span className="w-16 text-xs text-zinc-600">플래그</span>
            {chip('flag', undefined, '전체')}
            {(['IN_COVENANT_WINDOW', 'CONTRACT_PENDING', 'INVENTORY_BELOW_MIN', 'SETTLEMENT_BEFORE_DEADLINE', 'OVER_10M'] as LineFlag[]).map((f) => chip('flag', f, FLAG_KO[f]))}
          </div>
          {filters.approval && <div className="text-xs">승인요청 {filters.approval} 대상만 — {chip('approval', undefined, '해제')}</div>}
        </div>
        {v.lines.length === 0 ? <p className="text-sm text-muted-foreground">조건에 맞는 건이 없습니다.</p> : <ProposalTable lines={v.lines} focusId={focus} aiMode={meta.aiMode} approvals={approvalRefs} />}
        <p className="mt-3 text-xs text-zinc-600">표의 권고는 규칙 엔진 결과이며 AI 문장이 아닙니다. 판단안을 만든 뒤 [승인 요청 만들기]를 누르면 서버가 권한자 × 확정기한별로 묶어 요청을 만듭니다(A-11).</p>
      </Section>
    </div>
  );
}
