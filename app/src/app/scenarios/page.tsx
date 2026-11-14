/** S-13 시연 시나리오 — ①~④ 를 같은 결과로 재현. 1단계는 도메인 재생 프리셋(모의, 저장 안 함) */
import { PageHeader, Section, StubNotice } from '@/components/common';
import { getSession } from '../_data/views';
import { PRESETS } from '../_data/world';
import { PresetButton } from './preset-button';

const GROUPS = [
  { s: '①', title: '① 정상', goal: '7/17 마감 계약 · 기안 5건을 기한 전에 권한자에게 올려 처리 → 7/18 자동 갱신 · 자동 확정 없음' },
  { s: '②', title: '② 조건 변경', goal: '회수 지연으로 하회 구간 7/21~8/21 → 7/21~8/28, PLAN-004 · 024 권한자 그룹 CEO/이사회로 상향 · 재승인' },
  { s: '③', title: '③ 정보 부족 · 거절', goal: '계약 반려 → 기한 전 재검토 · 에이전시 정보 부족 → (B) 방치 시 자동 갱신 · 위약금' },
  { s: '④', title: '④ 확장 · 부서 영향', goal: 'PLAN-011 더마 재고 게이트 → 조건부(집행일 조정) · 보충 요청(covenant 구간이면 그룹 CEO/이사회)' },
];

export default async function ScenariosPage() {
  const { presetId } = await getSession();
  return (
    <div className="space-y-4">
      <PageHeader id="S-13" title="시연 시나리오" decision="시연할 상황의 시작 지점으로 이동하고, 다음 행동과 기대 결과를 확인합니다." />
      <StubNotice>프리셋은 DEMO_SCENARIOS 의 사건을 규칙 엔진으로 재생한 읽기 전용 상태입니다(모의). 초기화 후 재생 · 전체 초기화 · 수용 기준 자동 점검(✓/✗)은 2단계 API(/api/scenarios/:id/reset · check) 연결 후.</StubNotice>
      <div className="grid gap-4 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <Section key={g.s} title={g.title} id={`sc-${g.s}`}>
            <p className="mb-2 text-sm text-zinc-700">{g.goal}</p>
            <ul className="space-y-2">
              {PRESETS.filter((p) => p.scenario === g.s || (g.s === '①' && p.scenario === '-')).map((p) => (
                <li key={p.id} className="rounded border p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{p.title}</span>
                    <PresetButton id={p.id} current={p.id === presetId} />
                  </div>
                  <p className="text-xs text-zinc-600">{p.description}</p>
                  <p className="text-xs text-blue-900">다음 행동: {p.next}</p>
                </li>
              ))}
            </ul>
          </Section>
        ))}
      </div>
    </div>
  );
}
