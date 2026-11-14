/** 상태 스테퍼 — 현재 상태 강조 · 분기(반려 · 자동 갱신 · 수령 미확인) 표시. 상태 → 단계 대응만 하고 전이는 하지 않는다. */
import { Check, CircleDot, Circle, OctagonAlert, RotateCcw } from 'lucide-react';
import type { ContractStatus } from '@/domain/types';
import { cn } from '@/lib/utils';

export type StepState = 'done' | 'current' | 'todo' | 'warn' | 'danger';
export interface Step {
  label: string;
  state: StepState;
  note?: string;
}

const STEP_STYLE: Record<StepState, { cls: string; Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; sr: string }> = {
  done: { cls: 'bg-emerald-600 text-white', Icon: Check, sr: '완료' },
  current: { cls: 'bg-blue-700 text-white ring-4 ring-blue-200', Icon: CircleDot, sr: '현재' },
  todo: { cls: 'bg-zinc-200 text-zinc-600', Icon: Circle, sr: '대기' },
  warn: { cls: 'bg-amber-500 text-white ring-4 ring-amber-200', Icon: RotateCcw, sr: '분기 · 재검토' },
  danger: { cls: 'bg-red-600 text-white ring-4 ring-red-200', Icon: OctagonAlert, sr: '분기 · 위험' },
};

export function StatusStepper({ steps, label }: { steps: Step[]; label: string }) {
  return (
    <ol className="flex flex-wrap items-start gap-y-3" aria-label={label}>
      {steps.map((s, i) => {
        const st = STEP_STYLE[s.state];
        return (
          <li key={i} className="flex items-start" aria-current={s.state === 'current' || s.state === 'warn' || s.state === 'danger' ? 'step' : undefined}>
            <div className="flex w-24 flex-col items-center text-center">
              <span className={cn('flex size-7 items-center justify-center rounded-full', st.cls)}>
                <st.Icon className="size-4" aria-hidden />
              </span>
              <span className={cn('mt-1 text-xs', s.state === 'todo' ? 'text-zinc-500' : 'font-medium')}>{s.label}</span>
              <span className="sr-only">({st.sr})</span>
              {s.note && <span className={cn('mt-0.5 text-[11px]', s.state === 'danger' ? 'text-red-700' : s.state === 'warn' ? 'text-amber-800' : 'text-zinc-600')}>{s.note}</span>}
            </div>
            {i < steps.length - 1 && <span className="mt-3.5 h-0.5 w-4 bg-zinc-300" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

const LABELS = ['접수', '검토', '상신', '승인 / 반려', '통보', '수령확인', '결과'];

/** 계약 상태 → 스테퍼 단계 (ONTOLOGY 3-1) */
export function contractSteps(status: ContractStatus): Step[] {
  const at = (cur: number, special?: { idx: number; state: StepState; note: string }): Step[] =>
    LABELS.map((label, i) => {
      if (special && i === special.idx) return { label, state: special.state, note: special.note };
      return { label, state: i < cur ? 'done' : i === cur ? 'current' : 'todo' };
    });
  switch (status) {
    case 'ACTIVE':
      return at(0, { idx: 0, state: 'todo', note: '통보 미접수' });
    case 'UNDER_REVIEW':
      return at(1);
    case 'PENDING_APPROVAL':
      return at(3, { idx: 3, state: 'current', note: '권한자 회신 대기' });
    case 'REVIEW_BEFORE_DEADLINE':
      return at(3, { idx: 3, state: 'warn', note: '반려 · 기한 전 재검토' });
    case 'NOTICE_PENDING':
      return at(4, { idx: 4, state: 'current', note: '발송 대기' });
    case 'NOTICE_SENT':
      return at(5, { idx: 5, state: 'warn', note: '수령 미확인' });
    case 'NOTICE_ACKNOWLEDGED':
      return at(6, { idx: 6, state: 'current', note: '수령 확인' });
    case 'NEGOTIATING':
      return at(7, { idx: 6, state: 'done', note: '조건변경 협상' });
    case 'TERMINATING':
      return at(7, { idx: 6, state: 'done', note: '만료 후 종료' });
    case 'RENEWED_APPROVED':
      return LABELS.map((label, i) => ({ label, state: i <= 3 ? 'done' : i === 6 ? 'done' : 'todo', ...(i === 6 ? { note: '승인 갱신' } : i === 4 || i === 5 ? { note: '해당 없음' } : {}) }));
    case 'NOTICE_UNCONFIRMED':
      return at(5, { idx: 5, state: 'danger', note: '기한까지 수령 미확인' });
    case 'AUTO_RENEWED':
      return LABELS.map((label, i) => ({ label, state: i === 6 ? 'danger' : i <= 1 ? 'done' : 'todo', ...(i === 6 ? { note: '자동 갱신 — 권한 미경유 체결' } : {}) }));
  }
}
