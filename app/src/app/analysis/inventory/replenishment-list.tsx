/**
 * 보충요청 목록 (S-07 · S-09) — 상태 + 종결 구분(FE-04).
 * 종결 문구(승인 거절 · SCM 불필요 종결 · SCM 보충 불가 종결)는 서버 statusText(BE-13), 금액 · 단가 · 예상 지급일은 서버 Sourced 값 그대로.
 */
import Link from 'next/link';
import { MoneyValue, TextValue } from '@/components/badges/values';
import { RoleChip } from '@/components/common';
import type { InventoryView } from '@/domain/api-types';
import { cn } from '@/lib/utils';
import { getAudit } from '../../_data/views';

export async function ReplenishmentList({ items }: { items: InventoryView['replenishments'] }) {
  // 종결 문구는 서버 statusText(BE-13) 그대로. 여기서는 종결 사유(이력 reason)만 덧붙인다
  const audit = await getAudit({ entityType: 'REPLENISHMENT' });
  const closeReason = (id: string) => audit.find((a) => a.entityId === id && a.toStatus === 'REJECTED')?.reason ?? null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm">
        <caption className="sr-only">보충요청 — 상태 · 권한자 · 종결 구분</caption>
        <thead className="text-left text-xs text-zinc-600">
          <tr className="border-b">
            <th className="p-2 font-medium">ID · SKU</th>
            <th className="p-2 font-medium">트리거 건</th>
            <th className="p-2 font-medium">수량 · 금액</th>
            <th className="p-2 font-medium">예상 지급일 (A-19)</th>
            <th className="p-2 font-medium">권한자</th>
            <th className="p-2 font-medium">상태</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => {
            const reason = r.status === 'REJECTED' ? closeReason(r.id) : null;
            const approvalReject = r.status === 'REJECTED' && r.statusText === '승인 거절';
            return (
              <tr key={r.id} id={`rep-${r.id}`} className="scroll-mt-24 border-b align-top last:border-0">
                <td className="p-2">
                  <span className="font-mono">{r.id}</span> <span className="font-mono text-xs">{r.skuId}</span>
                </td>
                <td className="p-2 font-mono text-xs">
                  {r.triggerLineId ? (
                    <Link href={`/proposals/PROP-2026-07?q=${r.triggerLineId}`} className="underline">
                      {r.triggerLineId}
                    </Link>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="p-2">
                  <span className="text-xs tabular-nums">{r.finalQty.toLocaleString('ko-KR')}EA</span>{' '}
                  <MoneyValue m={r.amount} />
                  <div className="text-[11px] text-zinc-600">
                    단가 <MoneyValue m={r.unitCost} />
                  </div>
                </td>
                <td className="p-2 text-xs">
                  <TextValue t={r.paymentDate} />
                </td>
                <td className="p-2">
                  <RoleChip role={r.requiredRole} />
                </td>
                <td className="p-2 text-xs">
                  <span className={cn('inline-block rounded px-1 font-semibold', r.status === 'REJECTED' && (approvalReject ? 'bg-red-100 text-red-900' : 'bg-cyan-50 text-cyan-900'))}>{r.statusText}</span>
                  {reason && <div className="text-[11px] text-zinc-600">{reason}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
