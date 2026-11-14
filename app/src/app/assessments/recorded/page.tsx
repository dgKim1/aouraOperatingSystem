/**
 * 실제 Claude 실행 기록 · 재생 (S-05 판단안 영역) — GET /api/assessments/recorded 와 같은 서비스 응답(RecordedRunsResponse)을 그대로 보인다.
 *
 * 실제 AI 로 판단안을 한 번 만든 기록을 다시 보여줄 뿐, 이 화면은 AI 를 호출하지 않고 운영 상태도 읽거나 바꾸지 않는다.
 * 흐름 순서로 배치한다: ① AI 가 받은 것 → ② AI 가 낸 것 → ③ 검증 → ④ 승인요청 → ⑤ 사람 회신 대기.
 * 표시 규칙: 서버 label 그대로, `실시간` · `모의` 가 아닌 「실행 기록 · 재생」 표지. 승인요청 · 이력은 "그 실행 당시의 사본"이라
 * 현재 승인함 · 처리 이력으로 연결하지 않는다(같은 ID 가 지금은 다른 요청일 수 있다). 값은 계산하지 않고 받은 그대로 보인다.
 */
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { AiTraceTable, AlternativesTable, FactList, RecordedMark, SentenceMark, ToolCallList, UnknownList } from '@/components/assessment/parts';
import { SourceBadgeStatic } from '@/components/badges/source-badge';
import { ApprovalStatusBadge, AuditTable, PageHeader, RoleChip, Section } from '@/components/common';
import { fmtDateTime } from '@/components/format';
import { APPROVAL_STATUS_KO, decisionText } from '@/components/labels';
import type { RecordedRunView } from '@/domain/api-types';
import { ROLE_KO } from '@/domain/types';
import { cn } from '@/lib/utils';
import { getRecordedRuns } from '../../_data/views';

type SP = Record<string, string | string[] | undefined>;

/** AI 가 결과를 내는 도구 — 이 호출의 입력이 곧 AI 의 출력이다. 나머지 도구 호출은 AI 가 근거를 받아 간 조회 */
const SUBMIT_TOOL = 'submit_assessment';

const VIOLATION_KO: Record<string, string> = {
  NUMBER_NOT_IN_FACTS: '사실 · 규칙 결과에 없는 숫자',
  CLAIM_NUMBER_IN_TEXT: '주장 숫자가 문장에 있음',
  CLAIM_IN_FACTS: '주장 라벨 값이 사실에 있음',
  CLAIM_NUMBER_IN_FACTS: '주장 숫자가 사실에 있음',
};

export default async function RecordedRunsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { runs } = await getRecordedRuns();
  const run = runs.find((r) => r.id === sp.run) ?? runs[0];
  return (
    <div className="space-y-4">
      <PageHeader
        id="S-05"
        title="실제 Claude 실행 기록"
        decision="AI 가 실제로 무엇을 받아 무엇을 냈고, 그 결과가 어떻게 사람(권한자)의 승인 요청으로 이어졌는지 확인합니다. 이 화면은 보기 전용이라 아무것도 바뀌지 않습니다."
      >
        <RecordedMark />
      </PageHeader>
      {!run ? (
        <Section title="기록 없음" id="none">
          <p className="text-sm text-muted-foreground">저장된 실제 실행 기록이 없습니다. 시연의 판단안은 모의 모드로 만들어집니다.</p>
        </Section>
      ) : (
        <>
          {runs.length > 1 && (
            <nav aria-label="실행 기록 선택" className="flex flex-wrap gap-2 text-sm">
              {runs.map((r) => (
                <Link key={r.id} href={`/assessments/recorded?run=${r.id}`} aria-current={r.id === run.id ? 'page' : undefined} className={cn('rounded border px-2 py-1 font-mono', r.id === run.id ? 'border-indigo-900 bg-indigo-900 text-white' : 'bg-white underline')}>
                  {r.id}
                </Link>
              ))}
            </nav>
          )}
          <RunView run={run} />
        </>
      )}
    </div>
  );
}

