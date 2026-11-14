'use client';
/**
 * [AI 판단안 만들기] (POST /api/assessments) · [승인 요청 만들기] (POST /api/approval-requests).
 * 권한자 · 묶음은 서버(규칙 엔진)가 정한다 — 화면은 요청 결과를 그대로 보여준다.
 * 실시간 AI 가 실패하면 서버가 모의로 대체하고 mock · fallbackReason 을 돌려준다 → 그대로 표시 (UI-06).
 */
import Link from 'next/link';
import { Bot, Send } from 'lucide-react';
import type { ApprovalCreateResponse, AssessmentCreateResponse } from '@/domain/api-types';
import type { ActorRole, SubjectType } from '@/domain/types';
import { ROLE_KO } from '@/domain/types';
import { Button } from '@/components/ui/button';
import { useApiAction } from './api-client';
import { publishResult } from './result-dock';
import { ApiErrorBox, ResultPanel } from './result-panel';

export function MockBadge() {
  return <span className="ml-1 inline-flex h-4 items-center rounded border border-dashed border-current px-1 text-[10px] leading-none">모의</span>;
}

export function AssessButton({
  subjectType,
  subjectIds,
  label = 'AI 판단안 만들기',
  aiMode,
  variant = 'default',
  disabledReason,
  showRequestNext = true,
  actorRole,
}: {
  subjectType: SubjectType;
  subjectIds: string[];
  label?: string;
  aiMode: 'LIVE' | 'MOCK';
  variant?: 'default' | 'outline';
  disabledReason?: string | null;
  showRequestNext?: boolean;
  /** 현재 화면 역할. 에이전시(모의)는 외부 상대라 판단안 버튼을 숨긴다 (ONTOLOGY 1-3 쓰기 행위별 허용 역할, FE-14) */
  actorRole?: ActorRole;
}) {
  const a = useApiAction<AssessmentCreateResponse>();
  if (actorRole === 'AGENCY') return <AgencyNote what="판단안" />;
  const disabled = a.pending || subjectIds.length === 0 || !!disabledReason;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={variant} disabled={disabled} onClick={() => a.run('/api/assessments', 'POST', { subjectType, subjectIds })} title={disabledReason ?? undefined}>
          <Bot className="size-3.5" aria-hidden /> {a.pending ? '판단안 만드는 중…' : label}
          {aiMode === 'MOCK' && <MockBadge />}
        </Button>
        <span className="text-xs text-zinc-600">
          대상 {subjectIds.length ? subjectIds.join(', ') : '없음'}
          {disabledReason ? ` — ${disabledReason}` : ''}
        </span>
      </div>
      {a.error && <ApiErrorBox error={a.error} onRetry={() => a.run('/api/assessments', 'POST', { subjectType, subjectIds })} />}
      {a.result && (
        <ResultPanel
          title="판단안 생성 결과"
          result={a.result}
          onClose={a.reset}
          extra={
            <div className="space-y-1">
              <p className="flex flex-wrap items-center gap-2">
                <Link href={`/assessments/${a.result.assessment.id}`} className="font-mono font-semibold underline">
                  {a.result.assessment.id}
                </Link>
                <span>v{a.result.assessment.version}</span>
                <span className={a.result.assessment.mock ? 'rounded border border-dashed border-zinc-600 px-1 text-xs' : 'rounded bg-emerald-600 px-1 text-xs text-white'}>
                  AI: {a.result.assessment.mock ? '모의' : '실시간'}
                </span>
                <span className="text-xs">권고 대안 {a.result.assessment.recommendation.alternativeId}</span>
              </p>
              {a.result.assessment.fallbackReason && (
                <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-900" role="note">
                  실시간 호출 실패 → 모의로 생성: {a.result.assessment.fallbackReason}
                </p>
              )}
              {showRequestNext && <RequestApprovalButton assessmentId={a.result.assessment.id} />}
            </div>
          }
        />
      )}
    </div>
  );
}

export function RequestApprovalButton({
  assessmentId,
  disabledReason,
  label = '승인 요청 만들기',
  actorRole,
  dock = false,
}: {
  assessmentId: string;
  disabledReason?: string | null;
  label?: string;
  actorRole?: ActorRole;
  /** 상신 뒤 재조회로 이 버튼이 사라지는 곳(S-05 — 버튼 자리가 승인요청 링크로 바뀜)이면 결과를 결과 보관함에 남긴다 */
  dock?: boolean;
}) {
  const r = useApiAction<ApprovalCreateResponse>();
  if (actorRole === 'AGENCY') return <AgencyNote what="상신" />;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={r.pending || !!disabledReason || !!r.result} onClick={() => r.run('/api/approval-requests', 'POST', { assessmentId }, (d) => { if (dock) publishResult('승인요청 생성 결과', d); })} title={disabledReason ?? undefined}>
          <Send className="size-3.5" aria-hidden /> {r.pending ? '상신 중…' : r.result ? '상신 완료' : label}
        </Button>
        <span className="text-xs text-zinc-600">판단안 {assessmentId} 근거 · 권한자별 묶음은 서버가 정함 (A-11){disabledReason ? ` — ${disabledReason}` : ''}</span>
      </div>
      {r.error && <ApiErrorBox error={r.error} />}
      {r.result && !dock && (
        <ResultPanel
          title="승인요청 생성 결과"
          result={r.result}
          onClose={r.reset}
          extra={
            <ul className="space-y-0.5 text-sm">
              {r.result.requests.map((q) => (
                <li key={q.id}>
                  <Link href={`/approvals/${q.id}`} className="font-mono font-semibold underline">
                    {q.id}
                  </Link>{' '}
                  {q.subjectIds.join(', ')} → <strong>{ROLE_KO[q.requiredRole]}</strong> · 원본 기한 {q.hardDeadline}
                </li>
              ))}
            </ul>
          }
        />
      )}
    </div>
  );
}

/** 외부 상대(에이전시, 모의) 역할에서 내부 판단 · 상신 버튼 대신 보이는 안내 */
function AgencyNote({ what }: { what: string }) {
  return <p className="text-xs text-zinc-600">에이전시(모의)는 외부 상대라 {what}을(를) 만들지 않습니다 — 내부 역할로 바꾸면 보입니다.</p>;
}
