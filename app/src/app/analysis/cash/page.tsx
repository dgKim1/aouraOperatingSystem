/**
 * S-10 자금 재전망 · covenant — 하회 예상 구간을 특정해 승인 주체를 정하고, 재무팀 공식 전망(주장)과 한 차트 · 한 비교표로 대조한다(FE-06).
 * 판단(권한 · 하회 구간 · 경고 · 권고)은 재전망만 쓴다. 공식 전망 숫자는 차트 · 비교표에만 `주장` 배지와 함께 둔다(UI-03).
 * 값은 GET /api/analytics/cash 응답 그대로. "② 이후 변경"은 서버의 changedFromV1 · v1Recalculated · v1BelowDays, 차이 설명은 diffNotesSourced,
 * 재전망 입력 표는 cashEvents(포함 · 제외 사유 · 원본 파일/행)를 그대로 쓴다 — 화면에서 v1 을 다시 조회해 비교하지 않는다.
 */
import Link from 'next/link';
import { InlineWarning } from '@/components/alerts/alert-item';
import { SourceBadgeStatic } from '@/components/badges/source-badge';
import { MoneyValue, TextValue, UnknownChip } from '@/components/badges/values';
import { CashLine } from '@/components/charts/cash-line';
import { PageHeader, RoleChip, Section } from '@/components/common';
import type { CashEventRowView, CashRunView } from '@/domain/api-types';
import { cn } from '@/lib/utils';
import { getCash } from '../../_data/views';

type SP = Record<string, string | string[] | undefined>;

const fmtW = (ws: { start: string; end: string }[]) => (ws.length ? ws.map((w) => `${w.start} ~ ${w.end}`).join(', ') : '없음');

function RunSummary({ r, title }: { r: CashRunView; title: string }) {
  return (
    <div className="rounded border p-2 text-sm">
      <p className="text-xs font-semibold">{title}</p>
      <p>
        하회 구간 <strong className="text-red-800">{fmtW(r.windows)}</strong> · {r.businessDays}영업일 <SourceBadgeStatic label="AGGREGATED" />
      </p>
      <p className="flex flex-wrap items-center gap-1">
        최저 <MoneyValue m={r.min} /> @ {r.minDate}
      </p>
      {r.assumptionIds.length > 0 && <p className="text-xs text-zinc-600">가정 {r.assumptionIds.join(' · ')}</p>}
    </div>
  );
}

