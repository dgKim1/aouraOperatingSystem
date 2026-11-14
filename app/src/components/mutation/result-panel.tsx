'use client';
/**
 * 상태 변경 결과 패널 (UI-05) — MutationResult 를 그대로 보여준다: 상태 변경 · 생성 작업 · 생성 승인요청 · 권한자 변경 · 새 판단안 필요.
 * 건수는 API summary 값을 쓰고, 목록은 API 배열을 그대로 링크로 만든다(화면 계산 없음).
 */
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import type { MutationResult, RoutingChange } from '@/domain/api-types';
import { ROLE_KO } from '@/domain/types';
import { TASK_TYPE_KO } from '@/components/labels';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '../format';
import { ENTITY_KO, entityHref } from '../links';
import type { ApiFailure } from './api-client';

const ACTION_KO: Record<RoutingChange['action'], string> = {
  ROUTING_UPDATED: '권한자 갱신 (미상신 건)',
  REAPPROVAL_REQUIRED: '재승인 필요 — 받은 승인 효력 상실',
  POST_DEADLINE_REPORT: '기한 경과 — 사후 보고',
  KEEP_HIGHER_APPROVAL: '상위 권한자 승인 유지 (하향은 재상신 안 함)',
  RESUBMIT_PENDING: '대기 요청 대체 · 새 권한자에게 재상신',
};

function EntityLink({ type, id }: { type: string; id: string }) {
  const href = entityHref(type, id);
  return href ? (
    <Link href={href} className="font-mono underline underline-offset-2">
      {id}
    </Link>
  ) : (
    <span className="font-mono">{id}</span>
  );
}

export function ResultPanel({ title = '처리 결과', result, extra, onClose }: { title?: string; result: MutationResult; extra?: React.ReactNode; onClose?: () => void }) {
  const s = result.summary;
  const changes = result.transitions;
  return (
    <section className="space-y-2 rounded-md border border-emerald-400 bg-emerald-50/60 p-3 text-sm" role="status" aria-live="polite" aria-label={title}>
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="size-4 text-emerald-700" aria-hidden />
        <strong>{title}</strong>
        <span className="text-xs text-zinc-700">
          기준시각 {fmtDateTime(result.simNow)} · 상태 버전 {result.stateVersion}
        </span>
        {onClose && (
          <button type="button" onClick={onClose} className="ml-auto text-xs underline">
            닫기
          </button>
        )}
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>
          상태 변경 <strong className="tabular-nums">{s.stateChanges}</strong>건
        </span>
        <span>
          생성된 작업 <strong className="tabular-nums">{s.createdTasks}</strong>건
        </span>
        <span>
          생성된 승인요청 <strong className="tabular-nums">{s.createdApprovals}</strong>건
        </span>
        <span className={cn(s.routingChanges > 0 && 'font-semibold text-red-800')}>
          권한자 변경 <strong className="tabular-nums">{s.routingChanges}</strong>건
        </span>
        <span>
          새 판단안 필요 <strong>{s.needsAssessment.length ? s.needsAssessment.join(', ') : '없음'}</strong>
        </span>
      </p>
      {extra}

      {result.routingChanges.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-red-900">권한자 변경 (R-AUTH-06)</h4>
          <ul className="mt-1 space-y-1">
            {result.routingChanges.map((c, i) => (
              <li key={`${c.lineId}-${i}`} className="flex flex-wrap items-center gap-2 rounded border border-red-200 bg-white px-2 py-1">
                <AlertTriangle className="size-3.5 text-red-700" aria-hidden />
                <EntityLink type="EXPANSION_LINE" id={c.lineId} />
                <span>
                  권한자 {c.from ? <s className="text-zinc-500">{ROLE_KO[c.from]}</s> : '—'} → <strong>{ROLE_KO[c.to]}</strong>
                </span>
                <span className="font-mono text-[11px]">{c.ruleId}</span>
                <span className="text-xs text-red-900">{ACTION_KO[c.action]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {changes.length > 0 && (
        <details open={changes.length <= 8}>
          <summary className="cursor-pointer text-xs font-semibold">처리 이력 {changes.length}행 (상태 전이 · 같은 상태 유지 포함)</summary>
          <ul className="mt-1 space-y-0.5 text-xs">
            {changes.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-1.5">
                <span className="text-zinc-600">{ENTITY_KO[t.entityType] ?? t.entityType}</span>
                <EntityLink type={t.entityType} id={t.entityId} />
                <span>
                  {t.fromStatus ?? '—'} → <strong>{t.toStatus}</strong>
                </span>
                {t.ruleIds.length > 0 && <span className="font-mono text-[10px] text-zinc-600">{t.ruleIds.join(' ')}</span>}
                <span className="text-zinc-700">{t.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {result.createdTasks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold">생성된 작업</h4>
          <ul className="mt-1 space-y-0.5 text-xs">
            {result.createdTasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-1.5">
                <Link href={`/tasks#task-${t.id}`} className="font-mono underline">
                  {t.id}
                </Link>
                <strong>{TASK_TYPE_KO[t.type]}</strong>
                <span>{ROLE_KO[t.ownerRole]}</span>
                <span className="font-mono">기한 {fmtDateTime(t.dueAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.createdApprovals.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold">생성된 승인요청</h4>
          <ul className="mt-1 space-y-0.5 text-xs">
            {result.createdApprovals.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-1.5">
                <Link href={`/approvals/${a.id}`} className="font-mono underline">
                  {a.id}
                </Link>
                <span>{a.subjectIds.join(', ')}</span>
                <strong>→ {ROLE_KO[a.requiredRole]}</strong>
                <span>v{a.version}</span>
                {a.supersedesId && <span>({a.supersedesId} 대체)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** 오류는 서버 문구를 그대로 (UI-04) */
export function ApiErrorBox({ error, onRetry }: { error: ApiFailure; onRetry?: () => void }) {
  const hint =
    error.code === 'CONFLICT'
      ? '상태가 바뀌어 다시 만들어야 합니다 — 화면을 새로 조회한 뒤 다시 실행하세요.'
      : error.code === 'INTERNAL' || error.status === 0
        ? '일시적인 오류일 수 있습니다. 다시 시도하세요. 마지막으로 성공한 숫자를 대신 보여주지 않습니다.'
        : null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-900" role="alert">
      <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold">{error.message}</p>
        <p className="font-mono text-xs">
          HTTP {error.status} · {error.code}
          {error.status > 0 && ' · 서버는 아무것도 저장하지 않았습니다'}
        </p>
        {hint && <p className="text-xs">{hint}</p>}
        {hint && onRetry && (
          <button type="button" onClick={onRetry} className="rounded border border-red-400 bg-white px-2 py-0.5 text-xs font-medium hover:bg-red-100">
            {error.code === 'CONFLICT' ? '다시 만들기' : '다시 시도'}
          </button>
        )}
      </div>
    </div>
  );
}
