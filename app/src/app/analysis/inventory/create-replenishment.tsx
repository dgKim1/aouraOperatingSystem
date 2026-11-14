'use client';
/** [보충 요청 만들기] — POST /api/replenishment-requests {triggerLineId, skuIds}. 권한자 · 수량 · 금액은 서버가 정한다 (SCM 역할만) */
import type { ReplenishmentCreateResponse } from '@/domain/api-types';
import { ROLE_KO } from '@/domain/types';
import { useApiAction } from '@/components/mutation/api-client';
import { ApiErrorBox, ResultPanel } from '@/components/mutation/result-panel';
import { Button } from '@/components/ui/button';

export function CreateReplenishment({ lineId, skuIds, canCreate, existing }: { lineId: string; skuIds: string[]; canCreate: boolean; existing: string[] }) {
  const act = useApiAction<ReplenishmentCreateResponse>();
  const reason = !canCreate ? 'SCM 역할만 만들 수 있습니다' : existing.length ? `이미 진행 중인 보충요청 ${existing.join(', ')}` : null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={act.pending || !!reason} onClick={() => act.run('/api/replenishment-requests', 'POST', { triggerLineId: lineId, skuIds })}>
          {act.pending ? '만드는 중…' : `보충 요청 만들기 (${skuIds.join(' · ')})`}
        </Button>
        {reason && <span className="text-xs text-zinc-600">{reason}</span>}
      </div>
      {act.error && <ApiErrorBox error={act.error} />}
      {act.result && (
        <ResultPanel
          title="보충요청 초안 생성 결과"
          result={act.result}
          onClose={act.reset}
          extra={
            <ul className="text-xs">
              {act.result.replenishments.map((r) => (
                <li key={r.id}>
                  <span className="font-mono">{r.id}</span> {r.skuId} · 권한자 <strong>{ROLE_KO[r.requiredRole]}</strong> · {r.status}
                </li>
              ))}
            </ul>
          }
        />
      )}
    </div>
  );
}
