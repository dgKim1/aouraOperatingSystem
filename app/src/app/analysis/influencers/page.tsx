/** S-08 인플루언서 성과 순위 — "배분이 성과를 따라가는가" (집행 비중 순위 vs 실질 공헌이익 순위) */
import Link from 'next/link';
import { SourceBadgeStatic } from '@/components/badges/source-badge';
import { ClaimsFold } from '@/components/badges/fold';
import { MoneyValue, NumValue, UnknownChip } from '@/components/badges/values';
import { RoasBars } from '@/components/charts/roas-bars';
import { SlopeChart } from '@/components/charts/slope-chart';
import { PageHeader, Section } from '@/components/common';
import { SampleNotice } from '@/components/perf-summary';
import { cn } from '@/lib/utils';
import { getInfluencerRows } from '../../_data/views';
import { CLAIMS_FOR_PERF } from './claims';

type SP = Record<string, string | string[] | undefined>;

export default async function InfluencersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const includeRef = sp.ref === '1';
  const { rows, totals, remaining } = await getInfluencerRows(includeRef);
  const sorted = [...rows].sort((a, b) => a.adSpendRank - b.adSpendRank);
  // 강조 대상: 집행 비중 상위 2명 (표시 선택일 뿐 판정 아님)
  const highlight = sorted.slice(0, 2).map((r) => r.influencerId);

  return (
    <div className="space-y-4">
      <PageHeader id="S-08" title="인플루언서 성과 순위" decision="다음 기안 · 전속계약 판단에서 예산 배분이 실질 성과(공식값)를 따라가는지 확인합니다." />
      <SampleNotice />

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="집행 비중 순위 vs 실질 공헌이익(공식값) 순위" id="slope">
          <SlopeChart
            rows={rows.map((r) => ({ id: r.influencerId, name: r.name, left: r.adSpendRank, right: r.cpRank }))}
            leftTitle="집행 비중 순위"
            rightTitle="실질 공헌이익 순위 (A05)"
            highlight={highlight}
            caption="왼쪽 = 광고비 집행 비중 순위, 오른쪽 = 공식 cp 순위. 집행 비중 상위 2명 강조. 참고값(1.4)은 차트에 넣지 않음."
          />
        </Section>
        <Section title="명목 ROAS vs 실질 ROAS (공식)" id="roas">
          <RoasBars rows={sorted.map((r) => ({ id: r.influencerId, name: r.name, nominal: r.nominalRoas?.value ?? null, real: r.realRoas?.value ?? null }))} caption="집행 비중 순으로 정렬. 비율 축(배수) — 금액 축 아님." />
        </Section>
      </div>

      <Section
        title="인플루언서별 실질 성과 (표본)"
        id="table"
        actions={
          <Link
            href={includeRef ? '/analysis/influencers' : '/analysis/influencers?ref=1'}
            role="switch"
            aria-checked={includeRef}
            className="inline-flex items-center gap-2 text-xs text-zinc-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className={cn('relative inline-block h-4 w-7 rounded-full transition-colors', includeRef ? 'bg-zinc-700' : 'bg-zinc-300')}>
              <span className={cn('absolute top-0.5 size-3 rounded-full bg-white transition-all', includeRef ? 'left-3.5' : 'left-0.5')} />
            </span>
            참고값 보기 (1.4 문자 그대로)
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <caption className="sr-only">인플루언서별 집행 비중 · 요청 비중 · 실질 공헌이익(공식값) · ROAS · 반품률 — 순위는 공식값 기준</caption>
            <thead className="text-left text-xs text-zinc-600">
              <tr className="border-b">
                <th className="p-2 font-medium">인플루언서</th>
                <th className="p-2 font-medium">집행 비중 (순위)</th>
                <th className="p-2 font-medium">요청 비중 (순위)</th>
                {remaining && <th className="p-2 font-medium">남은 기안 요청 비중</th>}
                <th className="p-2 font-medium">GMV</th>
                <th className="p-2 font-medium">Marketing Spend</th>
                <th className="p-2 font-medium">cp 공식값 (순위)</th>
                <th className="p-2 font-medium">명목 ROAS</th>
                <th className="p-2 font-medium">실질 ROAS (순위)</th>
                <th className="p-2 font-medium">반품률</th>
                {includeRef && <th className="p-2 font-medium text-zinc-500">참고 cp (1.4)</th>}
                {includeRef && <th className="p-2 font-medium text-zinc-500">참고 실질 ROAS</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.influencerId} className={cn('border-b align-top last:border-0', highlight.includes(r.influencerId) && 'bg-red-50/50')}>
                  <td className="p-2">
                    <span className="font-medium">{r.name}</span> <span className="text-xs text-zinc-600">{r.influencerId}</span>
                    {r.refSignDiffers && <div className="text-[11px] text-zinc-500">참고: 1.4 값 부호 다름</div>}
                  </td>
                  <td className="p-2">
                    <NumValue n={r.adSpendShare} format="pct2" /> <span className="text-xs">({r.adSpendRank})</span>
                  </td>
                  <td className="p-2">
                    <NumValue n={r.requestShare} format="pct" /> <span className="text-xs">({r.requestRank})</span>
                  </td>
                  {remaining && (
                    <td className="p-2">
                      <NumValue n={remaining.shares[r.influencerId] ?? null} format="pct" />
                    </td>
                  )}
                  <td className="p-2">
                    <MoneyValue m={r.gmv} />
                  </td>
                  <td className="p-2">
                    <MoneyValue m={r.spend} />
                  </td>
                  <td className="p-2">
                    <MoneyValue m={r.cp} strong /> <span className="text-xs font-semibold">({r.cpRank})</span>
                  </td>
                  <td className="p-2">
                    <NumValue n={r.nominalRoas} format="dec2" />
                  </td>
                  <td className="p-2">
                    <NumValue n={r.realRoas} format="dec3" /> <span className="text-xs">({r.realRoasRank})</span>
                  </td>
                  <td className="p-2">
                    <NumValue n={r.returnRate} format="pct2" />
                  </td>
                  {includeRef && <td className="p-2 text-zinc-500">{r.cpRefDef14 && <MoneyValue m={r.cpRefDef14} className="opacity-80" />}</td>}
                  {includeRef && (
                    <td className="p-2 text-zinc-500">
                      <NumValue n={r.realRoasRefDef14 ?? null} format="dec3" className="opacity-80" />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-medium">
                <td className="p-2">합계 (표본 전체)</td>
                <td className="p-2" />
                <td className="p-2" />
                {remaining && (
                  <td className="p-2">
                    <MoneyValue m={remaining.total} />
                  </td>
                )}
                <td className="p-2">
                  <MoneyValue m={totals.gmv} />
                </td>
                <td className="p-2">
                  <MoneyValue m={totals.spend} />
                </td>
                <td className="p-2">
                  <MoneyValue m={totals.cp} />
                </td>
                <td className="p-2">
                  <NumValue n={totals.nominalRoas} format="dec2" />
                </td>
                <td className="p-2">
                  <NumValue n={totals.realRoas} format="dec3" />
                </td>
                <td className="p-2" />
                {includeRef && <td className="p-2" />}
                {includeRef && <td className="p-2" />}
              </tr>
            </tfoot>
          </table>
        </div>
        {remaining && <p className="mt-2 text-xs text-blue-900">「남은 기안 요청 비중」: 부결 · 취소 건을 뺀 남은 기안 기준 (R-CP-06, 다음 판단 반영). 권한 판정용 기안 총액은 바뀌지 않습니다.</p>}
      </Section>

      <Section title="공헌이익 정의 (공식값)" id="def">
        <div className="space-y-2 text-sm text-zinc-800">
          <p>
            공식값은 A05(v1.5) 5절 단일 차감 — Net Revenue(GMV − 반품환불)에서 원가 · 마케팅비 · 채널수수료 · 출고/반품 물류비를 각 한 번씩 뺌. 근거: A05 1절 · A01 4절 · 8절(구판 문서 · 원본 별첨과 충돌하면 A05 우선).
            calculation_definitions 1.4 를 문자 그대로 적용하면 쿠폰 · 환불이 두 번 빠지며, 이 값은 참고로만 보여줌. 참고값으로도 INF-001 · INF-005 는 하위이고, INF-003 · INF-007 은 참고값에서만 음수.
          </p>
          <p className="flex flex-wrap items-center gap-1 text-xs">
            비용 가정 {['A-01', 'A-02', 'A-03', 'A-04', 'A-05', 'A-06'].map((a) => (
              <Link key={a} href={`/data?tab=assumptions#${a}`} className="inline-flex items-center gap-1 underline">
                <SourceBadgeStatic label="ASSUMPTION" />
                {a}
              </Link>
            ))}
          </p>
          <p className="flex flex-wrap items-center gap-2 text-xs">
            공헌이익에 없는 것: 물류 추가비용 · CS 비용 <span className="rounded border border-zinc-400 bg-zinc-50 px-1.5">미포함(원본 없음)</span> <UnknownChip gapId="G-07" />
          </p>
        </div>
      </Section>

      <ClaimsFold title="주장 · 참고 — 회의록">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {CLAIMS_FOR_PERF.map((c) => (
            <li key={c.text}>
              {c.text} <span className="text-xs text-purple-800">({c.file})</span>
            </li>
          ))}
        </ul>
      </ClaimsFold>
    </div>
  );
}
