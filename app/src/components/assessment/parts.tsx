/**
 * 판단안 표시 조각 — S-05 판단안 상세와 「실행 기록 · 재생」 화면이 같은 조각을 쓴다.
 * 계산하지 않는다: 받은 판단안(사실 · 규칙 결과 · 대안 · 미확인 · 도구 호출 · 호출 추적)을 형식만 바꿔 보여준다.
 */
import { History } from 'lucide-react';
import { SourceBadge, SourceBadgeStatic } from '@/components/badges/source-badge';
import { GapStatusChip, MoneyValue, NumValue, TextValue } from '@/components/badges/values';
import { RoleChip } from '@/components/common';
import { decisionText } from '@/components/labels';
import type { AiTurnTrace, Alternative, AssessmentUnknown, Sourced, ToolCallLog } from '@/domain/types';
import { cn } from '@/lib/utils';

export function FactValue({ v }: { v: Sourced<unknown> }) {
  if (typeof v.value === 'number') {
    if (v.scale === 'FULL' || v.scale === 'SAMPLE') return <MoneyValue m={{ ...v, value: v.value, scale: v.scale }} />;
    const isRatio = v.value > -1 && v.value < 1 && !Number.isInteger(v.value);
    return <NumValue n={{ ...v, value: v.value }} format={isRatio ? 'pct2' : 'int'} />;
  }
  return <TextValue t={{ ...v, value: String(v.value) }} />;
}

export function FactList({ facts }: { facts: { key: string; name: string; value: Sourced<unknown> }[] }) {
  return (
    <ul className="space-y-1.5 text-sm">
      {facts.map((f) => (
        <li key={f.key} className="flex flex-wrap items-center gap-2">
          <span className="w-56 text-zinc-700">{f.name}</span>
          <FactValue v={f.value} />
        </li>
      ))}
    </ul>
  );
}

/**
 * AI 가 쓴 문장 표지 (FE-12, ONTOLOGY 0절). 모의 모드는 `모의` 배지, 실제 AI 문장은 출처 배지가 아닌 「AI 작성」 표지 —
 * 문장은 값이 아니므로 원본근거해석 배지를 달지 않는다. 문장 속 숫자의 출처는 사실 표의 배지와 숫자 출처 검증으로 보인다.
 */
export function SentenceMark({ mock }: { mock: boolean }) {
  if (mock) return <SourceBadgeStatic label="MOCK" />;
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded border border-zinc-400 bg-white px-1.5 text-[11px] font-medium text-zinc-800" title="AI 가 쓴 문장 — 출처 값이 아님. 숫자 출처는 사실 표와 숫자 출처 검증 참고">
      AI 작성
    </span>
  );
}

/** 도구 반환값 한 줄 요약 — 모양(항목 수 · 키 이름)만 말한다. 값을 더하거나 고르지 않는다 */
function shapeText(v: unknown): string {
  if (Array.isArray(v)) return `목록 ${v.length}개 항목`;
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    return `객체 (${keys.slice(0, 6).join(' · ')}${keys.length > 6 ? ' …' : ''})`;
  }
  if (v === null || v === undefined) return '없음';
  return String(v);
}