export default async function CashPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sensitivity = sp.sensitivity === '1';
  const v = await getCash({ version: 'current', sensitivity });
  const changed = v.current.id !== v.v1.id;

  return (
    <div className="space-y-4">
      <PageHeader id="S-10" title="자금 재전망 · covenant" decision="covenant(매 영업일 30억) 하회 예상 구간을 확인해, 그 구간에 현금이 나가는 기안 · 발주의 승인 주체(그룹 CEO/이사회)를 정합니다. 재무팀 공식 전망(주장)과의 차이도 함께 봅니다." />
      <InlineWarning tone="info">
        기안 요청액(표본)은 이 전망에 포함하지 않음 — 마케팅 축소는 자금 해법이 아님(회의록), 시점 대조의 목적은 승인 주체와 순서 · 고정 피 지급 일정 미확인 <UnknownChip gapId="G-09" /> · 공식 전망은 대조용(주장) — 승인 권한 · 경고 판단에는 재전망만 사용
      </InlineWarning>

      <Section title={`일별 종가 — 현재 ${v.current.id}${changed ? ` · 이전 ${v.v1.id} 겹쳐 보기` : ''} · 공식 전망(주장) 대조`} id="chart">
        <CashLine
          daily={v.current.daily}
          currentId={v.current.id}
          priorDaily={changed ? v.v1.daily : undefined}
          priorId={v.v1.id}
          covenant={v.covenant.value}
          windows={v.current.windows}
          priorWindows={changed ? v.v1.windows : undefined}
          official={v.official}
          caption="풀스케일 현금 잔액만 · 영업일 기준 (A-08 · A-09) · 공식 전망 점은 week 월요일 (A-32)"
        />
        <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-zinc-600">기초 잔액 (6/30)</dt>
          <dd>
            <MoneyValue m={v.current.opening} />
          </dd>
          <dt className="text-zinc-600">covenant 기준</dt>
          <dd>
            <MoneyValue m={v.covenant} />
          </dd>
          <dt className="text-zinc-600">하회 예상 구간</dt>
          <dd>
            <strong className="text-red-800">{fmtW(v.current.windows)}</strong> ({v.current.id} · {v.current.businessDays}영업일) <SourceBadgeStatic label="AGGREGATED" />
            {changed && (
              <span className="ml-2 text-xs text-zinc-600">
                이전 {v.v1.id}: {fmtW(v.v1.windows)} ({v.v1.businessDays}영업일)
              </span>
            )}
          </dd>
          <dt className="text-zinc-600">최저 종가</dt>
          <dd className="flex flex-wrap items-center gap-1">
            <MoneyValue m={v.current.min} /> @ {v.current.minDate}
          </dd>
          <dt className="text-zinc-600">하회 시작 원인</dt>
          <dd className="flex flex-wrap items-center gap-1">
            7/21 기발주 대금 일괄 지급 <MoneyValue m={v.poPayment} />
          </dd>
          {v.overrides.length > 0 && (
            <>
              <dt className="text-zinc-600">조건 변경</dt>
              <dd className="flex flex-wrap items-center gap-1">
                {v.overrides.map((o) => `${o.ar} 회수일 → ${o.date}`).join(', ')} <SourceBadgeStatic label="MOCK" />
              </dd>
            </>
          )}
        </dl>
      </Section>

      <Section title={`공식 전망(주장) 대 재전망 비교 — ${v.compareVersion} 기준 · ${v.officialComparison.length}주`} id="cmp">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <caption className="sr-only">재무팀 공식 전망 주간 종가(주장)와 재전망 해당 주 종가(집계) 대조. 최대 차이 주 강조.</caption>
            <thead className="text-left text-xs text-zinc-600">
              <tr className="border-b">
                <th className="p-2 font-medium">
                  주차 (대응 기간) <SourceBadgeStatic label="ASSUMPTION" /> <span className="font-normal">A-32</span>
                </th>
                <th className="p-2 font-medium">
                  공식 전망 종가 <SourceBadgeStatic label="CLAIM" />
                </th>
                <th className="p-2 font-medium">
                  재전망 {v.compareVersion} 해당 주 종가 <SourceBadgeStatic label="AGGREGATED" />
                </th>
                <th className="p-2 font-medium">차이 (재전망 − 공식)</th>
                <th className="p-2 font-medium">30억 하회 (재전망 기준)</th>
              </tr>
            </thead>
            <tbody>
              {v.officialComparison.map((r) => {
                const largest = v.largestGap?.week === r.week;
                const chg = r.changedFromV1;
                return (
                  <tr key={r.week} className={cn('border-b align-top last:border-0', largest && 'bg-amber-50 font-semibold ring-2 ring-amber-500 ring-inset', r.belowThreshold && !largest && 'bg-red-50/50')}>
                    <td className="p-2">
                      <span className="font-mono">{r.week}</span>
                      <div className="text-xs font-normal text-zinc-600">
                        {r.periodStart} ~ {r.periodEnd}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {largest && <span className="inline-flex h-5 items-center rounded-full bg-amber-600 px-1.5 text-[11px] text-white">최대 차이</span>}
                        {chg && <span className="inline-flex h-5 items-center rounded-full bg-blue-700 px-1.5 text-[11px] font-normal text-white">② 이후 변경</span>}
                      </div>
                    </td>
                    <td className="p-2">
                      <MoneyValue m={r.official} claimArea />
                    </td>
                    <td className="p-2">
                      <MoneyValue m={r.recalculated} strong={largest} />
                      {chg && r.v1Recalculated && (
                        <div className="text-xs font-normal text-zinc-600">
                          이전 {v.v1.id}: <MoneyValue m={r.v1Recalculated} hideScale className="line-through decoration-zinc-400" />
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <MoneyValue m={r.diff} strong={largest} />
                    </td>
                    <td className="p-2">
                      {r.belowThreshold ? <strong className="text-red-800">하회 {r.belowDays}영업일</strong> : <span className="text-zinc-600">없음</span>}
                      {chg && r.v1BelowDays !== null && <div className="text-xs font-normal text-zinc-600">이전 {v.v1.id}: {r.v1BelowDays > 0 ? `하회 ${r.v1BelowDays}영업일` : '없음'}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {v.largestGap && (
          <div className="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              최대 차이 주 {v.largestGap.week} <MoneyValue m={v.largestGap.diff} />
            </p>
            <p className="mt-1 text-xs font-semibold text-amber-900">원인 메모 — 추정 · 원인 미확인</p>
            <ul className="mt-1 space-y-1">
              {v.largestGap.notes.map((n) => (
                <li key={n.value}>
                  <TextValue t={n} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {v.diffNotesSourced.length > 0 && (
          <div className="mt-3">
            <h4 className="mb-1 text-xs font-semibold">공식 전망과 다른 이유 (출처별 — 원인 추정은 원본근거해석)</h4>
            <ul className="space-y-1 text-xs">
              {v.diffNotesSourced.map((n, i) => (
                <li key={i}>
                  <TextValue t={n} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title={`재전망 입력 — 현금 유입 · 유출 (${v.current.id} · 포함 ${v.cashEvents.filter((e) => e.included).length}건 · 제외 ${v.cashEvents.filter((e) => !e.included).length}건)`} id="events">
        <CashEvents rows={v.cashEvents} />
      </Section>

      <Section title={`하회 구간에 집행일이 걸린 기안 (${v.linesInWindow.length}건)`} id="lines">
        {v.linesInWindow.length === 0 ? (
          <p className="text-sm text-muted-foreground">기안 미접수 또는 해당 건 없음</p>
        ) : (
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {v.linesInWindow.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/proposals/PROP-2026-07?q=${l.id}`} className="font-mono underline">
                  {l.id}
                </Link>
                집행 {l.settlementDate} {l.role && <RoleChip role={l.role} />} <span className="text-xs text-zinc-600">{l.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="민감도 · 추가 유출 (선택)"
        id="extra"
        actions={
          <Link href={sensitivity ? '/analysis/cash' : '/analysis/cash?sensitivity=1'} className="text-xs underline" aria-pressed={sensitivity}>
            {sensitivity ? '민감도 끄기' : '민감도 보기 (A-08: 연체 AR 제외 · 연체 AP 7/1 지급)'}
          </Link>
        }
      >
        <div className="grid gap-2 md:grid-cols-2">
          {v.sensitivity ? <RunSummary r={v.sensitivity} title={`민감도 ${v.sensitivity.id}`} /> : <p className="text-sm text-muted-foreground">민감도는 꺼져 있습니다.</p>}
          {v.extraOutflow ? (
            <div className="space-y-1">
              <RunSummary r={v.extraOutflow} title={`추가 유출 반영 ${v.extraOutflow.id} (원본 전망분과 분리, R-CASH-04)`} />
              <ul className="text-xs">
                {v.extraOutflow.outflows.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-1">
                    {o.id} · {o.date} <MoneyValue m={o.amount} />
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">상신 이상의 보충요청이 없어 추가 유출 시나리오가 없습니다.</p>
          )}
        </div>
      </Section>
    </div>
  );
}

const KIND_KO: Record<CashEventRowView['kind'], string> = { AR_INFLOW: 'AR 회수', AP_OUTFLOW: 'AP 지급', PO_PAYMENT: '발주 대금' };

/** S-10 이벤트 표 — 날짜 · 항목 · 금액 · 출처. 제외 행은 사유와 함께(숨기지 않음). 값은 서버 cashEvents 그대로 */
function CashEvents({ rows }: { rows: CashEventRowView[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">입력 행이 없습니다.</p>;
  const sorted = [...rows].sort((a, b) => (a.date ?? a.sourceDate).localeCompare(b.date ?? b.sourceDate) || a.id.localeCompare(b.id));
  return (
    <details open={rows.length <= 40}>
      <summary className="cursor-pointer text-xs text-zinc-700 underline underline-offset-2">표 펼치기 · 접기 ({rows.length}행) — 포함 행을 날짜별로 더하면 일별 종가가 재현됩니다</summary>
      <div className="mt-2 max-h-[28rem] overflow-auto">
        <table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">재전망에 들어간 현금 이벤트와 제외된 이벤트(사유 포함)</caption>
          <thead className="sticky top-0 bg-white text-left text-xs text-zinc-600">
            <tr className="border-b">
              <th className="p-2 font-medium">재전망 날짜</th>
              <th className="p-2 font-medium">원본 날짜</th>
              <th className="p-2 font-medium">종류 · 항목</th>
              <th className="p-2 font-medium">방향 · 금액</th>
              <th className="p-2 font-medium">출처</th>
              <th className="p-2 font-medium">포함 여부</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.id} className={cn('border-b align-top last:border-0', !e.included && 'bg-zinc-50 text-zinc-600')}>
                <td className="p-2 font-mono text-xs">{e.date ?? '—'}</td>
                <td className="p-2 font-mono text-xs">{e.sourceDate}</td>
                <td className="p-2 text-xs">
                  <span className="text-zinc-600">{KIND_KO[e.kind]}</span> {e.item}
                </td>
                <td className="p-2">
                  <span className={cn('mr-1 text-xs font-semibold', e.direction === 'IN' ? 'text-emerald-800' : 'text-red-800')}>{e.direction === 'IN' ? '유입 +' : '유출 −'}</span>
                  <MoneyValue m={e.amount} hideScale />
                </td>
                <td className="p-2 text-xs">
                  <SourceBadgeStatic label={e.label} /> <span className="font-mono text-[11px]">{e.ref.file.split('/').pop()}{e.ref.row ? ` #${e.ref.row}` : ''}</span>
                  {e.assumptionIds.length > 0 && <span className="ml-1 text-[11px]">{e.assumptionIds.join(' · ')}</span>}
                </td>
                <td className="p-2 text-xs">{e.included ? '포함' : <span>제외 — {e.excludedReason}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
