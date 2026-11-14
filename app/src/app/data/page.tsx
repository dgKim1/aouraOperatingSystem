/** S-12 데이터 출처 · 가정 · 공백 — 완료 조건 5(원본과 가정 구분)의 단일 증거 화면 */
import { SourceBadgeStatic } from '@/components/badges/source-badge';
import { PageHeader, Section } from '@/components/common';
import { TabLinks } from '@/components/tab-links';
import { cn } from '@/lib/utils';
import { getRegistry } from '../_data/views';

const TABS = [
  { id: 'sources', label: '원본 파일' },
  { id: 'assumptions', label: '가정 A-xx' },
  { id: 'gaps', label: '공백 G-xx' },
  { id: 'claims', label: '주장' },
  { id: 'mocks', label: '모의 회신' },
  { id: 'inconsistencies', label: '원본 불일치' },
];

export default async function DataPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tab = typeof sp.tab === 'string' && TABS.some((t) => t.id === sp.tab) ? sp.tab : 'sources';
  const r = await getRegistry();
  return (
    <div className="space-y-4">
      <PageHeader id="S-12" title="데이터 출처 · 가정 · 공백" decision="화면의 각 값이 원본인지 · 계산인지 · 가정인지 · 주장인지 · 모의인지 확인합니다." />
      <TabLinks base="/data" tabs={TABS} current={tab} />
      <Section title={TABS.find((t) => t.id === tab)!.label} id="d">
        {tab === 'sources' && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-600"><tr className="border-b"><th className="p-1.5 font-medium">파일 (04_원본데이터)</th><th className="p-1.5 font-medium">행 수</th><th className="p-1.5 font-medium">스케일</th><th className="p-1.5 font-medium">라벨</th><th className="p-1.5 font-medium">쓰는 곳</th></tr></thead>
            <tbody>
              {r.sources.map((s) => (
                <tr key={s.file} className="border-b last:border-0">
                  <td className="p-1.5 font-mono text-xs">{s.file}</td>
                  <td className="p-1.5 tabular-nums">{s.rows.toLocaleString('ko-KR')}</td>
                  <td className="p-1.5 text-xs">{s.scale}</td>
                  <td className="p-1.5"><SourceBadgeStatic label={s.label} /></td>
                  <td className="p-1.5 text-xs">{s.usedIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === 'assumptions' && (
          <ul className="space-y-1 text-sm">
            {r.assumptions.map((a) => (
              <li key={a.id} id={a.id} className="grid grid-cols-[4rem_1fr] gap-2 border-b py-1 target:bg-orange-50 last:border-0">
                <span className="font-mono"><SourceBadgeStatic label="ASSUMPTION" /> {a.id}</span>
                <span>{a.text} <span className="text-xs text-zinc-600">— {a.reason} · {a.usedIn}</span></span>
              </li>
            ))}
          </ul>
        )}
        {tab === 'gaps' && (
          <ul className="space-y-1 text-sm">
            {r.gaps.map((g) => (
              <li key={g.id} id={g.id} className="grid grid-cols-[4rem_1fr_11rem] gap-2 border-b py-1 target:bg-zinc-100 last:border-0">
                <span className="font-mono">{g.id}</span>
                <span>{g.text} <span className="text-xs text-zinc-600">({g.link}) — 처리: {g.handling}</span></span>
                <GapStatusCell g={g} />
              </li>
            ))}
          </ul>
        )}
        {tab === 'claims' && (
          <ul className="space-y-1 text-sm">
            {r.claims.map((c) => (
              <li key={c.text} className="flex flex-wrap items-start gap-2 border-b py-1 last:border-0"><SourceBadgeStatic label="CLAIM" /> {c.text} <span className="font-mono text-xs text-zinc-600">{c.ref.file}{c.ref.column ? ` · ${c.ref.column}` : ''}</span></li>
            ))}
          </ul>
        )}
        {tab === 'mocks' && (
          <ul className="space-y-1 text-sm">
            {r.mocks.map((m, i) => (
              <li key={`${m.key}-${i}`} className="flex items-center gap-2 border-b py-1 last:border-0">
                <SourceBadgeStatic label="MOCK" /> <span className="font-mono text-xs">{m.key}</span>
                <span className={cn('text-xs font-medium', ['REJECTED', 'INSUFFICIENT', 'INFO_REQUESTED'].includes(m.outcome) && 'text-red-800')}>{m.outcome}</span>
              </li>
            ))}
            <li className="pt-1 text-xs text-zinc-600">거절(REJECTED) · 정보 부족(INSUFFICIENT · INFO_REQUESTED) 회신을 포함합니다 (CLAUDE.md 규칙 7).</li>
          </ul>
        )}
        {tab === 'inconsistencies' && (
          <ul className="space-y-2 text-sm">
            {r.inconsistencies.map((x) => (
              <li key={x.topic} className="rounded border p-2"><p className="font-medium">{x.topic}</p><p className="text-xs text-zinc-700">처리: {x.handling}</p></li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/** FE-10 공백 상태 2종 — 서버 status · statusText 그대로. OPEN = "미확인" 칩, FILLED_BY_MOCK = 모의 배지 + 서버 문구. "해소"는 쓰지 않는다 */
function GapStatusCell({ g }: { g: { status: 'OPEN' | 'FILLED_BY_MOCK'; statusText: string } }) {
  if (g.status === 'OPEN') return <span className="inline-flex h-5 w-fit items-center self-start rounded border border-dashed border-zinc-400 bg-zinc-50 px-1.5 text-[11px] font-medium text-zinc-700">{g.statusText || '미확인'}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[11px] font-medium text-zinc-800">
      <SourceBadgeStatic label="MOCK" /> {g.statusText}
    </span>
  );
}
