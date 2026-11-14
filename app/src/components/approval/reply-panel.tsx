'use client';
/**
 * S-06 회신 패널 — 결정은 사람만 (R-AUTH-05).
 * - 현재 역할이 requiredRole 이고 요청이 대기 상태일 때만 버튼 활성 (UI-04). 최종 판정은 서버(422 FORBIDDEN_ROLE).
 * - POST /api/approval-requests/:id/replies 로 보내고, 결과 패널(MutationResult)을 보여준 뒤 서버 재조회 (UI-05).
 * - 다른 역할일 때 [권한 검증 확인]으로 같은 요청을 보내 서버 422 문구를 그대로 보여줄 수 있다(시연용 — 서버가 거부하므로 상태 불변).
 */
import { useState } from 'react';
import { Lock, Send, ShieldQuestion } from 'lucide-react';
import type { ApprovalItemView, ReplyResponse } from '@/domain/api-types';
import type { ActorRole, ApprovalStatus, ApproverRole, ContractDecision, ItemDecision, SubjectType } from '@/domain/types';
import { ROLE_KO } from '@/domain/types';
import { decisionText } from '@/components/labels';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useApiAction } from '../mutation/api-client';
import { ApiErrorBox, ResultPanel } from '../mutation/result-panel';

type Outcome = 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED' | 'INFO_REQUESTED';
const OUTCOME_KO: Record<Outcome, string> = { APPROVED: '승인', APPROVED_WITH_CONDITIONS: '조건부 승인', REJECTED: '반려', INFO_REQUESTED: '정보 요청' };
const ITEM_DECISIONS: ItemDecision[] = ['APPROVE', 'REJECT', 'HOLD', 'CONDITIONAL'];

