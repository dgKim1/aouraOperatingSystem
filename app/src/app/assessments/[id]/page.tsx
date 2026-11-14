/** S-05 판단안 — 무엇을 받아 어떤 판단을 지원했는지. 사실 · 규칙 결과 · 대안 · 관점 · 미확인 · 주장을 나눠 보여준다 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClaimsFold } from '@/components/badges/fold';
import { SourceBadge, SourceBadgeStatic } from '@/components/badges/source-badge';
import { MoneyValue, NumValue, TextValue, UnknownChip } from '@/components/badges/values';
import { InlineWarning } from '@/components/alerts/alert-item';
import { PageHeader, RoleChip, Section } from '@/components/common';
import { fmtDateTime } from '@/components/format';
import { decisionText } from '@/components/labels';
import { AssessButton, RequestApprovalButton } from '@/components/mutation/assessment-actions';
import type { Sourced } from '@/domain/types';
import { cn } from '@/lib/utils';
import { getAssessment, getMeta, getSession } from '../../_data/views';

function FactValue({ v }: { v: Sourced<unknown> }) {
  if (typeof v.value === 'number') {
    if (v.scale === 'FULL' || v.scale === 'SAMPLE') return <MoneyValue m={{ ...v, value: v.value, scale: v.scale }} />;
    const isRatio = v.value > -1 && v.value < 1 && !Number.isInteger(v.value);
    return <NumValue n={{ ...v, value: v.value }} format={isRatio ? 'pct2' : 'int'} />;
  }
  return <TextValue t={{ ...v, value: String(v.value) }} />;
}

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
          <ul className="space-y-1.5 text-sm">
            {a.facts.map((f) => (
              <li key={f.key} className="flex flex-wrap items-center gap-2">
                <span className="w-56 text-zinc-700">{f.name}</span>
                <FactValue v={f.value} />
              </li>
            ))}
          </ul>
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer underline">도구 호출 목록 ({a.toolCalls.length})</summary>
            {a.toolCalls.length === 0 ? (
              <p className="mt-1 text-muted-foreground">기록된 도구 호출이 없습니다.</p>
            ) : (
              <ol className="mt-1 space-y-1">
                {a.toolCalls.map((t, i) => (
                  <li key={`${t.name}-${i}`} className="rounded border p-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold">{t.name}</span>
                      <span className={t.actor === 'AI' ? 'rounded bg-emerald-100 px-1' : 'rounded border border-dashed border-zinc-500 px-1'}>{t.actor === 'AI' ? 'AI (모델 호출)' : '시스템 (모의 모드 코드 실행)'}</span>
                    </div>
                    <details>
                      <summary className="cursor-pointer text-zinc-600">입력 · 반환</summary>
                      <pre className="mt-1 max-h-48 overflow-auto rounded bg-zinc-50 p-1 text-[10px] whitespace-pre-wrap">입력 {JSON.stringify(t.input, null, 1)}</pre>
                      <pre className="mt-1 max-h-48 overflow-auto rounded bg-zinc-50 p-1 text-[10px] whitespace-pre-wrap">반환 {JSON.stringify(t.output, null, 1)}</pre>
                    </details>
                  </li>
                ))}
              </ol>
            )}
          </details>
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
                {a.alternatives.map((alt) => {
                  const rec = alt.id === a.recommendation.alternativeId;
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
        <ul className="space-y-1 text-sm">
          {a.unknowns.map((u) => (
            <li key={u.gapId} className="flex flex-wrap items-center gap-2">
              <UnknownChip gapId={u.gapId} /> {u.impact}
            </li>
          ))}
        </ul>
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
        </div>
      </Section>
    </div>
  );
}

/**
 * AI 가 쓴 문장 표지 (FE-12, ONTOLOGY 0절). 모의 모드는 `모의` 배지, 실시간은 출처 배지가 아닌 「AI 작성」 표지 —
 * 문장은 값이 아니므로 원본근거해석 배지를 달지 않는다. 문장 속 숫자의 출처는 사실 표의 배지와 숫자 출처 검증으로 보인다.
 */
function SentenceMark({ mock }: { mock: boolean }) {
  if (mock) return <SourceBadgeStatic label="MOCK" />;
  return (
    <span className="inline-flex h-5 items-center rounded border border-zinc-400 bg-white px-1.5 text-[11px] font-medium text-zinc-800" title="AI 가 쓴 문장 — 출처 값이 아님. 숫자 출처는 사실 표와 숫자 출처 검증 참고">
      AI 작성
    </span>
  );
}
