/** S-02 사건 입력 — 시스템의 입력 지점. 원본 문서 접수와 모의 사건 · 회신을 같은 방식으로 넣는다 */
import { SourceBadgeStatic } from '@/components/badges/source-badge';
import { PageHeader, Section, StubNotice } from '@/components/common';
import { Button } from '@/components/ui/button';
import type { SourceLabel } from '@/domain/types';

const FORMS: { title: string; label: SourceLabel; fields: { id: string; name: string; type: string; placeholder?: string; options?: string[] }[] }[] = [
  { title: '갱신 통보 접수', label: 'ORIGINAL', fields: [{ id: 'contract', name: '계약', type: 'select', options: ['CTR-INF-001-2026 (inf001_exclusive_contract_notice.md)'] }] },
  { title: '확대 기안 접수', label: 'ORIGINAL', fields: [{ id: 'proposal', name: '기안', type: 'select', options: ['PROP-2026-07 (mkt_budget_plan_ms.csv, 25건)'] }, { id: 'range', name: '건 범위', type: 'select', options: ['전체', '2026-07-17 마감', '2026-08-14 마감', '2026-09-11 마감'] }] },
  { title: '회수 지연 통보', label: 'MOCK', fields: [{ id: 'ar', name: 'AR', type: 'text', placeholder: 'MAR-0004' }, { id: 'due', name: '새 만기일', type: 'date' }] },
  { title: '기안 조건 정정', label: 'MOCK', fields: [{ id: 'line', name: '건', type: 'text', placeholder: 'PLAN-004' }, { id: 'amount', name: '요청액 (원)', type: 'number' }, { id: 'date', name: '집행일', type: 'date' }] },
  { title: '외부 회신', label: 'MOCK', fields: [{ id: 'from', name: '상대', type: 'select', options: ['에이전시', 'SCM', 'Corevia'] }, { id: 'result', name: '결과', type: 'select', options: ['수령확인', '정보 제공', '정보 부족', '거절'] }, { id: 'body', name: '본문', type: 'text' }] },
];

export default function EventsPage() {
  return (
    <div className="space-y-4">
      <PageHeader id="S-02" title="사건 입력" decision="통보 · 기안 접수와 조건 변경 · 외부 회신(모의)을 넣고, 그 결과 상태 변경 · 권한자 변경 · 새 판단안 필요 여부를 확인합니다." />
      <StubNotice>입력 제출(POST /api/events)과 [AI 판단안 만들기]는 2단계 API 연결 후 활성화됩니다. 지금은 상단 「시점 이동」의 시연 프리셋으로 각 사건 이후 상태를 볼 수 있습니다.</StubNotice>
      <div className="grid gap-4 lg:grid-cols-2">
        {FORMS.map((f) => (
          <Section key={f.title} title={<span className="inline-flex items-center gap-2">{f.title} <SourceBadgeStatic label={f.label} /></span>} id={`f-${f.title}`}>
            <form className="space-y-2">
              {f.fields.map((fl) => {
                const fid = `${f.title}-${fl.id}`;
                return (
                  <div key={fl.id} className="grid grid-cols-[7rem_1fr] items-center gap-2 text-sm">
                    <label htmlFor={fid} className="text-zinc-700">{fl.name}</label>
                    {fl.type === 'select' ? (
                      <select id={fid} disabled className="h-8 rounded border bg-zinc-50 px-2">
                        {fl.options!.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input id={fid} type={fl.type} placeholder={fl.placeholder} disabled className="h-8 rounded border bg-zinc-50 px-2" />
                    )}
                  </div>
                );
              })}
              <Button size="sm" disabled title="2단계 API 연결 후 활성">접수 (API 연결 전)</Button>
            </form>
          </Section>
        ))}
      </div>
      <Section title="처리 결과 요약" id="result">
        <p className="text-sm text-muted-foreground">제출 후 상태 변경 n건 · 생성된 작업 n건 · 권한자 변경 n건 · 새 판단안 필요 여부가 링크와 함께 여기에 표시됩니다.</p>
        <Button size="sm" variant="outline" className="mt-2" disabled title="2단계 API 연결 후 활성">AI 판단안 만들기 <span className="ml-1 rounded border border-dashed px-1 text-[10px]">모의</span></Button>
      </Section>
    </div>
  );
}