export function ReplyPanel({
  requestId,
  requiredRole,
  status,
  subjectType,
  items,
  contractDecisions,
  current,
}: {
  requestId: string;
  requiredRole: ApproverRole;
  status: ApprovalStatus;
  subjectType: SubjectType;
  items: ApprovalItemView[];
  contractDecisions: ContractDecision[] | null;
  current: { actorRole: string; label: string };
}) {
  const allowed = current.actorRole === requiredRole && status === 'PENDING';
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [decision, setDecision] = useState<ContractDecision>((items[0]?.proposedDecision as ContractDecision) ?? 'RENEGOTIATE');
  const [itemDecisions, setItemDecisions] = useState<Record<string, ItemDecision>>(() => Object.fromEntries(items.map((i) => [i.itemId, (ITEM_DECISIONS.includes(i.proposedDecision as ItemDecision) ? i.proposedDecision : 'APPROVE') as ItemDecision])));
  const [conditions, setConditions] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [askInfo, setAskInfo] = useState(false);
  const [infoTarget, setInfoTarget] = useState<ActorRole>('AGENCY');
  const [infoQuestion, setInfoQuestion] = useState('');
  const act = useApiAction<ReplyResponse>();
  const probe = useApiAction<ReplyResponse>();
  const path = `/api/approval-requests/${encodeURIComponent(requestId)}/replies`;
  const proposedItems = items.map((i) => ({ itemId: i.itemId, decision: (ITEM_DECISIONS.includes(i.proposedDecision as ItemDecision) ? i.proposedDecision : 'APPROVE') as ItemDecision }));

  const blockedText = status !== 'PENDING' ? `이 요청은 이미 처리되었습니다 (${status}).` : `이 요청은 ${ROLE_KO[requiredRole]}만 결정할 수 있습니다 — 현재 역할: ${current.label}`;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: string[] = [];
    if (!outcome) errs.push('회신 결과를 선택하세요.');
    if (outcome === 'APPROVED_WITH_CONDITIONS' && !conditions.trim() && subjectType !== 'EXPANSION_LINES') errs.push('조건부 승인에는 조건을 입력해야 합니다.');
    if (outcome === 'REJECTED' && !reason.trim()) errs.push('반려 사유는 필수입니다.');
    if (outcome === 'INFO_REQUESTED' && !reason.trim()) errs.push('정보 요청 질문은 필수입니다.');
    if (subjectType === 'EXPANSION_LINES' && Object.values(itemDecisions).includes('CONDITIONAL') && !conditions.trim()) errs.push('조건부 건이 있으면 조건을 입력해야 합니다.');
    if (askInfo && !infoQuestion.trim()) errs.push('외부 정보 요청 질문을 입력하세요.');
    setErrors(errs);
    if (errs.length) return;
    const body = {
      respondentRole: current.actorRole,
      outcome,
      ...(contractDecisions && (outcome === 'APPROVED' || outcome === 'APPROVED_WITH_CONDITIONS') ? { decision } : {}),
      ...(subjectType === 'EXPANSION_LINES'
        ? { itemDecisions: Object.entries(itemDecisions).map(([itemId, d]) => ({ itemId, decision: d, ...(d === 'CONDITIONAL' ? { condition: conditions } : {}) })) }
        : {}),
      ...(conditions ? { conditions } : {}),
      ...(askInfo && (outcome === 'REJECTED' || outcome === 'INFO_REQUESTED') ? { infoRequest: { target: infoTarget, question: infoQuestion } } : {}),
      reason,
    };
    act.run(path, 'POST', body);
  }

  /** 권한 없는 역할로 같은 회신을 보내 서버 판정(422)을 확인 — 서버가 거부하므로 상태는 바뀌지 않는다 */
  function probeServer() {
    probe.run(path, 'POST', {
      respondentRole: current.actorRole,
      outcome: 'APPROVED',
      ...(contractDecisions ? { decision: (items[0]?.proposedDecision as ContractDecision) ?? contractDecisions[0] } : {}),
      ...(subjectType === 'EXPANSION_LINES' ? { itemDecisions: proposedItems } : {}),
      reason: `권한 검증 확인 (${current.label})`,
    });
  }

  if (act.result) {
    return (
      <div className="space-y-2">
        <ResultPanel
          title={`회신 처리 결과 — ${act.result.request.id} ${act.result.request.status}`}
          result={act.result}
          extra={
            <p className="text-xs">
              회신 {act.result.reply.id} · {ROLE_KO[act.result.reply.respondentRole]} · {act.result.reply.outcome} <span className="rounded border border-dashed border-zinc-500 px-1">모의</span>
            </p>
          }
        />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-md border border-zinc-300 bg-zinc-50 p-3" role="note">
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-800">
          <Lock className="size-4" aria-hidden /> {blockedText}
        </p>
        <div className="mt-2 flex flex-wrap gap-2" aria-hidden={false}>
          {(Object.keys(OUTCOME_KO) as Outcome[]).map((o) => (
            <Button key={o} size="sm" variant="outline" disabled aria-disabled title={blockedText}>
              {OUTCOME_KO[o]}
            </Button>
          ))}
        </div>
        {status === 'PENDING' && (
          <>
            <p className="mt-2 text-xs text-zinc-600">상단 「현재 역할」에서 {ROLE_KO[requiredRole]}(으)로 전환하면 회신할 수 있습니다 (시연용).</p>
            <div className="mt-2 border-t pt-2">
              <Button size="xs" variant="outline" onClick={probeServer} disabled={probe.pending}>
                <ShieldQuestion className="size-3.5" aria-hidden /> 권한 검증 확인 — 현재 역할({current.label})로 승인 전송 시도
              </Button>
              <p className="mt-1 text-[11px] text-zinc-600">서버가 권한을 다시 판정합니다. 거부되면 응답 문구를 그대로 보여주고 상태는 바뀌지 않습니다.</p>
              {probe.error && (
                <div className="mt-2">
                  <ApiErrorBox error={probe.error} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-blue-300 bg-blue-50/40 p-3" aria-label="회신 입력">
      <fieldset>
        <legend className="mb-1 text-sm font-medium">회신 결과</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(OUTCOME_KO) as Outcome[]).map((o) => (
            <label key={o} className={cn('cursor-pointer rounded-md border bg-white px-3 py-1.5 text-sm has-[:checked]:border-blue-700 has-[:checked]:bg-blue-700 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring')}>
              <input type="radio" name="outcome" value={o} className="sr-only" checked={outcome === o} onChange={() => setOutcome(o)} />
              {OUTCOME_KO[o]}
            </label>
          ))}
        </div>
      </fieldset>

      {contractDecisions && (outcome === 'APPROVED' || outcome === 'APPROVED_WITH_CONDITIONS') && (
        <div>
          <Label htmlFor="decision">승인할 계약 결정</Label>
          <select id="decision" className="mt-1 block h-8 rounded-md border bg-white px-2 text-sm" value={decision} onChange={(e) => setDecision(e.target.value as ContractDecision)}>
            {contractDecisions.map((d) => (
              <option key={d} value={d}>
                {decisionText(d)}
              </option>
            ))}
          </select>
        </div>
      )}

      {subjectType === 'EXPANSION_LINES' && (outcome === 'APPROVED' || outcome === 'APPROVED_WITH_CONDITIONS') && (
        <table className="w-full text-sm">
          <caption className="mb-1 text-left text-sm font-medium">건별 결정</caption>
          <tbody>
            {items.map((i) => (
              <tr key={i.itemId} className="border-t">
                <td className="py-1 pr-2 font-mono text-xs">{i.itemId}</td>
                <td className="py-1 pr-2 text-xs text-zinc-600">권고 {i.proposedText}</td>
                <td className="py-1">
                  <label className="sr-only" htmlFor={`d-${i.itemId}`}>
                    {i.itemId} 결정
                  </label>
                  <select
                    id={`d-${i.itemId}`}
                    className="h-7 rounded border bg-white px-1 text-xs"
                    value={itemDecisions[i.itemId]}
                    onChange={(e) => setItemDecisions((s) => ({ ...s, [i.itemId]: e.target.value as ItemDecision }))}
                  >
                    {ITEM_DECISIONS.map((d) => (
                      <option key={d} value={d}>
                        {decisionText(d)}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {(outcome === 'APPROVED_WITH_CONDITIONS' || Object.values(itemDecisions).includes('CONDITIONAL')) && outcome !== 'REJECTED' && outcome !== 'INFO_REQUESTED' && (
        <div>
          <Label htmlFor="cond">조건</Label>
          <Textarea id="cond" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="예: 집행일 2026-08-31 이후로 조정" className="mt-1 bg-white" />
        </div>
      )}

      {(outcome === 'REJECTED' || outcome === 'INFO_REQUESTED') && subjectType === 'CONTRACT' && (
        <fieldset className="space-y-1 rounded border bg-white p-2">
          <legend className="px-1 text-xs font-medium">외부 정보 요청 작업</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={askInfo} onChange={(e) => setAskInfo(e.target.checked)} /> 상대에게 정보 요청 작업 만들기 (계약 담당이 처리)
          </label>
          {askInfo && (
            <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
              <Label htmlFor="info-target">대상</Label>
              <select id="info-target" className="h-8 rounded border bg-white px-2 text-sm" value={infoTarget} onChange={(e) => setInfoTarget(e.target.value as ActorRole)}>
                <option value="AGENCY">에이전시</option>
                <option value="COREVIA">Corevia</option>
                <option value="SCM">SCM</option>
              </select>
              <Label htmlFor="info-q">질문</Label>
              <Textarea id="info-q" value={infoQuestion} onChange={(e) => setInfoQuestion(e.target.value)} placeholder="예: 성과 피 산식 · 정산 주기" className="bg-white" />
            </div>
          )}
        </fieldset>
      )}

      <div>
        <Label htmlFor="reason">{outcome === 'INFO_REQUESTED' ? '요청할 정보 (질문, 필수)' : outcome === 'REJECTED' ? '반려 사유 (필수)' : '사유 · 메모'}</Label>
        <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 bg-white" aria-invalid={errors.length > 0} />
      </div>

      {errors.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-red-700" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={act.pending}>
          <Send className="size-3.5" aria-hidden /> {act.pending ? '전송 중…' : `회신 (${current.label})`}
        </Button>
        <span className="text-xs text-zinc-700">
          모든 회신은 <span className="rounded border border-dashed border-zinc-500 px-1">모의</span> 배지로 기록됩니다.
        </span>
      </div>

      {act.error && <ApiErrorBox error={act.error} />}
    </form>
  );
}
