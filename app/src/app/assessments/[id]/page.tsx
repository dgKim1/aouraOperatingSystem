/** S-05 판단안 — 무엇을 받아 어떤 판단을 지원했는지. 사실 · 규칙 결과 · 대안 · 관점 · 미확인 · 주장을 나눠 보여준다 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClaimsFold } from '@/components/badges/fold';
import { SourceBadge, SourceBadgeStatic } from '@/components/badges/source-badge';
import { MoneyValue, NumValue, TextValue, UnknownChip } from '@/components/badges/values';
import { PageHeader, RoleChip, Section, StubNotice } from '@/components/common';
import { fmtDateTime } from '@/components/format';
import { decisionText } from '@/components/labels';
import { Button } from '@/components/ui/button';
import type { Sourced } from '@/domain/types';
import { cn } from '@/lib/utils';
import { getAssessment } from '../../_data/views';

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
  const a = await getAssessment(decodeURIComponent(id));
  if (!a) notFound();
  return (
    <div className="space-y-4">
      <PageHeader id="S-05" title={`판단안 ${a.id}`} decision="권한자 · 담당자가 근거(사실 · 규칙 결과) · 대안 · 불확실성을 보고 승인 요청으로 넘길지, 다시 판단할지 정합니다.">
        <span className="inline-flex h-6 items-center rounded border border-dashed border-zinc-600 px-2 text-xs font-semibold">AI: {a.aiMode === 'MOCK' ? '모의' : '실시간'}</span>
      </PageHeader>
      <StubNotice>{a.stubNote}</StubNotice>

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
              <li key={f.name} className="flex flex-wrap items-center gap-2">
                <span className="w-56 text-zinc-700">{f.name}</span>
                <FactValue v={f.value} />
              </li>
            ))}
          </ul>
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer underline">도구 호출 목록</summary>
            <p className="mt-1 text-muted-foreground">도구명 · 입력 · 반환값은 2단계 AI 에이전트 연결 후 표시됩니다.</p>
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
          <SourceBadgeStatic label="MOCK" /> {a.recommendation.rationale}
        </p>
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
                <SourceBadgeStatic label="MOCK" /> {t}
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

      <div className="flex flex-wrap gap-2">
        <Button disabled title="2단계 API 연결 후 활성">
          승인 요청 만들기
        </Button>
        <Button variant="outline" disabled title="2단계 API 연결 후 활성">
          다시 판단
        </Button>
        <Link href="/approvals" className="inline-flex items-center text-sm underline">
          승인함으로
        </Link>
      </div>
    </div>
  );
}
