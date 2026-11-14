/** S-10 자금 재전망 · covenant — 하회 예상 구간을 특정해 승인 주체를 정하고, 재무팀 공식 전망(주장)과 대조 */
import Link from 'next/link';
import { ClaimsFold } from '@/components/badges/fold';
import { MoneyValue, UnknownChip } from '@/components/badges/values';
import { CashLine } from '@/components/charts/cash-line';
import { InlineWarning } from '@/components/alerts/alert-item';
import { PageHeader, RoleChip, Section, StubNotice } from '@/components/common';
import { getCash } from '../../_data/views';

export default async function CashPage() {
  const v = await getCash();
  const changed = v.current.id !== v.v1.id;
  const fmtW = (ws: { start: string; end: string }[]) => (ws.length ? ws.map((w) => `${w.start} ~ ${w.end}`).join(', ') : '없음');
  return (
    <div className="space-y-4">
      <PageHeader id="S-10" title="자금 재전망 · covenant" decision="covenant(매 영업일 30억) 하회 예상 구간을 확인해, 그 구간에 현금이 나가는 기안 · 발주의 승인 주체(그룹 CEO/이사회)를 정합니다." />
      <InlineWarning tone="info">기안 요청액(표본)은 이 전망에 포함하지 않음 — 마케팅 축소는 자금 해법이 아님(회의록). 시점 대조의 목적은 승인 주체와 순서. 고정 피 지급 일정 미확인 <UnknownChip gapId="G-09" /></InlineWarning>

      <Section title={`일별 종가 — ${v.current.id}${changed ? ` (이전 ${v.v1.id} 와 비교)` : ''}`} id="chart">
        <CashLine daily={v.current.daily} priorDaily={changed ? v.v1.daily : undefined} covenant={v.covenant.value} windows={v.current.windows} priorWindows={changed ? v.v1.windows : undefined} caption="풀스케일 금액만 · 영업일 기준 (A-08 · A-09)" />
        <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-zinc-600">기초 잔액 (6/30)</dt>
          <dd><MoneyValue m={v.current.opening} /></dd>
          <dt className="text-zinc-600">covenant 기준</dt>
          <dd><MoneyValue m={v.covenant} /></dd>
          <dt className="text-zinc-600">하회 예상 구간</dt>
          <dd>
            <strong className="text-red-800">{fmtW(v.current.windows)}</strong> ({v.current.id})
            {changed && <span className="ml-2 text-xs text-zinc-600">이전 {v.v1.id}: {fmtW(v.v1.windows)}</span>}
          </dd>
          <dt className="text-zinc-600">최저 종가</dt>
          <dd><MoneyValue m={v.current.min} /> @ {v.current.minDate}</dd>
          <dt className="text-zinc-600">차이 원인</dt>
          <dd className="flex flex-wrap items-center gap-1">7/21 기발주 대금 일괄 지급 <MoneyValue m={v.poPayment} /></dd>
          {v.overrides.length > 0 && (
            <>
              <dt className="text-zinc-600">조건 변경 (모의)</dt>
              <dd>{v.overrides.map((o) => `${o.ar} 회수일 → ${o.date}`).join(', ')}</dd>
            </>
          )}
        </dl>
      </Section>

      <Section title={`하회 구간에 집행일이 걸린 기안 (${v.linesInWindow.length}건)`} id="lines">
        {v.linesInWindow.length === 0 ? (
          <p className="text-sm text-muted-foreground">기안 미접수 또는 해당 건 없음</p>
        ) : (
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {v.linesInWindow.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/proposals/PROP-2026-07?q=${l.id}`} className="font-mono underline">{l.id}</Link>
                집행 {l.settlementDate} {l.role && <RoleChip role={l.role} />} <span className="text-xs text-zinc-600">{l.status}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <ClaimsFold title="주장 · 참고 — 재무팀 공식 전망 (fin_cash_forecast_ms)">
        <p className="text-xs text-purple-900">공식 전망은 하회가 없지만 7/21 발주대금 유출이 반영되지 않은 것으로 보입니다 (원인 확정은 미확인). 판단 근거로 쓰지 않습니다.</p>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-600">
            <tr className="border-b"><th className="p-1 font-medium">주</th><th className="p-1 font-medium">예상 종가</th></tr>
          </thead>
          <tbody>
            {v.official.map((o) => (
              <tr key={o.week} className="border-b last:border-0">
                <td className="p-1 font-mono text-xs">{o.week}</td>
                <td className="p-1"><MoneyValue m={o.closing} claimArea /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </ClaimsFold>
      <StubNotice>민감도 토글(A-08) · 재전망 버전 선택 · 추가 유출 시나리오(보충 발주)는 2단계 API(GET /api/analytics/cash?version=&sensitivity=) 연결 후.</StubNotice>
    </div>
  );
}
