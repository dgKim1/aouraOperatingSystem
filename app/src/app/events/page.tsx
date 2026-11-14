/** S-02 사건 입력 — 시스템의 입력 지점. 원본 문서 접수와 모의 사건 · 회신을 같은 방식으로 넣는다 */
import { PageHeader, Section } from '@/components/common';
import { AssessButton } from '@/components/mutation/assessment-actions';
import { getMeta, getOverview, getProposal } from '../_data/views';
import { EventForms } from './event-forms';

export default async function EventsPage() {
  const [meta, o, p] = await Promise.all([getMeta(), getOverview(), getProposal('PROP-2026-07')]);
  const lines = (p?.lines ?? []).map((l) => ({ id: l.id, text: `${l.id} · ${l.influencerName} · 집행 ${l.settlementDate} · ${l.statusText}` }));
  // 판단안 대상 후보: 서버가 정한 상태 문구 기준 "결정 전" 건 (기한 묶음별)
  const groups = p?.summary?.groups ?? [];
  const openLines = (p?.lines ?? []).filter((l) => l.status === 'VALIDATED' || l.status === 'REAPPROVAL_REQUIRED' || l.status === 'RECEIVED');
  return (
    <div className="space-y-4">
      <PageHeader id="S-02" title="사건 입력" decision="통보 · 기안 접수와 조건 변경 · 외부 회신(모의)을 넣고, 그 결과 상태 변경 · 권한자 변경 · 새 판단안 필요 여부를 확인합니다." />
      <EventForms contractId={o.contract.id} contractStatusText={o.contract.statusText} received={!!p?.received} lines={lines} aiMode={meta.aiMode} today={meta.simNow.slice(0, 10)} />

      <Section title="AI 판단안 만들기 (대상 선택)" id="assess">
        <p className="mb-2 text-xs text-zinc-600">숫자 · 권한자 · 건별 권고는 규칙 엔진이 계산하고, AI 는 대안 설명 문장만 씁니다. 실시간 호출이 실패하면 모의로 대체되고 판단안에 이유가 표시됩니다.</p>
        <div className="space-y-3">
          <AssessButton subjectType="CONTRACT" subjectIds={[o.contract.id]} label={`계약 ${o.contract.id} 판단안`} aiMode={meta.aiMode} variant="outline" />
          {groups.map((g) => {
            const ids = openLines.filter((l) => l.contractDeadline === g.deadline).map((l) => l.id);
            return (
              <AssessButton
                key={g.deadline}
                subjectType="EXPANSION_LINES"
                subjectIds={ids}
                label={`확정기한 ${g.deadline} 묶음 판단안`}
                aiMode={meta.aiMode}
                variant="outline"
                disabledReason={ids.length === 0 ? '결정 전(확인 완료 · 재승인 필요) 건 없음' : null}
              />
            );
          })}
          {!p?.received && <p className="text-sm text-muted-foreground">기안이 접수되지 않아 기안 판단안 대상이 없습니다.</p>}
        </div>
      </Section>
    </div>
  );
}
