'use client';
/**
 * 외부 회신(모의) 양식 — S-02 「외부 회신」 · S-03 통보 탭 [수령확인 회신] · S-07/S-09 SCM [보충 검토 회신].
 * 모두 POST /api/events {type:'COUNTERPARTY_REPLY', payload: CounterpartyReplyInput} (SCREEN_SPEC 4-1). 처리 결과는 서버가 정한다.
 * 맞는 열린 작업이 없으면 서버가 404 를 돌려주고, 그 문구를 그대로 보여준다.
 */
import { useId, useState } from 'react';
import { Send } from 'lucide-react';
import type { EventResponse } from '@/domain/api-types';
import type { CounterpartyOutcome, CounterpartyRole } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useApiAction } from './api-client';
import { publishResult } from './result-dock';
import { ApiErrorBox, ResultPanel } from './result-panel';

export const FROM_KO: Record<CounterpartyRole, string> = { AGENCY: '에이전시', SCM: 'SCM', COREVIA: 'Corevia' };
export const OUTCOME_KO: Record<CounterpartyOutcome, string> = { RECEIPT_CONFIRMED: '수령확인', INFO_PROVIDED: '정보 제공', INSUFFICIENT: '정보 부족', REJECTED: '거절' };

const ALL_OUTCOMES: CounterpartyOutcome[] = ['RECEIPT_CONFIRMED', 'INFO_PROVIDED', 'INSUFFICIENT', 'REJECTED'];

export function CounterpartyReplyForm({
  fixedFrom,
  outcomes = ALL_OUTCOMES,
  defaultOutcome,
  defaultNote = '',
  submitLabel = '회신 기록 (모의)',
  compact = false,
  dock = false,
}: {
  fixedFrom?: CounterpartyRole;
  outcomes?: CounterpartyOutcome[];
  defaultOutcome?: CounterpartyOutcome;
  defaultNote?: string;
  submitLabel?: string;
  compact?: boolean;
  /** 회신 뒤 재조회로 이 폼(또는 폼이 놓인 행)이 사라지는 곳 — 작업 표 · S-03 통보 탭 · S-09 보충 검토 — 이면 결과를 결과 보관함에 남긴다 */
  dock?: boolean;
}) {
  const uid = useId();
  const [from, setFrom] = useState<CounterpartyRole>(fixedFrom ?? 'AGENCY');
  const [outcome, setOutcome] = useState<CounterpartyOutcome>(defaultOutcome ?? outcomes[0]!);
  const [note, setNote] = useState(defaultNote);
  const [inbound, setInbound] = useState('');
  const [needed, setNeeded] = useState<'' | 'false' | 'true'>('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const act = useApiAction<EventResponse>();

  // FE-09: 수령확인은 에이전시만 (통보 상대). SCM · Corevia 에는 숨긴다
  const visibleOutcomes = outcomes.filter((o) => from === 'AGENCY' || o !== 'RECEIPT_CONFIRMED');
  const effOutcome = visibleOutcomes.includes(outcome) ? outcome : visibleOutcomes[0]!;
  const showInbound = (from === 'SCM' || from === 'COREVIA') && effOutcome === 'INFO_PROVIDED';
  const showNeeded = from === 'SCM' && effOutcome === 'INFO_PROVIDED';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (showNeeded && needed === '') {
      setFieldError('SCM 정보 제공 회신에는 보충 필요 여부(필요 / 불필요)를 선택해야 합니다.');
      return;
    }
    setFieldError(null);
    const payload = {
      from,
      outcome: effOutcome,
      note,
      ...(showInbound && inbound ? { inboundExpectedDate: inbound } : {}),
      ...(showNeeded ? { replenishmentNeeded: needed === 'true' } : {}),
    };
    act.run('/api/events', 'POST', { type: 'COUNTERPARTY_REPLY', payload }, (r) => {
      if (dock) publishResult(`${FROM_KO[from]} ${OUTCOME_KO[effOutcome]} 회신 처리 결과 (${r.event.id})`, r);
    });
  }

  return (
    <form onSubmit={submit} className={cn('space-y-2 text-sm', !compact && 'rounded-md border border-dashed border-zinc-500 p-3')} aria-label="외부 회신 (모의)">
      {!fixedFrom && (
        <div className="grid grid-cols-[6rem_1fr] items-center gap-2">
          <Label htmlFor={`${uid}-from`}>상대</Label>
          <select id={`${uid}-from`} className="h-8 rounded border bg-white px-2" value={from} onChange={(e) => setFrom(e.target.value as CounterpartyRole)}>
            {(Object.keys(FROM_KO) as CounterpartyRole[]).map((f) => (
              <option key={f} value={f}>
                {FROM_KO[f]}
              </option>
            ))}
          </select>
        </div>
      )}
      <fieldset className="grid grid-cols-[6rem_1fr] items-start gap-2">
        <legend className="sr-only">결과</legend>
        <span className="pt-1 text-sm font-medium" aria-hidden>
          결과
        </span>
        <div className="flex flex-wrap gap-1.5">
          {visibleOutcomes.map((o) => (
            <label key={o} className="cursor-pointer rounded-md border bg-white px-2.5 py-1 text-sm has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-900 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
              <input type="radio" name={`${uid}-outcome`} value={o} className="sr-only" checked={effOutcome === o} onChange={() => setOutcome(o)} />
              {OUTCOME_KO[o]}
            </label>
          ))}
        </div>
      </fieldset>
      {showNeeded && (
        <fieldset className="grid grid-cols-[6rem_1fr] items-start gap-2">
          <legend className="sr-only">보충 필요 여부</legend>
          <span className="pt-1 text-sm font-medium" aria-hidden>
            보충 발주
          </span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['false', '불필요 (검토 종결 — 승인 거절 아님)'],
                ['true', '필요 (보충요청 상신)'],
              ] as const
            ).map(([v, t]) => (
              <label key={v} className="cursor-pointer rounded-md border bg-white px-2.5 py-1 text-sm has-[:checked]:border-cyan-800 has-[:checked]:bg-cyan-800 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
                <input type="radio" name={`${uid}-needed`} value={v} className="sr-only" checked={needed === v} onChange={() => setNeeded(v)} />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {showInbound && (
        <div className="grid grid-cols-[6rem_1fr] items-center gap-2">
          <Label htmlFor={`${uid}-inbound`}>입고 예정일</Label>
          <input id={`${uid}-inbound`} type="date" className="h-8 w-44 rounded border bg-white px-2" value={inbound} onChange={(e) => setInbound(e.target.value)} />
        </div>
      )}
      <div className="grid grid-cols-[6rem_1fr] items-start gap-2">
        <Label htmlFor={`${uid}-note`}>본문</Label>
        <Textarea id={`${uid}-note`} className="min-h-14 bg-white" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {fieldError && (
        <p className="text-sm text-red-700" role="alert">
          {fieldError}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={act.pending}>
          <Send className="size-3.5" aria-hidden /> {act.pending ? '기록 중…' : submitLabel}
        </Button>
        <span className="text-xs text-zinc-600">
          {FROM_KO[from]} 회신은 <span className="rounded border border-dashed border-zinc-500 px-1">모의</span> 로 기록됩니다.
        </span>
      </div>
      {act.error && <ApiErrorBox error={act.error} />}
      {act.result && !dock && <ResultPanel title={`${FROM_KO[from]} ${OUTCOME_KO[effOutcome]} 회신 처리 결과`} result={act.result} onClose={act.reset} />}
    </form>
  );
}