function RunView({ run }: { run: RecordedRunView }) {
  const a = run.assessment;
  const calls = a.toolCalls ?? [];
  const lookups = calls.filter((t) => t.name !== SUBMIT_TOOL);
  const submits = calls.filter((t) => t.name === SUBMIT_TOOL);
  const rec = a.alternatives.find((x) => x.id === a.recommendation.alternativeId) ?? null;
  const requests = run.followUp.approvalRequests;
  const waiting = requests.length > 0 && requests.every((r) => r.status === 'PENDING');
  const verified = a.provenance.ok && run.basisCheck.ok;

  const steps: { href: string; n: string; title: string; who: string; summary: React.ReactNode; tone?: 'ok' | 'bad' }[] = [
    { href: '#in', n: '1', title: 'AI 가 받은 것', who: '시스템 → AI', summary: `요청 1건 · 도구 조회 ${lookups.length}회 · 사실 ${a.facts.length}건` },
    { href: '#out', n: '2', title: 'AI 가 낸 것', who: 'AI', summary: `권고 ${a.recommendation.alternativeId}${rec ? ` ${rec.title}` : ''} + 문장` },
    {
      href: '#verify',
      n: '3',
      title: '검증',
      who: '규칙 코드',
      summary: `숫자 출처 ${a.provenance.ok ? '통과' : '위반'} · 현재 규칙과 ${run.basisCheck.ok ? '일치' : '불일치'}`,
      tone: verified ? 'ok' : 'bad',
    },
    {
      href: '#request',
      n: '4',
      title: '승인요청',
      who: '시스템 → 사람',
      summary: requests.length ? requests.map((r) => `${r.id} → ${ROLE_KO[r.requiredRole]}`).join(' · ') : '이 실행에서 만든 요청 없음',
    },
    {
      href: '#wait',
      n: '5',
      title: '사람 회신',
      who: '권한자 (사람)',
      summary: requests.length ? (waiting ? '회신 대기 — 기록은 여기까지' : requests.map((r) => APPROVAL_STATUS_KO[r.status]).join(' · ')) : '—',
    },
  ];

  return (
    <>
      <div className="rounded-lg border-2 border-indigo-900 bg-indigo-50 p-4" role="note" aria-label="이 화면의 표시 기준">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-indigo-950">
          <RecordedMark />
          <span data-testid="recorded-label">{run.label}</span>
        </p>
        <ul className="mt-2 grid gap-1 text-sm text-indigo-950 md:grid-cols-3">
          <li>
            <strong>{run.calledNow ? '지금 AI 를 호출함' : '지금 AI 를 호출하지 않음'}</strong> — 아래 내용은 {run.executedAtKst} (KST) 실제 호출 1회의 저장본입니다.
          </li>
          <li>
            <strong>{run.inOperationalState ? '운영 상태에 포함됨' : '운영 상태와 분리'}</strong> — 판단안 목록 · 승인함 · 처리 이력에 들어 있지 않고, 프리셋 재생 · 초기화에도 바뀌지 않습니다.
          </li>
          <li>
            <strong>`실시간` · `모의` 와 다름</strong> — 시연 중 새로 만드는 판단안은 헤더의 AI 모드(모의) 표시를 따릅니다.
          </li>
        </ul>
      </div>

      <nav aria-label="실행 흐름 — AI 입력에서 사람 회신까지">
        <ol className="grid gap-2 lg:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s.n} className="relative">
              <a
                href={s.href}
                className={cn(
                  'block h-full rounded-lg border bg-white p-3 shadow-xs hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  s.tone === 'bad' && 'border-red-500 bg-red-50',
                  s.tone === 'ok' && 'border-emerald-500',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="inline-flex size-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">{s.n}</span>
                  <span className="text-sm font-semibold">{s.title}</span>
                </span>
                <span className="mt-1 block text-[11px] text-zinc-600">{s.who}</span>
                <span className="mt-1 block text-xs text-zinc-900">{s.summary}</span>
              </a>
              {i < steps.length - 1 && <ArrowRight className="absolute top-1/2 -right-3 z-10 hidden size-4 -translate-y-1/2 text-zinc-500 lg:block" aria-hidden />}
            </li>
          ))}
        </ol>
      </nav>

      <Section title="실행 개요" id="run">
        <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
          <dt className="text-zinc-600">기록 ID</dt>
          <dd className="font-mono">{run.id}</dd>
          <dt className="text-zinc-600">실행 시각</dt>
          <dd>
            <span className="font-mono">{run.executedAtKst}</span> (KST) <span className="text-xs text-zinc-600">— 실제 시각. 시작 {run.executedAt} · 종료 {run.finishedAt} (UTC)</span>
          </dd>
          <dt className="text-zinc-600">모델</dt>
          <dd>
            <span className="font-mono">{run.model}</span>{' '}
            <span className="text-xs text-zinc-600">
              · {run.request.sdk} · thinking {run.request.thinking} · effort {run.request.effort} · max_tokens {run.request.maxTokens.toLocaleString('ko-KR')}
            </span>
          </dd>
          <dt className="text-zinc-600">호출 경로</dt>
          <dd className="text-xs">{run.scenario.invokedVia}</dd>
          <dt className="text-zinc-600">저장소 · 원본</dt>
          <dd className="font-mono text-xs">
            {run.scenario.persistence} · 원본 {run.scenario.rawSource}
          </dd>
          <dt className="text-zinc-600">판단 대상</dt>
          <dd className="font-mono">
            {a.subjectType} · {a.subjectIds.join(', ')}
          </dd>
          <dt className="text-zinc-600">가상 기준시각</dt>
          <dd>
            <span className="font-mono">{fmtDateTime(run.scenario.simNow)}</span> <span className="text-xs text-zinc-600">(시연용 가상 시각 — 실제 실행 시각과 다름)</span>
          </dd>
          <dt className="text-zinc-600">실행 전 재생한 사건</dt>
          <dd>
            <ol className="list-decimal space-y-0.5 pl-5 text-xs">
              {run.scenario.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </dd>
        </dl>
      </Section>

      <Section title={<StepTitle n="1" title="AI 가 받은 것" note="시스템 지시 · 요청 · 도구가 돌려준 근거" />} id="in" className="scroll-mt-24">
        <div className="space-y-3 text-sm">
          <div>
            <h4 className="mb-1 text-xs font-semibold text-zinc-700">사용자 요청 (그대로)</h4>
            <p className="rounded border bg-zinc-50 p-2">{run.request.user}</p>
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer underline">시스템 지시 전문</summary>
            <pre className="mt-1 max-h-72 overflow-auto rounded bg-zinc-50 p-2 text-[11px] whitespace-pre-wrap">{run.request.system}</pre>
          </details>
          <details className="text-xs">
            <summary className="cursor-pointer underline">AI 에게 준 도구 정의 ({run.request.tools.length}개) — 상태를 바꾸는 도구는 없음</summary>
            <ul className="mt-1 space-y-1">
              {run.request.tools.map((t) => (
                <li key={t.name} className="rounded border p-1.5">
                  <span className="font-mono font-semibold">{t.name}</span> {t.strict && <span className="rounded bg-zinc-100 px-1">strict</span>}
                  <p className="mt-0.5 text-zinc-700">{t.description}</p>
                </li>
              ))}
            </ul>
          </details>
          <div>
            <h4 className="mb-1 text-xs font-semibold text-zinc-700">AI 가 부른 조회 도구 {lookups.length}회 — 입력과 반환 요약 (원문은 접힘)</h4>
            <ToolCallList calls={lookups} />
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer underline">도구가 돌려준 사실 {a.facts.length}건 (출처 배지 포함)</summary>
            <div className="mt-2">
              <FactList facts={a.facts} />
            </div>
          </details>
          <details className="text-xs">
            <summary className="cursor-pointer underline">규칙 결과 {a.ruleResults.length}건 (규칙 코드 계산)</summary>
            <ul className="mt-1 space-y-1.5">
              {a.ruleResults.map((r, i) => (
                <li key={i} className="rounded border p-2">
                  <span className="font-mono font-semibold">{r.ruleId}</span> → <strong>{String(r.result)}</strong>
                  <pre className="mt-1 overflow-x-auto text-[11px] whitespace-pre-wrap text-zinc-600">{JSON.stringify(r.inputs)}</pre>
                </li>
              ))}
            </ul>
          </details>
          <details className="text-xs">
            <summary className="cursor-pointer underline">
              미확인 · 공백 {a.unknowns.length}건 · 주장 {a.claimsCited.length}건 (사실로 쓰지 않음)
            </summary>
            <div className="mt-2 space-y-2">
              <UnknownList unknowns={a.unknowns} compact />
              <ul className="space-y-1">
                {a.claimsCited.map((c) => (
                  <li key={c.text} className="flex flex-wrap items-start gap-1">
                    <SourceBadgeStatic label="CLAIM" /> {c.text} <span className="font-mono text-zinc-600">({c.ref.file})</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </Section>

      <Section title={<StepTitle n="2" title="AI 가 낸 것" note="권고 대안 하나와 문장 — 숫자 · 권한자 · 건별 권고는 규칙 코드" />} id="out" className="scroll-mt-24">
        <div className="space-y-3 text-sm">
          <div className="rounded-md border-2 border-blue-600 bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-900">AI 가 고른 권고 대안</p>
            <p className="mt-0.5 text-base font-semibold">
              {a.recommendation.alternativeId}
              {rec ? `. ${rec.title}` : ''} {rec && <span className="text-sm font-normal text-zinc-700">({decisionText(rec.decision)})</span>}
            </p>
            <p className="mt-2 flex items-start gap-2">
              <SentenceMark mock={false} /> <span>{a.recommendation.rationale}</span>
            </p>
          </div>
          <dl className="grid gap-2 md:grid-cols-2">
            {(
              [
                ['마케팅', a.perspectives.marketing],
                ['재무', a.perspectives.finance],
                ['계약', a.perspectives.contract],
                ['SCM', a.perspectives.scm],
              ] as const
            ).map(([k, t]) => (
              <div key={k} className="rounded border p-2">
                <dt className="text-xs font-semibold text-zinc-600">{k} 관점</dt>
                <dd className="flex items-start gap-1">
                  <SentenceMark mock={false} /> <span>{t}</span>
                </dd>
              </div>
            ))}
          </dl>
          {a.proposedDecisions && a.proposedDecisions.length > 0 && (
            <p className="text-xs text-zinc-700">
              규칙 엔진의 건별 권고(승인요청 권고안으로 쓰임 — AI 가 정하지 않음):{' '}
              {a.proposedDecisions.map((d) => (
                <span key={d.itemId} className="mr-2">
                  <span className="font-mono">{d.itemId}</span> <strong>{decisionText(d.decision)}</strong>
                </span>
              ))}
              <SourceBadgeStatic label="AGGREGATED" />
            </p>
          )}
          {a.alternatives.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer underline">대안 비교 {a.alternatives.length}개 (규칙 코드가 만든 선택지 — AI 는 이 안에서만 고름)</summary>
              <div className="mt-1">
                <AlternativesTable alternatives={a.alternatives} recommendedId={a.recommendation.alternativeId} />
              </div>
            </details>
          )}
          {submits.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer underline">AI 의 제출 호출 원문 ({SUBMIT_TOOL})</summary>
              <div className="mt-1">
                <ToolCallList calls={submits} />
              </div>
            </details>
          )}
          {a.aiTrace && a.aiTrace.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-zinc-700">
                모델 응답 추적 {a.aiTrace.length}회 — 마지막 종료 사유 <span className="font-mono">{a.stopReason ?? '—'}</span>
              </h4>
              <AiTraceTable trace={a.aiTrace} />
            </div>
          )}
        </div>
      </Section>

      <Section title={<StepTitle n="3" title="검증" note="AI 출력은 코드가 검사한 뒤에만 쓰인다" />} id="verify" className="scroll-mt-24">
        <ul className="space-y-2 text-sm">
          <CheckRow ok={a.provenance.ok} title={`숫자 출처 검증 ${a.provenance.ok ? '통과' : '위반'}`} testId="recorded-provenance">
            {a.provenance.ok ? (
              'AI 문장에 나온 숫자가 모두 도구가 돌려준 사실 · 규칙 결과에 있습니다. 주장 숫자는 문장에 없습니다. (지금 다시 검사한 결과)'
            ) : (
              <ul className="list-disc pl-4">
                {a.provenance.violations.map((v, i) => (
                  <li key={i}>
                    <span className="font-mono">{v.field}</span> 의 <span className="font-mono">{v.token}</span> — {VIOLATION_KO[v.reason] ?? v.reason}
                  </li>
                ))}
              </ul>
            )}
          </CheckRow>
          <CheckRow ok={run.basisCheck.ok} title={`현재 규칙 계산과 ${run.basisCheck.ok ? '일치' : '불일치'}`} testId="recorded-basis">
            {run.basisCheck.ok ? (
              <>
                같은 입력(<span className="font-mono">{run.basisCheck.replayedSteps}</span>)을 지금 규칙 코드로 다시 계산한 근거(사실 · 규칙 결과 · 대안 · 미확인 · 건별 권고 · 주장)가 기록과 같습니다.
              </>
            ) : (
              <>
                <p className="font-semibold">
                  <AlertTriangle className="mr-1 inline size-4" aria-hidden />이 기록은 지금의 원본 · 규칙과 맞지 않습니다 — 기록의 숫자를 현재 판단 근거로 쓰지 마세요.
                </p>
                <p>
                  다시 계산한 입력: <span className="font-mono">{run.basisCheck.replayedSteps}</span>. 달라진 항목:
                </p>
                <ul className="list-disc pl-4 font-mono">
                  {run.basisCheck.mismatches.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <p>다음 행동: 백엔드 담당에게 기록을 다시 만들지(실제 호출 1회) 확인합니다.</p>
              </>
            )}
          </CheckRow>
          <CheckRow ok={!a.fallbackReason} title={a.fallbackReason ? '모의 대체 있음' : '모의 대체 없음'}>
            {a.fallbackReason ? `대체 사유: ${a.fallbackReason}` : '실제 호출 결과가 거절 · 실패 없이 제출됐습니다 (대체 사유 기록 없음).'}
          </CheckRow>
          {a.warnings.length > 0 && (
            <li className="rounded border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
              {a.warnings.map((w) => (
                <span key={w} className="block">
                  {w}
                </span>
              ))}
            </li>
          )}
        </ul>
      </Section>

      <Section
        title={<StepTitle n="4" title="승인요청" note="AI 가 아니라 시스템(규칙)이 권한자를 정해 만든다" />}
        id="request"
        className="scroll-mt-24"
        actions={<CopyMark />}
      >
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">이 실행에서 만들어진 승인요청이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="rounded-md border border-dashed border-indigo-400 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{r.id}</span>
                  <span className="text-xs text-zinc-600">v{r.version}</span>
                  <ArrowRight className="size-4 text-zinc-500" aria-hidden />
                  <RoleChip role={r.requiredRole} />
                  <ApprovalStatusBadge status={r.status} />
                  <span className="text-xs text-zinc-600">(그 실행 당시 상태)</span>
                </div>
                <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-1 text-xs">
                  <dt className="text-zinc-600">대상</dt>
                  <dd className="font-mono">
                    {r.subjectType} · {r.subjectIds.join(', ')}
                  </dd>
                  <dt className="text-zinc-600">권고안</dt>
                  <dd>
                    {r.proposed.map((p) => (
                      <span key={p.itemId} className="mr-2">
                        <span className="font-mono">{p.itemId}</span> <strong>{decisionText(p.decision)}</strong>
                      </span>
                    ))}
                    <SourceBadgeStatic label="AGGREGATED" />
                  </dd>
                  <dt className="text-zinc-600">근거 판단안</dt>
                  <dd className="font-mono">{r.assessmentId ?? '—'} (이 기록의 판단안)</dd>
                  <dt className="text-zinc-600">권한 근거</dt>
                  <dd>
                    <ul className="space-y-0.5">
                      {r.routingReasons.map((x) => (
                        <li key={x.ruleId + x.text} className="flex flex-wrap items-start gap-1">
                          <span className="font-mono">{x.ruleId}</span> <SourceBadgeStatic label={x.label} /> <span>{x.text}</span>
                        </li>
                      ))}
                    </ul>
                  </dd>
                  <dt className="text-zinc-600">기한</dt>
                  <dd>
                    원본 기한 <span className="font-mono">{r.hardDeadline}</span> <SourceBadgeStatic label="ORIGINAL" /> · 내부 기한 <span className="font-mono">{fmtDateTime(r.internalDueAt)}</span> <SourceBadgeStatic label="ASSUMPTION" /> A-12
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-zinc-600">사본입니다 — 지금 승인함의 같은 ID 요청과는 관계가 없어 연결하지 않습니다. 현재 요청은 승인함에서 봅니다.</p>
      </Section>

      <Section title={<StepTitle n="5" title="사람 회신" note="결정은 권한자(사람)만 한다" />} id="wait" className="scroll-mt-24" actions={<CopyMark />}>
        <div className="space-y-3 text-sm">
          {requests.length > 0 && (
            <p className={cn('rounded-md border p-2', waiting ? 'border-amber-400 bg-amber-50 text-amber-950' : 'border-zinc-300 bg-zinc-50')}>
              {waiting ? (
                <>
                  <strong>권한자 회신 대기에서 기록이 끝납니다.</strong> 이 실행은 승인요청을 {requests.map((r) => ROLE_KO[r.requiredRole]).join(' · ')}에게 올린 데까지이고, 회신(승인 · 반려)과 그 뒤 상태 변경은 이 기록에 없습니다. AI 는 요청을 승인하거나 상태를 바꾸지 못합니다.
                </>
              ) : (
                <>기록 당시 요청 상태: {requests.map((r) => `${r.id} ${APPROVAL_STATUS_KO[r.status]}`).join(' · ')}</>
              )}
            </p>
          )}
          <div>
            <h4 className="mb-1 text-xs font-semibold text-zinc-700">그 실행의 처리 이력 사본 ({run.followUp.audit.length}행)</h4>
            <AuditTable rows={run.followUp.audit} copy empty="기록된 처리 이력이 없습니다." />
          </div>
          <p className="text-xs text-zinc-700">
            회신부터 상태 변경 · 다음 판단 반영까지는 운영 화면에서 이어집니다:{' '}
            <Link href="/scenarios" className="underline">
              시연 시나리오
            </Link>{' '}
            ·{' '}
            <Link href="/approvals" className="underline">
              승인함
            </Link>{' '}
            ·{' '}
            <Link href="/history" className="underline">
              처리 이력
            </Link>{' '}
            (현재 운영 상태 — 이 기록과 별개).
          </p>
        </div>
      </Section>
    </>
  );
}

function StepTitle({ n, title, note }: { n: string; title: string; note: string }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">{n}</span>
      {title}
      <span className="text-xs font-normal text-zinc-600">{note}</span>
    </span>
  );
}

function CopyMark() {
  return <span className="inline-flex h-5 items-center rounded border border-dashed border-indigo-500 bg-white px-1.5 text-[11px] font-medium text-indigo-900">그 실행 당시의 사본</span>;
}

function CheckRow({ ok, title, children, testId }: { ok: boolean; title: string; children: React.ReactNode; testId?: string }) {
  return (
    <li className={cn('flex items-start gap-2 rounded-md border p-2', ok ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-red-400 bg-red-50 text-red-900')} role={ok ? undefined : 'alert'} data-testid={testId}>
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">{title}</p>
        <div className="text-xs">{children}</div>
      </div>
    </li>
  );
}
