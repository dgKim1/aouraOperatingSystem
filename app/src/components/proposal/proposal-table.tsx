'use client';
/**
 * S-04 기안 건 표 — 행 선택 · 건 상세 드로어 · 1.4 참고값 보조 열(기본 숨김, UI-10).
 * 값 · 판정은 모두 받은 LineView 그대로. [선택 건 판단안 만들기] → POST /api/assessments, 이어서 [승인 요청 만들기] → POST /api/approval-requests.
 * 재승인 · 재상신 표시는 요청 번호가 아니라 승인요청의 version · supersedesId 로 그린다 (FE-05).
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, PackageX } from 'lucide-react';
import type { LineView } from '@/domain/api-types';
import type { ActorRole } from '@/domain/types';
import { ClaimsFold, ReferenceChip, ReferenceFold } from '@/components/badges/fold';
import { MoneyValue, NumValue } from '@/components/badges/values';
import { FlagChip, LineStatusBadge, RoleChange, RoleChip } from '@/components/common';
import { DeadlineChip } from '@/components/deadline/deadline-chip';
import { decisionText } from '@/components/labels';
import { AssessButton } from '@/components/mutation/assessment-actions';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface ApprovalRef {
  version: number;
  supersedesId: string | null;
  statusText: string;
}

/** 건을 다룬 판단안 (최신 먼저) — 버전 · 건별 권고는 판단안 값 그대로 (FE-17) */
export interface LineAssessmentRef {
  id: string;
  version: number;
  mock: boolean;
  decision: string | null;
}

