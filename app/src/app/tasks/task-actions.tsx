'use client';
/**
 * S-07 작업 행동 — [시작] · [완료](유형별 추가 입력) · [취소](사유) → PATCH /api/tasks/:id, 결과 패널 + 서버 재조회 (UI-05).
 * SCM 역할의 보충 검토 · SCM 정보 요청 작업은 [보충 검토 회신](COUNTERPARTY_REPLY, 승인 아님 — FE-01).
 * 에이전시(모의) 역할은 계약 통보 수령확인 · 정보 요청 작업에 [에이전시 회신].
 * 모든 PATCH 에 현재 역할(actorRole)을 싣는다 — 서버가 담당 역할(ownerRole)만 허용하고 그 밖은 422 FORBIDDEN_ROLE (BE-17, A-35).
 * SCM 보충 검토 · SCM 정보 요청 작업은 PATCH 완료가 409 라([완료] 없음, BE-18) [보충 검토 회신]으로만 닫는다.
 * 담당이 아닌 역할은 [권한 검증 확인]으로 같은 요청을 보내 서버의 422 문구를 그대로 볼 수 있다(상태 불변).
 */
import Link from 'next/link';
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

/** 재상신 근거 판단안 후보 — text = "ASM-003 · v2 · 권고 C 해지 통보" (판단안 값 그대로) */
export interface ResubmitBasis {
  id: string;
  version: number;
  mock: boolean;
  text: string;
}

export function TaskActions({ task, role, roleLabel, assessments, today }: { task: TaskView; role: ActorRole; roleLabel: string; assessments: ResubmitBasis[]; today: string }) {
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [asm, setAsm] = useState(assessments[0]?.id ?? '');
  const [err, setErr] = useState<string | null>(null);
  const act = useApiAction<TaskPatchResponse>();
  const probe = useApiAction<TaskPatchResponse>();
  const picked = assessments.find((a) => a.id === asm) ?? null;
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
        <div className="space-y-1">
          <p className="text-[11px] text-zinc-600">
            담당 {ROLE_KO[task.ownerRole]} 만 처리 (현재 {roleLabel})
          </p>
          <Button
            size="xs"
            variant="outline"
            disabled={probe.pending}
            onClick={() => probe.run(`/api/tasks/${encodeURIComponent(task.id)}`, 'PATCH', { actorRole: role, status: 'IN_PROGRESS' })}
            title="서버가 역할을 다시 판정합니다. 거부되면 문구를 그대로 보여주고 상태는 바뀌지 않습니다."
          >
            권한 검증 확인 — {roleLabel}(으)로 시작 시도
          </Button>
          {probe.error && <ApiErrorBox error={probe.error} />}
        </div>
      )}
      {scmReview && <p className="text-[11px] text-cyan-900">SCM 검토 회신은 승인이 아닙니다 — 보충 필요 여부 · 입고 예정일을 알립니다. 이 작업은 [완료]가 아니라 [보충 검토 회신]으로 닫습니다.</p>}

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
                <>
                  <select id={`a-${task.id}`} className="block h-7 max-w-full rounded border bg-white px-1 text-xs" value={asm} onChange={(e) => setAsm(e.target.value)}>
                    {assessments.map((a, i) => (
                      <option key={a.id} value={a.id}>
                        {a.text}
                        {a.mock ? ' · 모의' : ''}
                        {i === 0 ? ' (최신)' : ''}
                      </option>
                    ))}
                  </select>
                  {picked && (
                    <p className="mt-1 text-[11px] text-zinc-700" data-testid="resubmit-basis">
                      근거 판단안{' '}
                      <Link href={`/assessments/${picked.id}`} className="font-semibold underline">
                        {picked.text}
                      </Link>
                      {picked.mock && <span className="ml-1 rounded border border-dashed border-zinc-500 px-1">모의</span>} — 이 판단안의 권고가 새 승인요청의 권고안이 됩니다.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-amber-900" role="note">
                  이 대상의 판단안이 없습니다 — 판단안 없이 재상신하면 서버가 거부합니다(정보 부족, 상태 불변). 먼저{' '}
                  <Link href={`${task.subjectHref}?tab=assessment`} className="font-semibold underline">
                    전속계약 판단안 탭
                  </Link>
                  에서 판단안을 만드세요.
                </p>
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
