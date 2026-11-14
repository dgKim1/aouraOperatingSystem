'use client';
/**
 * S-07 작업 행동 — [시작] · [완료](유형별 추가 입력) · [취소](사유) → PATCH /api/tasks/:id, 결과 패널 + 서버 재조회 (UI-05).
 * SCM 역할의 보충 검토 · SCM 정보 요청 작업은 [보충 검토 회신](COUNTERPARTY_REPLY, 승인 아님 — FE-01).
 * 에이전시(모의) 역할은 계약 통보 수령확인 · 정보 요청 작업에 [에이전시 회신].
 */
import { useState } from 'react';
import type { TaskPatchResponse, TaskView } from '@/domain/api-types';
import type { ActorRole } from '@/domain/types';
import { ROLE_KO } from '@/domain/types';
import { useApiAction } from '@/components/mutation/api-client';
import { CounterpartyReplyForm } from '@/components/mutation/counterparty-reply-form';
import { publishResult } from '@/components/mutation/result-dock';
import { ApiErrorBox } from '@/components/mutation/result-panel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Mode = null | 'done' | 'cancel' | 'scm' | 'agency';

export function TaskActions({ task, role, roleLabel, assessments, today }: { task: TaskView; role: ActorRole; roleLabel: string; assessments: { id: string; text: string }[]; today: string }) {
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [asm, setAsm] = useState(assessments[0]?.id ?? '');
  const [err, setErr] = useState<string | null>(null);
  const act = useApiAction<TaskPatchResponse>();
  const mine = task.ownerRole === role;
  const open = task.status === 'OPEN' || task.status === 'IN_PROGRESS' || task.status === 'OVERDUE';
  const scmReview = role === 'SCM' && task.ownerRole === 'SCM' && (task.type === 'REPLENISHMENT_REVIEW' || task.type === 'INFO_REQUEST');
  const agencyReply = role === 'AGENCY' && task.subjectType === 'CONTRACT' && (task.type === 'CONFIRM_RECEIPT' || task.type === 'RENOTIFY' || task.type === 'INFO_REQUEST');

  if (!open) return null;

  function patch(body: Record<string, unknown>) {
    // 완료 · 취소된 작업은 재조회 뒤 이 표에서 빠지므로 결과는 화면 위 결과 보관함에 남긴다
    act.run(`/api/tasks/${encodeURIComponent(task.id)}`, 'PATCH', { actorRole: role, ...body }, (r) => {
      setMode(null);
      publishResult(`작업 ${task.id} (${task.typeText}) → ${r.task.statusText}`, r);
    });
  }

  function complete(e: React.FormEvent) {
    e.preventDefault();
    if (task.type === 'RESCHEDULE_CAMPAIGN' && !date) return setErr('새 집행일을 입력하세요.');
    setErr(null);
    const payload: Record<string, unknown> =
      task.type === 'SEND_NOTICE' ? (content ? { content } : {}) : task.type === 'RESCHEDULE_CAMPAIGN' ? { settlementDate: date } : task.type === 'RESUBMIT' ? (asm ? { assessmentId: asm } : {}) : {};
    patch({ status: 'DONE', ...(note ? { resultNote: note } : {}), ...(Object.keys(payload).length ? { payload } : {}) });
  }

  function cancel(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return setErr('취소 사유를 입력하세요.');
    setErr(null);
    patch({ status: 'CANCELLED', resultNote: note });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {mine && task.status !== 'IN_PROGRESS' && (
          <Button size="xs" variant="outline" disabled={act.pending} onClick={() => patch({ status: 'IN_PROGRESS' })}>
            시작
          </Button>
        )}
        {mine && !scmReview && (
          <Button size="xs" disabled={act.pending} onClick={() => setMode(mode === 'done' ? null : 'done')} aria-expanded={mode === 'done'}>
            완료
          </Button>
        )}
        {mine && (
          <Button size="xs" variant="ghost" disabled={act.pending} onClick={() => setMode(mode === 'cancel' ? null : 'cancel')} aria-expanded={mode === 'cancel'}>
            취소
          </Button>
        )}
        {scmReview && (
          <Button size="xs" className="bg-cyan-800 hover:bg-cyan-900" onClick={() => setMode(mode === 'scm' ? null : 'scm')} aria-expanded={mode === 'scm'}>
            보충 검토 회신
          </Button>
        )}
        {agencyReply && (
          <Button size="xs" variant="outline" onClick={() => setMode(mode === 'agency' ? null : 'agency')} aria-expanded={mode === 'agency'}>
            에이전시 회신 (모의)
          </Button>
        )}
      </div>
      {!mine && !scmReview && !agencyReply && (
        <p className="text-[11px] text-zinc-600">
          담당 {ROLE_KO[task.ownerRole]} 만 처리 (현재 {roleLabel})
        </p>
      )}
      {scmReview && <p className="text-[11px] text-cyan-900">SCM 검토 회신은 승인이 아닙니다 — 보충 필요 여부 · 입고 예정일을 알립니다.</p>}

      {mode === 'done' && (
        <form onSubmit={complete} className="space-y-1.5 rounded border bg-zinc-50 p-2" aria-label={`${task.id} 완료`}>
          {task.type === 'SEND_NOTICE' && (
            <div>
              <Label htmlFor={`c-${task.id}`} className="text-xs">
                통보 내용 (발송 시각 = 현재 가상 기준시각)
              </Label>
              <Textarea id={`c-${task.id}`} className="min-h-12 bg-white text-xs" value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
          )}
          {task.type === 'RESCHEDULE_CAMPAIGN' && (
            <div>
              <Label htmlFor={`d-${task.id}`} className="text-xs">
                새 집행일 (필수)
              </Label>
              <input id={`d-${task.id}`} type="date" min={today} className="block h-7 rounded border bg-white px-2 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
          {task.type === 'RESUBMIT' && (
            <div>
              <Label htmlFor={`a-${task.id}`} className="text-xs">
                재상신 근거 판단안
              </Label>
              {assessments.length ? (
                <select id={`a-${task.id}`} className="block h-7 rounded border bg-white px-1 text-xs" value={asm} onChange={(e) => setAsm(e.target.value)}>
                  {assessments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.text}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-amber-800">이 대상의 판단안이 없습니다 — 이전 요청의 권고로 재상신됩니다. 먼저 판단안을 다시 만들 수 있습니다.</p>
              )}
            </div>
          )}
          <div>
            <Label htmlFor={`n-${task.id}`} className="text-xs">
              결과 메모
            </Label>
            <Textarea id={`n-${task.id}`} className="min-h-10 bg-white text-xs" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {err && (
            <p className="text-xs text-red-700" role="alert">
              {err}
            </p>
          )}
          <Button type="submit" size="xs" disabled={act.pending}>
            {act.pending ? '처리 중…' : '완료 처리'}
          </Button>
        </form>
      )}
      {mode === 'cancel' && (
        <form onSubmit={cancel} className="space-y-1.5 rounded border bg-zinc-50 p-2" aria-label={`${task.id} 취소`}>
          <Label htmlFor={`x-${task.id}`} className="text-xs">
            취소 사유 (필수)
          </Label>
          <Textarea id={`x-${task.id}`} className="min-h-10 bg-white text-xs" value={note} onChange={(e) => setNote(e.target.value)} />
          {err && (
            <p className="text-xs text-red-700" role="alert">
              {err}
            </p>
          )}
          <Button type="submit" size="xs" variant="destructive" disabled={act.pending}>
            취소 처리
          </Button>
        </form>
      )}
      {mode === 'scm' && <CounterpartyReplyForm fixedFrom="SCM" outcomes={['INFO_PROVIDED', 'INSUFFICIENT', 'REJECTED']} submitLabel="보충 검토 회신 (모의)" dock />}
      {mode === 'agency' && <CounterpartyReplyForm fixedFrom="AGENCY" defaultOutcome={task.type === 'INFO_REQUEST' ? 'INSUFFICIENT' : 'RECEIPT_CONFIRMED'} submitLabel="에이전시 회신 (모의)" dock />}
      {act.error && <ApiErrorBox error={act.error} />}
    </div>
  );
}