export function ProposalTable({
  lines,
  focusId,
  aiMode,
  approvals,
  assessments = {},
  actorRole,
}: {
  lines: LineView[];
  focusId?: string | undefined;
  aiMode: 'LIVE' | 'MOCK';
  approvals: Record<string, ApprovalRef>;
  assessments?: Record<string, LineAssessmentRef[]>;
  actorRole: ActorRole;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showRef, setShowRef] = useState(false);
  const [openId, setOpenId] = useState<string | null>(focusId && lines.some((l) => l.id === focusId) ? focusId : null);
  const open = useMemo(() => lines.find((l) => l.id === openId) ?? null, [lines, openId]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm" aria-live="polite">
          선택 <strong className="tabular-nums">{selected.size}</strong>건
        </span>
        <div className="min-w-0 flex-1">
          <AssessButton subjectType="EXPANSION_LINES" subjectIds={[...selected].sort()} label="선택 건 판단안 만들기" aiMode={aiMode} actorRole={actorRole} disabledReason={selected.size === 0 ? '건을 선택하세요' : null} />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Switch id="show-ref" checked={showRef} onCheckedChange={setShowRef} />
          <Label htmlFor="show-ref" className="text-xs text-zinc-600">
            1.4 참고값 열 보기
          </Label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[1100px] text-sm">
          <caption className="sr-only">확대 기안 건 목록 — 기한 → 요청액 내림차순</caption>
          <thead className="bg-zinc-50 text-left text-xs text-zinc-600">
            <tr>
              <th className="p-2 font-medium">
                <span className="sr-only">선택</span>
              </th>
              <th className="p-2 font-medium">건 · 캠페인 · 인플루언서</th>
              <th className="p-2 font-medium">요청액</th>
              <th className="p-2 font-medium">집행일 · 확정기한</th>
              <th className="p-2 font-medium">권한자</th>
              <th className="p-2 font-medium">성과 (공식값 A05)</th>
              {showRef && <th className="p-2 font-medium text-zinc-500">참고: 1.4 cp</th>}
              <th className="p-2 font-medium">재고 (주력 SKU 최소 커버)</th>
              <th className="p-2 font-medium">플래그</th>
              <th className="p-2 font-medium">상태 · 권고</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} id={`line-${l.id}`} className={cn('scroll-mt-24 border-t align-top hover:bg-zinc-50', selected.has(l.id) && 'bg-blue-50', l.id === focusId && 'ring-2 ring-blue-600 ring-inset')}>
                <td className="p-2">
                  <input type="checkbox" className="size-4" checked={selected.has(l.id)} onChange={() => toggle(l.id)} aria-label={`${l.id} 선택`} />
                </td>
                <td className="p-2">
                  <button type="button" onClick={() => setOpenId(l.id)} className="text-left font-mono font-semibold underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                    {l.id}
                  </button>
                  <div className="text-xs text-zinc-700">
                    {l.campaignId} {l.campaignName}
                  </div>
                  <div className="text-xs text-zinc-600">
                    {l.influencerName} ({l.influencerId}) · {l.productLine}
                  </div>
                </td>
                <td className="p-2">
                  <MoneyValue m={l.requested} />
                </td>
                <td className="p-2 text-xs">
                  <div className="flex items-center gap-1">
                    집행 <span className="tabular-nums">{l.settlementDate}</span>
                    {l.flags.includes('SETTLEMENT_BEFORE_DEADLINE') && (
                      <span title="집행일이 확정기한보다 앞섬 — 결정 필요 시점을 앞당겨 표시 (A-26, G-11)">
                        <CalendarClock className="size-3.5 text-amber-700" aria-label="집행일 < 확정기한" />
                      </span>
                    )}
                  </div>
                  <div className="mt-1">
                    <DeadlineChip date={l.contractDeadline} daysLeft={l.daysLeft} level={l.level} />
                  </div>
                  {l.decisionNeededBy !== l.contractDeadline && <div className="mt-1 text-amber-800">결정 필요 {l.decisionNeededBy} (A-26)</div>}
                </td>
                <td className="p-2">
                  {l.routing ? (
                    <div className="space-y-1">
                      {l.routing.previousRole ? <RoleChange from={l.routing.previousRole} to={l.routing.requiredRole} /> : <RoleChip role={l.routing.requiredRole} />}
                      {l.routing.alsoReportTo.length > 0 && <div className="text-[11px] text-zinc-600">+ 그룹 보고</div>}
                      <div className="font-mono text-[11px] text-zinc-600">{[...new Set(l.routing.reasons.map((r) => r.ruleId))].join(' ')}</div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">미판정</span>
                  )}
                </td>
                <td className="p-2">
                  {l.grade && (
                    <span className={cn('mb-1 inline-flex h-5 items-center rounded-full px-1.5 text-[11px] font-medium ring-1', l.grade === 'CP_NEGATIVE' ? 'bg-red-50 text-red-800 ring-red-300' : 'bg-emerald-50 text-emerald-900 ring-emerald-300')}>
                      {l.grade === 'CP_NEGATIVE' ? '음수 · 부결 권고' : '양수'}
                    </span>
                  )}
                  {l.cp && <MoneyValue m={l.cp} className="text-xs" />}
                  {l.flags.includes('CP_REF_SIGN_DIFFERS') && (
                    <div className="mt-1">
                      <ReferenceChip />
                    </div>
                  )}
                </td>
                {showRef && <td className="p-2 text-zinc-500">{l.cpRefDef14 && <MoneyValue m={l.cpRefDef14} className="text-xs opacity-80" />}</td>}
                <td className="p-2">
                  {l.minCover ? <NumValue n={l.minCover} format="weeks" danger={l.flags.includes('INVENTORY_BELOW_MIN')} /> : <span className="text-xs text-muted-foreground">-</span>}
                  {l.flags.includes('STOCKOUT_BEFORE_SETTLEMENT') && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-red-800">
                      <PackageX className="size-3.5" aria-hidden /> 집행일 전 품절
                    </div>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex max-w-56 flex-wrap gap-1">
                    {l.flags
                      .filter((f) => f !== 'CP_POSITIVE' && f !== 'CP_NEGATIVE' && f !== 'CP_REF_SIGN_DIFFERS')
                      .map((f) => (
                        <FlagChip key={f} flag={f} />
                      ))}
                  </div>
                </td>
                <td className="p-2">
                  <LineStatusBadge status={l.status} />
                  {l.approvalRequestId && (
                    <div className="mt-1 text-xs">
                      <Link href={`/approvals/${l.approvalRequestId}`} className="font-mono underline">
                        {l.approvalRequestId}
                      </Link>
                      {approvals[l.approvalRequestId] && (
                        <span className="text-zinc-600">
                          {' '}
                          v{approvals[l.approvalRequestId]!.version} · {approvals[l.approvalRequestId]!.statusText}
                        </span>
                      )}
                      {approvals[l.approvalRequestId]?.supersedesId && (
                        <div className="font-medium text-red-900">
                          재승인 필요 → 재상신됨 (v{approvals[l.approvalRequestId]!.version}, {approvals[l.approvalRequestId]!.supersedesId} 대체)
                        </div>
                      )}
                    </div>
                  )}
                  {l.recommendation && (
                    <div className={cn('mt-1 text-xs font-medium', l.recommendation.decision === 'REJECT' ? 'text-red-800' : l.recommendation.decision === 'CONDITIONAL' ? 'text-amber-800' : 'text-emerald-800')}>
                      권고 {decisionText(l.recommendation.decision)}
                    </div>
                  )}
                  {assessments[l.id]?.[0] && (
                    <div className="mt-1 text-[11px] text-zinc-700">
                      판단안{' '}
                      <Link href={`/assessments/${assessments[l.id]![0]!.id}`} className="font-mono underline">
                        {assessments[l.id]![0]!.id}
                      </Link>{' '}
                      v{assessments[l.id]![0]!.version}
                    </div>
                  )}
                  {l.hasPostDeadlineReport && <div className="mt-1 text-[11px] text-red-800">사후 보고 작업</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {open && <LineDrawer l={open} assessments={assessments[open.id] ?? []} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LineDrawer({ l, assessments }: { l: LineView; assessments: LineAssessmentRef[] }) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {l.id} · {l.campaignName}
        </SheetTitle>
        <SheetDescription>
          {l.influencerName} ({l.influencerId}) · {l.productLine} · 집행 {l.settlementDate} · 확정기한 {l.contractDeadline}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-6 text-sm">
        {l.recommendation && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
            <p className="font-semibold text-blue-950">
              규칙 기반 권고: {decisionText(l.recommendation.decision)} <span className="font-mono text-xs font-normal">{l.recommendation.ruleIds.join(' ')}</span>
            </p>
            <ul className="mt-1 list-disc pl-5 text-xs text-blue-950">
              {l.recommendation.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {l.recommendation.condition && <p className="mt-1 text-xs">조건: {l.recommendation.condition}</p>}
          </div>
        )}

        {l.routing && (
          <section aria-label="권한 판정">
            <h4 className="mb-1 font-semibold">권한자</h4>
            {l.routing.previousRole ? <RoleChange from={l.routing.previousRole} to={l.routing.requiredRole} /> : <RoleChip role={l.routing.requiredRole} />}
            <ul className="mt-1 space-y-0.5 text-xs">
              {l.routing.reasons.map((r) => (
                <li key={r.ruleId + r.text}>
                  <span className="font-mono">{r.ruleId}</span> {r.text}
                </li>
              ))}
            </ul>
            {l.routing.changeReason && <p className="mt-1 text-xs text-red-800">변경 사유: {l.routing.changeReason}</p>}
          </section>
        )}

        {l.inCovenantWindow && (
          <p className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            covenant 대조: 집행일 {l.settlementDate} ∈ 하회 예상 구간 {l.inCovenantWindow.window.start} ~ {l.inCovenantWindow.window.end} → 그룹 CEO/이사회 (R-AUTH-03)
          </p>
        )}

        <section aria-label="비용 분해">
          <h4 className="mb-1 font-semibold">
            확대 대상 캠페인 비용 분해 <span className="text-xs font-normal text-muted-foreground">(표본 — 방향 · 순위까지)</span>
          </h4>
          <CostTable steps={l.costSteps} />
          <p className="mt-1 text-xs text-muted-foreground">공식값 = A05(v1.5) 5절 단일 차감. 물류 추가비용 · CS 비용은 원본 없음 — 미포함 (G-07).</p>
          <ReferenceFold className="mt-2">
            <CostTable steps={l.refCostSteps} reference />
          </ReferenceFold>
        </section>

        <section aria-label="주력 SKU 재고">
          <h4 className="mb-1 font-semibold">주력 SKU 재고 (풀스케일, A-16 GMV 비중 ≥ 20%)</h4>
          {l.inventory.length === 0 ? (
            <p className="text-xs text-muted-foreground">주력 SKU 없음</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-left text-zinc-600">
                <tr className="border-b">
                  <th className="py-1 pr-2 font-medium">SKU</th>
                  <th className="py-1 pr-2 font-medium">비중</th>
                  <th className="py-1 pr-2 font-medium">커버</th>
                  <th className="py-1 pr-2 font-medium">예상 품절</th>
                  <th className="py-1 pr-2 font-medium">지금 발주 시 도착</th>
                </tr>
              </thead>
              <tbody>
                {l.inventory.map((k) => (
                  <tr key={k.skuId} className={cn('border-b last:border-0', k.belowMin && 'bg-red-50')}>
                    <td className="py-1 pr-2">
                      {k.skuId} <span className="text-zinc-600">{k.name}</span>
                    </td>
                    <td className="py-1 pr-2">
                      <NumValue n={k.share} format="pct" />
                    </td>
                    <td className="py-1 pr-2">
                      <NumValue n={k.coverWeeks} format="weeks" danger={k.belowMin} />
                      <span className="text-zinc-500"> / min {k.minWeeks}주</span>
                    </td>
                    <td className="py-1 pr-2 tabular-nums">{k.stockoutDate ?? '-'}</td>
                    <td className={cn('py-1 pr-2 tabular-nums', k.stockoutBeforeSettlement && 'font-semibold text-red-800')}>{k.arrivalIfOrderedNow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <ClaimsFold title="주장 · 참고 — 기안 예상 GMV">
          <p className="flex flex-wrap items-center gap-2">
            예상 GMV <MoneyValue m={l.expectedGmv} claimArea />
          </p>
          <p className="text-xs text-purple-900">기안 예상 GMV 는 쿠폰 · 반품 · 비용 차감 전 금액으로 승인 근거가 될 수 없습니다 (정책).</p>
        </ClaimsFold>

        <div className="text-xs" data-testid="line-assessments">
          <h4 className="mb-1 font-semibold">이 건의 판단안 ({assessments.length})</h4>
          {assessments.length === 0 ? (
            <p className="text-zinc-600">아직 없음 — 표에서 건을 선택해 [선택 건 판단안 만들기]</p>
          ) : (
            <ul className="space-y-0.5">
              {assessments.map((a, i) => (
                <li key={a.id} className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/assessments/${a.id}`} className="font-mono underline">
                    {a.id}
                  </Link>
                  <span>v{a.version}</span>
                  {a.decision && <span>· 이 건 권고 {decisionText(a.decision)}</span>}
                  {a.mock && <span className="rounded border border-dashed border-zinc-500 px-1">모의</span>}
                  {i === 0 && assessments.length > 1 && <span className="text-zinc-600">(최신)</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs">
          연결:{' '}
          {l.approvalRequestId ? (
            <Link href={`/approvals/${l.approvalRequestId}`} className="underline">
              승인요청 {l.approvalRequestId}
            </Link>
          ) : (
            '승인요청 없음'
          )}{' '}
          ·{' '}
          <Link href={`/history?entityId=${l.id}`} className="underline">
            이 건의 처리 이력
          </Link>
        </p>
      </div>
    </>
  );
}

function CostTable({ steps, reference = false }: { steps: LineView['costSteps']; reference?: boolean }) {
  return (
    <table className="w-full text-xs">
      <tbody>
        {steps.map((s) => (
          <tr key={s.key} className={cn('border-b last:border-0', s.sign === '=' && 'font-semibold', reference && s.key.endsWith('2') && 'bg-zinc-200/60')}>
            <td className="w-6 py-1 text-center font-mono" aria-hidden>
              {s.sign}
            </td>
            <td className="py-1 pr-2">
              {s.name}
              {reference && s.key.endsWith('2') && <span className="ml-1 rounded bg-zinc-600 px-1 text-[10px] text-white">이중 차감 (참고값)</span>}
            </td>
            <td className="py-1 text-right">
              <MoneyValue m={s.amount} className="justify-end" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