function inputText(v: unknown): string {
  if (v && typeof v === 'object' && Object.keys(v).length === 0) return '입력 없음';
  const s = JSON.stringify(v);
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

/** 도구 호출 목록 — 호출마다 입력 · 반환 요약을 보이고 원문(JSON)은 접어 둔다 */
export function ToolCallList({ calls, empty = '기록된 도구 호출이 없습니다.' }: { calls: ToolCallLog[]; empty?: string }) {
  if (calls.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <ol className="space-y-1 text-xs">
      {calls.map((t, i) => (
        <li key={`${t.name}-${i}`} className="rounded border p-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-500 tabular-nums">{i + 1}</span>
            <span className="font-mono font-semibold">{t.name}</span>
            <span className={t.actor === 'AI' ? 'rounded bg-emerald-100 px-1' : 'rounded border border-dashed border-zinc-500 px-1'}>{t.actor === 'AI' ? 'AI (모델 호출)' : '시스템 (모의 모드 코드 실행)'}</span>
          </div>
          <dl className="mt-1 grid grid-cols-[3rem_1fr] gap-x-2 text-zinc-700">
            <dt className="text-zinc-500">입력</dt>
            <dd className="font-mono break-all">{inputText(t.input)}</dd>
            <dt className="text-zinc-500">반환</dt>
            <dd>{shapeText(t.output)}</dd>
          </dl>
          <details>
            <summary className="cursor-pointer text-zinc-600 underline">입력 · 반환 원문</summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded bg-zinc-50 p-1 text-[10px] whitespace-pre-wrap">입력 {JSON.stringify(t.input, null, 1)}</pre>
            <pre className="mt-1 max-h-48 overflow-auto rounded bg-zinc-50 p-1 text-[10px] whitespace-pre-wrap">반환 {JSON.stringify(t.output, null, 1)}</pre>
          </details>
        </li>
      ))}
    </ol>
  );
}

/** 대안 비교 표 — 권고 대안 강조 */
export function AlternativesTable({ alternatives, recommendedId }: { alternatives: Alternative[]; recommendedId: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">대안 비교 — 권고 대안 강조</caption>
        <thead className="text-left text-xs text-zinc-600">
          <tr className="border-b">
            <th className="p-2 font-medium">대안</th>
            <th className="p-2 font-medium">효과</th>
            <th className="p-2 font-medium">위험</th>
            <th className="p-2 font-medium">필요한 권한자</th>
          </tr>
        </thead>
        <tbody>
          {alternatives.map((alt) => {
            const rec = alt.id === recommendedId;
            return (
              <tr key={alt.id} className={cn('border-b align-top last:border-0', rec && 'bg-blue-50 ring-2 ring-blue-600 ring-inset')}>
                <td className="p-2">
                  <strong>
                    {alt.id}. {alt.title}
                  </strong>
                  <div className="text-xs text-zinc-600">{decisionText(alt.decision)}</div>
                  {rec && <div className="text-xs font-semibold text-blue-800">권고</div>}
                </td>
                <td className="p-2">
                  {alt.effects.map((e, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1">
                      {String(e.value)} <SourceBadge label={e.label} refs={e.refs} />
                    </div>
                  ))}
                </td>
                <td className="p-2 text-xs">
                  <ul className="list-disc pl-4">
                    {alt.risks.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </td>
                <td className="p-2">
                  <RoleChip role={alt.requiresRole} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 미확인 · 공백 목록 (FE-15) — 상태 · 문구는 서버 값. 모의 회신으로 채워진 공백도 목록에 남는다 */
export function UnknownList({ unknowns, compact = false }: { unknowns: AssessmentUnknown[]; compact?: boolean }) {
  if (unknowns.length === 0) return <p className="text-sm text-muted-foreground">미확인 항목이 없습니다.</p>;
  return (
    <ul className={cn('space-y-1', compact ? 'text-xs' : 'text-sm')}>
      {unknowns.map((u) => (
        <li key={u.gapId} className="flex flex-wrap items-center gap-2">
          <GapStatusChip gapId={u.gapId} status={u.status} statusText={u.statusText} />
          <span>{u.impact}</span>
        </li>
      ))}
    </ul>
  );
}

/** 실제 호출 추적 — 모델 응답마다 1행 (응답 ID · 모델 · 종료 사유 · 토큰 수). 키 · 헤더 · 본문은 없다 */
export function AiTraceTable({ trace }: { trace: AiTurnTrace[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">모델 응답 추적 — 응답마다 1행</caption>
        <thead className="text-left text-zinc-600">
          <tr className="border-b">
            <th className="py-1 pr-3 font-medium">순서</th>
            <th className="py-1 pr-3 font-medium">응답 ID</th>
            <th className="py-1 pr-3 font-medium">모델 (응답 값)</th>
            <th className="py-1 pr-3 font-medium">종료 사유</th>
            <th className="py-1 pr-3 text-right font-medium">입력 토큰</th>
            <th className="py-1 pr-3 text-right font-medium">출력 토큰</th>
          </tr>
        </thead>
        <tbody>
          {trace.map((t, i) => (
            <tr key={t.messageId} className="border-b last:border-0">
              <td className="py-1 pr-3 tabular-nums">{i + 1}</td>
              <td className="py-1 pr-3 font-mono break-all">{t.messageId}</td>
              <td className="py-1 pr-3 font-mono">{t.model}</td>
              <td className="py-1 pr-3 font-mono">{t.stopReason ?? '—'}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{t.inputTokens === null ? '—' : t.inputTokens.toLocaleString('ko-KR')}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{t.outputTokens === null ? '—' : t.outputTokens.toLocaleString('ko-KR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 「실행 기록 · 재생」 표지 — `실시간` · `모의` 와 다른 모양(남색 채움 · 되감기 기호)으로 구분한다 */
export function RecordedMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded bg-indigo-900 px-2 text-xs font-semibold whitespace-nowrap text-white', className)}>
      <History className="size-3.5" aria-hidden /> 실행 기록 · 재생
    </span>
  );
}
