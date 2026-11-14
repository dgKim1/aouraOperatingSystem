/**
 * S-10 자금 재전망 · covenant — 하회 예상 구간을 특정해 승인 주체를 정하고, 재무팀 공식 전망(주장)과 한 차트 · 한 비교표로 대조한다(FE-06).
 * 판단(권한 · 하회 구간 · 경고 · 권고)은 재전망만 쓴다. 공식 전망 숫자는 차트 · 비교표에만 `주장` 배지와 함께 둔다(UI-03).
 * 값은 GET /api/analytics/cash 응답 그대로. "② 이후 변경" 표시는 v1 대조 응답과 현재 대조 응답의 같은 주 값이 같은지 비교만 한다.
 */
import Link from 'next/link';
import { InlineWarning } from '@/components/alerts/alert-item';
import { SourceBadgeStatic } from '@/components/badges/source-badge';
import { MoneyValue, TextValue, UnknownChip } from '@/components/badges/values';
import { CashLine } from '@/components/charts/cash-line';
import { PageHeader, RoleChip, Section } from '@/components/common';
import type { CashRunView } from '@/domain/api-types';
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
  const v1cmp = changed ? await getCash({ version: 'v1' }) : null;
  const v1ByWeek = new Map((v1cmp?.officialComparison ?? []).map((r) => [r.week, r]));
  const rowChanged = (week: string, recalculated: number, belowDays: number) => {
    const o = v1ByWeek.get(week);
    return !!o && (o.recalculated.value !== recalculated || o.belowDays !== belowDays);
  };

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
                const chg = changed && rowChanged(r.week, r.recalculated.value, r.belowDays);
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
                      {chg && v1ByWeek.get(r.week) && v1ByWeek.get(r.week)!.recalculated.value !== r.recalculated.value && (
                        <div className="text-xs font-normal text-zinc-600">
                          이전 {v.v1.id}: <MoneyValue m={v1ByWeek.get(r.week)!.recalculated} hideScale className="line-through decoration-zinc-400" />
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <MoneyValue m={r.diff} strong={largest} />
                    </td>
                    <td className="p-2">
                      {r.belowThreshold ? <strong className="text-red-800">하회 {r.belowDays}영업일</strong> : <span className="text-zinc-600">없음</span>}
                      {chg && v1ByWeek.get(r.week) && <div className="text-xs font-normal text-zinc-600">이전 {v1ByWeek.get(r.week)!.belowThreshold ? `하회 ${v1ByWeek.get(r.week)!.belowDays}영업일` : '없음'}</div>}
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
        <p className="mt-2 text-xs text-zinc-600">
          재전망은 원본 스케줄(AR · AP(po_id=&apos;NONE&apos;) · 발주)만 쓰므로 9/6 이후 예정 현금흐름이 없습니다. 공식 전망에는 매주 유입 · 유출이 있어 9월 차이에는 기준일 이후 새로 생길 거래가 섞여 있을 수 있습니다 — 원인 미확인. 주 대응 기준(week = 그 월요일에 끝나는 주)은 원본 정의가 없어 가정 A-32 입니다. 공식 전망 열은 재무팀 파일 그대로라 조건 변경 후에도 바뀌지 않습니다.
        </p>
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
