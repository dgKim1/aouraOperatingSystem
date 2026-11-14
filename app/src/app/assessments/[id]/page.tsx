/** S-05 판단안 — 무엇을 받아 어떤 판단을 지원했는지. 사실 · 규칙 결과 · 대안 · 관점 · 미확인 · 주장을 나눠 보여준다 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClaimsFold } from '@/components/badges/fold';
import { AiTraceTable, AlternativesTable, FactList, RecordedMark, SentenceMark, ToolCallList, UnknownList } from '@/components/assessment/parts';
import { SourceBadgeStatic } from '@/components/badges/source-badge';
import { InlineWarning } from '@/components/alerts/alert-item';
import { PageHeader, Section } from '@/components/common';
import { fmtDateTime } from '@/components/format';
import { decisionText } from '@/components/labels';
import { AssessButton, RequestApprovalButton } from '@/components/mutation/assessment-actions';
import { cn } from '@/lib/utils';
import { getAssessment, getMeta, getSession } from '../../_data/views';

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, meta, { role }] = await Promise.all([getAssessment(decodeURIComponent(id)), getMeta(), getSession()]);
  if (!a) notFound();
  return (
    <div className="space-y-4">
      <PageHeader id="S-05" title={`판단안 ${a.id}`} decision="권한자 · 담당자가 근거(사실 · 규칙 결과) · 대안 · 불확실성을 보고 승인 요청으로 넘길지, 다시 판단할지 정합니다.">
        {a.mock ? (
          <span className="inline-flex h-6 items-center rounded border border-dashed border-zinc-600 px-2 text-xs font-semibold">AI: 모의</span>
        ) : (
          <span className="inline-flex h-6 items-center rounded bg-emerald-600 px-2 text-xs font-semibold text-white">AI: 실시간</span>
        )}
        <span className={cn('inline-flex h-6 items-center rounded px-2 text-xs', a.provenance.ok ? 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-300' : 'bg-red-50 text-red-900 ring-1 ring-red-300')}>
          숫자 출처 검증 {a.provenance.ok ? '통과' : '위반'}
        </span>
      </PageHeader>
      {a.fallbackReason && <InlineWarning>실시간 호출 실패 → 모의로 생성: {a.fallbackReason}</InlineWarning>}
      {a.stopReason === 'refusal' && <InlineWarning tone="danger">AI 가 판단안 작성을 거절했습니다 — 규칙 결과만 표시합니다 (숫자 · 권한자는 규칙 엔진 값 그대로).</InlineWarning>}
      {a.warnings.length > 0 && (
        <InlineWarning tone="info">
          {a.warnings.map((w) => (
            <span key={w} className="block">
              {w}
            </span>
          ))}
        </InlineWarning>
      )}

      <Section title="헤더" id="h">
        <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
          <dt className="text-zinc-600">대상</dt>
          <dd className="font-mono">
            {a.subjectType} · {a.subjectIds.join(', ')}
          </dd>
          <dt className="text-zinc-600">트리거 사건</dt>
          <dd className="font-mono">{a.triggerEventId ?? '-'}</dd>
          <dt className="text-zinc-600">버전 · 생성</dt>
          <dd>
            v{a.version} · {fmtDateTime(a.createdAt)} (가상)
          </dd>
          <dt className="text-zinc-600">AI 모드 · 모델</dt>
          <dd>
            {a.aiMode === 'MOCK' ? '모의' : '실시간'} · {a.model}
          </dd>
        </dl>
      </Section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="확인한 사실 (도구 반환값)" id="facts">
          <FactList facts={a.facts} />
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer underline">도구 호출 목록 ({a.toolCalls.length})</summary>
            <div className="mt-1">
              <ToolCallList calls={a.toolCalls} />
            </div>
          </details>
          {a.aiTrace && a.aiTrace.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer underline">실시간 호출 추적 — 모델 응답 {a.aiTrace.length}회</summary>
              <div className="mt-1">
                <AiTraceTable trace={a.aiTrace} />
              </div>
            </details>
          )}
        </Section>
        <Section title="규칙 결과" id="rules">
          <ul className="space-y-1.5 text-sm">
            {a.ruleResults.map((r, i) => (
              <li key={i} className="rounded border p-2">
                <span className="font-mono text-xs font-semibold">{r.ruleId}</span> → <strong>{String(r.result)}</strong>
                <pre className="mt-1 overflow-x-auto text-[11px] whitespace-pre-wrap text-zinc-600">{JSON.stringify(r.inputs)}</pre>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {a.alternatives.length > 0 && (
        <Section title="대안 비교" id="alts">
          <AlternativesTable alternatives={a.alternatives} recommendedId={a.recommendation.alternativeId} />
        </Section>
      )}

      <Section title="권고와 이유" id="rec">
        <p className="flex flex-wrap items-start gap-2 text-sm">
          <SentenceMark mock={a.mock} /> {a.recommendation.rationale}
        </p>
        {a.proposedDecisions && a.proposedDecisions.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-sm">
            {a.proposedDecisions.map((d) => (
              <li key={d.itemId}>
                <span className="font-mono text-xs">{d.itemId}</span> 권고 <strong>{decisionText(d.decision)}</strong>
                {d.condition && <span className="text-xs text-amber-800"> · 조건: {d.condition}</span>}
                <SourceBadgeStatic label="AGGREGATED" className="ml-1" />
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-zinc-600">건별 권고 · 권한자는 규칙 엔진 결과(AI 가 정하지 않음). AI 는 대안 설명 문장만 씁니다.</p>
      </Section>

      <Section title="관점별 근거" id="persp">
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          {(
            [
              ['마케팅', a.perspectives.marketing],
              ['재무', a.perspectives.finance],
              ['계약', a.perspectives.contract],
              ['SCM', a.perspectives.scm],
            ] as const
          ).map(([k, t]) => (
            <div key={k} className="rounded border p-2">
              <dt className="text-xs font-semibold text-zinc-600">{k}</dt>
              <dd className="flex items-start gap-1">
                <SentenceMark mock={a.mock} /> {t}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="미확인 · 공백" id="unknowns">
        <UnknownList unknowns={a.unknowns} />
        <p className="mt-2 text-xs text-zinc-600">
          상태는 <Link href="/data?tab=gaps" className="underline">데이터 출처 · 공백</Link> 과 같은 판정입니다. 모의 회신으로 보완된 항목도 원본 공백은 그대로라 목록에 남습니다.
        </p>
      </Section>

      <ClaimsFold>
        <ul className="list-disc space-y-1 pl-5">
          {a.claimsCited.map((c) => (
            <li key={c.text}>
              {c.text} <span className="text-xs text-purple-800">({c.ref.file})</span>
            </li>
          ))}
        </ul>
      </ClaimsFold>

      <Section title="다음 행동" id="next">
        <div className="space-y-3">
          {a.approvalRequestIds.length > 0 ? (
            <p className="text-sm">
              이 판단안으로 만든 승인요청:{' '}
              {a.approvalRequestIds.map((r) => (
                <Link key={r} href={`/approvals/${r}`} className="mr-2 font-mono underline">
                  {r}
                </Link>
              ))}
            </p>
          ) : (
            <RequestApprovalButton assessmentId={a.id} actorRole={role.actorRole} />
          )}
          <AssessButton subjectType={a.subjectType} subjectIds={a.subjectIds} label="다시 판단" aiMode={meta.aiMode} variant="outline" showRequestNext={false} actorRole={role.actorRole} />
          <Link href="/approvals" className="inline-flex items-center text-sm underline">
            승인함으로 (현재 역할 {role.label})
          </Link>
          <p className="flex flex-wrap items-center gap-2 text-xs text-zinc-700">
            <RecordedMark className="h-5 px-1.5 text-[11px]" />
            <Link href="/assessments/recorded" className="underline">
              실제 Claude 로 만든 판단안의 실행 기록 보기
            </Link>
            <span>— AI 가 받은 입력 · 낸 출력 · 이어진 승인요청 (지금 호출하지 않음)</span>
          </p>
        </div>
      </Section>
    </div>
  );
}
