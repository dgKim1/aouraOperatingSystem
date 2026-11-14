/** S-09 재고 커버 — 확대 캠페인이 요구하는 상품을 실제로 공급할 수 있는가 (부서 영향 D2) */
import Link from 'next/link';
import { MoneyValue, NumValue, TextValue, UnknownChip } from '@/components/badges/values';
import { InlineWarning } from '@/components/alerts/alert-item';
import { PageHeader, RoleChip, Section, StubNotice } from '@/components/common';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getInventory, getSession } from '../../_data/views';

export default async function InventoryPage() {
  const [v, { role }] = await Promise.all([getInventory(), getSession()]);
  return (
    <div className="space-y-4">
      <PageHeader id="S-09" title="재고 커버" decision="확대 기안의 주력 SKU 가 집행일까지 공급 가능한지 보고, 조건부(집행일 조정) · 보충 요청 중 무엇을 할지 정합니다." />
      <InlineWarning tone="info">캠페인 증분 수요는 표본이라 수량으로 더하지 않음 — 방향(+)만 (G-13) · in_transit 입고일 미확인 (G-08)</InlineWarning>

      <Section title={`SKU 재고 커버 (풀스케일 · 스냅샷 ${v.rows[0]?.snapshotDate ?? ''})`} id="cover">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <caption className="sr-only">SKU 별 4주 평균 · 현재고 · 이동중 · 커버 · 안전재고 · 리드타임 · MOQ · 예상 품절 · 기발주</caption>
            <thead className="text-left text-xs text-zinc-600">
              <tr className="border-b">
                <th className="p-2 font-medium">SKU</th>
                <th className="p-2 font-medium">4주 평균</th>
                <th className="p-2 font-medium">현재고</th>
                <th className="p-2 font-medium">이동중</th>
                <th className="p-2 font-medium">커버 (계산)</th>
                <th className="p-2 font-medium">원본 커버값</th>
                <th className="p-2 font-medium">min/max · 리드타임 · MOQ</th>
                <th className="p-2 font-medium">예상 품절</th>
                <th className="p-2 font-medium">기발주 (예상 도착, A-20)</th>
                <th className="p-2 font-medium">주력 SKU 인 기안 (A-16)</th>
              </tr>
            </thead>
            <tbody>
              {v.rows.map((r) => (
                <tr key={r.skuId} className={cn('border-b align-top last:border-0', r.belowMin && 'bg-red-50')}>
                  <td className="p-2">
                    <span className="font-mono">{r.skuId}</span> <span className="text-xs">{r.category}</span>
                    <div className="text-xs text-zinc-600">{r.product}</div>
                  </td>
                  <td className="p-2"><NumValue n={r.avg} format="dec1" /></td>
                  <td className="p-2"><NumValue n={r.onHand} format="int" /></td>
                  <td className="p-2"><NumValue n={r.inTransit} format="int" /></td>
                  <td className="p-2">
                    <NumValue n={r.cover} format="weeks" danger={r.belowMin} />
                    {r.belowMin && <div className="text-[11px] font-semibold text-red-800">안전재고 min 미달</div>}
                  </td>
                  <td className="p-2"><NumValue n={r.reported} format="dec1" /></td>
                  <td className="p-2 text-xs">
                    {r.safetyStockWeeksMin}/{r.safetyStockWeeksMax}주 · {r.leadTimeWeeks}주 · {r.moq.toLocaleString('ko-KR')}
                  </td>
                  <td className="p-2 font-mono text-xs">{r.stockoutDate ?? '-'}</td>
                  <td className="p-2 text-xs">{r.pos.length ? r.pos.map((p) => `${p.id} ${p.qty.toLocaleString('ko-KR')}EA → ${p.arrival}`).join(', ') : '-'}</td>
                  <td className="p-2 text-xs">
                    {r.lines.map((l) => (
                      <Link key={l} href={`/proposals/PROP-2026-07?q=${l}`} className="mr-1 font-mono underline">
                        {l}
                      </Link>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="보충 제안 (R-INV-04)" id="supp">
        {v.suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">안전재고 미달 주력 SKU 를 가진 기안 건이 없습니다 (현재 시점 기준).</p>
        ) : (
          v.suggestions.map((s) => (
            <div key={s.lineId} className="space-y-2">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                트리거 <Link href={`/proposals/PROP-2026-07?q=${s.lineId}`} className="font-mono underline">{s.lineId}</Link> · 예상 지급일 <TextValue t={s.paymentDate} /> → 권한자 <RoleChip role={s.routing.requiredRole} />
                <span className="font-mono text-xs">{s.routing.reasons.map((r) => r.ruleId).join(' ')}</span>
              </p>
              <ul className="text-xs text-zinc-700">
                {s.routing.reasons.map((r) => (
                  <li key={r.text}>{r.text}</li>
                ))}
              </ul>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-600">
                  <tr className="border-b">
                    <th className="p-2 font-medium">SKU</th>
                    <th className="p-2 font-medium">Target (A-17)</th>
                    <th className="p-2 font-medium">제안 = Target − 현재고 − 이동중</th>
                    <th className="p-2 font-medium">MOQ 반영 (A-18)</th>
                    <th className="p-2 font-medium">단가</th>
                    <th className="p-2 font-medium">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {s.items.map((i) => (
                    <tr key={i.skuId} className="border-b last:border-0">
                      <td className="p-2 font-mono">{i.skuId}</td>
                      <td className="p-2"><NumValue n={i.target} format="dec1" /></td>
                      <td className="p-2"><NumValue n={i.suggested} format="dec1" /></td>
                      <td className="p-2"><NumValue n={i.finalQty} format="int" /></td>
                      <td className="p-2"><MoneyValue m={i.unitCost} /></td>
                      <td className="p-2"><MoneyValue m={i.amount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs">
                열린 질문: 기발주 SPO 가 in_transit 에 포함됐는가 · 입고일은? <UnknownChip gapId="G-08" />
              </p>
            </div>
          ))
        )}
        {v.replenishments.length > 0 && (
          <div className="mt-3">
            <h4 className="mb-1 text-sm font-semibold">보충요청</h4>
            <ul className="space-y-1 text-sm">
              {v.replenishments.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono">{r.id}</span> {r.skuId} {r.finalQty.toLocaleString('ko-KR')}EA · 지급 {r.expectedPaymentDate} · <RoleChip role={r.requiredRole} /> <strong>{r.status}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" disabled title="2단계 API 연결 후 활성">
            보충 요청 만들기 {role.actorRole === 'SCM' ? '(현재 역할 가능 · API 연결 전)' : '(SCM 만)'}
          </Button>
        </div>
        <div className="mt-2">
          <StubNotice>보충 요청 생성(POST /api/replenishment-requests)과 SCM 회신은 2단계 API 연결 후. ④ 프리셋에서 초안(DRAFT) 상태를 확인할 수 있습니다.</StubNotice>
        </div>
      </Section>
    </div>
  );
}
