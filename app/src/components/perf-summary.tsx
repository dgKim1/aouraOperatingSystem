/** 인플루언서 성과 요약 (표본, 방향만) — S-03 성과 근거 탭 · S-08 공용 */
import type { InfluencerPerfRow } from '@/domain/api-types';
import { NumValue, MoneyValue } from './badges/values';
import { ReferenceFold } from './badges/fold';

export function SampleNotice() {
  return (
    <p className="rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950" role="note">
      표본(대표 표본) 기준 — 비중 · 순위 · 방향까지. 연간 계획치 · 28억(풀스케일)과 더하거나 곱하지 않음 <span className="text-xs font-normal">(data_dictionary 6항, R-SCALE-01)</span>
    </p>
  );
}

export function PerfSummary({ p, refRow }: { p: InfluencerPerfRow; refRow?: InfluencerPerfRow | undefined }) {
  return (
    <div className="space-y-3">
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[12rem_1fr]">
        <dt className="text-zinc-600">집행 비중 (광고비 전액)</dt>
        <dd className="flex items-center gap-2">
          <NumValue n={p.adSpendShare} format="pct2" /> <span className="text-xs">({p.adSpendRank}위 / 10)</span>
        </dd>
        <dt className="text-zinc-600">기안 요청 비중</dt>
        <dd className="flex items-center gap-2">
          <NumValue n={p.requestShare} format="pct" /> <span className="text-xs">({p.requestRank}위 / 10)</span>
        </dd>
        <dt className="text-zinc-600">실질 공헌이익 (공식값 A05)</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <MoneyValue m={p.cp} strong /> <span className="text-xs font-semibold">순위 {p.cpRank}위 / 10</span>
        </dd>
        <dt className="text-zinc-600">명목 ROAS vs 실질 ROAS</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <NumValue n={p.nominalRoas} format="dec2" /> <span aria-hidden>vs</span> <NumValue n={p.realRoas} format="dec3" />
          <span className="text-xs">(실질 {p.realRoasRank}위)</span>
        </dd>
        <dt className="text-zinc-600">반품률 (금액)</dt>
        <dd>
          <NumValue n={p.returnRate} format="pct2" />
        </dd>
      </dl>
      {refRow?.cpRefDef14 && (
        <ReferenceFold>
          <p className="flex flex-wrap items-center gap-2">
            cp (1.4 문자 그대로) <MoneyValue m={refRow.cpRefDef14} /> · 실질 ROAS (참고) <NumValue n={refRow.realRoasRefDef14 ?? null} format="dec3" />
          </p>
        </ReferenceFold>
      )}
    </div>
  );
}
