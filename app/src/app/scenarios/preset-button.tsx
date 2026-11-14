'use client';
/** 프리셋 초기화 후 재생 — POST /api/scenarios/:id/reset (상태는 서버 전역 하나). 확인 후 실행, 결과는 서버 재조회로 반영 */
import { useState } from 'react';
import type { ScenarioResetResponse } from '@/domain/api-types';
import { useApiAction } from '@/components/mutation/api-client';
import { ApiErrorBox } from '@/components/mutation/result-panel';
import { fmtDateTime } from '@/components/format';
import { Button } from '@/components/ui/button';

export function PresetButton({ id, title, current, label = '초기화 후 이 지점까지 재생' }: { id: string; title: string; current: boolean; label?: string }) {
  const act = useApiAction<ScenarioResetResponse>();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-1">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-1 rounded border border-amber-400 bg-amber-50 p-1.5 text-xs" role="alertdialog" aria-label={`${title} 재생 확인`}>
          <span>운영 상태(승인요청 · 작업 · 이력)를 비우고 「{title}」 까지 다시 재생합니다. 원본 적재 데이터는 그대로입니다.</span>
          <Button
            size="xs"
            onClick={() => {
              setConfirming(false);
              act.run(`/api/scenarios/${id}/reset`, 'POST');
            }}
          >
            확인
          </Button>
          <Button size="xs" variant="outline" onClick={() => setConfirming(false)}>
            취소
          </Button>
        </div>
      ) : (
        <Button size="sm" variant={current ? 'secondary' : 'outline'} disabled={act.pending} onClick={() => setConfirming(true)}>
          {act.pending ? '재생 중…' : current ? `${label} (현재 지점)` : label}
        </Button>
      )}
      {act.error && <ApiErrorBox error={act.error} />}
      {act.result && (
        <p className="text-xs text-emerald-800" role="status">
          재생 완료 — 사건 {act.result.replayedEvents.length}건, 기준시각 {fmtDateTime(act.result.simNow)}, 상태 버전 {act.result.stateVersion}
        </p>
      )}
    </div>
  );
}
