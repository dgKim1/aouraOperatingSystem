/** S-13 시연 시나리오 — ①~④ 를 같은 결과로 재현. 프리셋 = 초기화 후 시작 지점까지 서버에서 재생 (POST /api/scenarios/:id/reset) */
import { CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { RecordedMark } from '@/components/assessment/parts';
import { PageHeader, Section } from '@/components/common';
import { getMeta, getPresets, getScenarioCheck } from '../_data/views';
import { PresetButton } from './preset-button';

const GROUPS = [
  { s: '①', title: '① 정상', goal: '7/17 마감 계약 · 기안 5건을 기한 전에 권한자에게 올려 처리 → 7/18 자동 갱신 · 자동 확정 없음' },
  { s: '②', title: '② 조건 변경', goal: '회수 지연으로 하회 구간이 늘어 PLAN-004 · 024 권한자가 그룹 CEO/이사회로 상향 · 재승인' },
  { s: '③', title: '③ 정보 부족 · 거절', goal: '계약 반려 → 기한 전 재검토 · 에이전시 정보 부족 → (A) 재상신 / (B) 방치 시 자동 갱신 · 위약금' },
  { s: '④', title: '④ 확장 · 부서 영향', goal: 'PLAN-011 더마 재고 게이트 → 조건부(집행일 조정) · 보충 요청(covenant 구간이면 그룹 CEO/이사회)' },
];

const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

export default async function ScenariosPage() {
  const meta = await getMeta();
  const presets = getPresets();
  const current = meta.preset?.id ?? null;
  const check = current ? await getScenarioCheck(current) : null;
  return (
    <div className="space-y-4">
      <PageHeader id="S-13" title="시연 시나리오" decision="시연할 상황의 시작 지점으로 초기화 · 재생하고, 다음 행동과 기대 결과(현재 상태와 비교)를 확인합니다." />

      <Section title="현재 지점 점검" id="check" actions={<PresetButton id="SEED" title="초기 상태" current={current === 'SEED'} label="전체 초기화" />}>
        {meta.preset ? (
          <div className="space-y-2 text-sm">
            <p>
              마지막 재생 지점 <strong>{meta.preset.title}</strong> — 그 뒤 화면에서 넣은 사건 포함 (상태 버전 {meta.stateVersion})
            </p>
            <p className="text-blue-900">다음 행동: {meta.preset.next}</p>
            {check && (
              <>
                <p className="font-medium">
                  수용 기준 점검 {check.passed} / {check.total}
                </p>
                <ul className="space-y-1">
                  {check.criteria.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-start gap-2 text-xs">
                      {c.passed ? <CheckCircle2 className="size-4 text-emerald-700" aria-label="통과" /> : <XCircle className="size-4 text-red-700" aria-label="미통과" />}
                      <span className="font-mono">{c.id}</span>
                      <span className="min-w-0 flex-1">{c.text}</span>
                      {!c.passed && (
                        <span className="font-mono text-zinc-600">
                          실제 {show(c.actual)} · 기대 {show(c.expected)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-zinc-600">점검은 이 프리셋의 시작 지점 기대값과 현재 상태를 비교합니다. 화면에서 사건을 더 진행했다면 ✗ 가 나오는 것이 정상일 수 있습니다.</p>
                <p className="text-xs text-zinc-600" role="note">
                  현재 지점만 점검합니다 — 다른 시나리오는 그 프리셋을 재생한 뒤 점검하세요. 시나리오 전체(정상 · 조건 변경 · 정보 부족/거절)의 통과 여부는 <code className="font-mono">npm run check</code> 의 시나리오 테스트가 확인합니다.
                </p>
              </>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">재생한 프리셋이 없습니다.</p>
        )}
      </Section>

      <p className="flex flex-wrap items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm">
        <RecordedMark />
        <Link href="/assessments/recorded" className="font-medium underline">
          실제 Claude 실행 기록 보기
        </Link>
        <span className="text-xs text-zinc-700">— AI 가 받은 입력 · 낸 출력 · 검증 · 이어진 승인요청. 시연의 판단안은 모의이고, 이 기록은 다시 호출하지 않고 보여주기만 합니다.</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <Section key={g.s} title={g.title} id={`sc-${g.s}`}>
            <p className="mb-2 text-sm text-zinc-700">{g.goal}</p>
            {g.s === '①' && (
              <p className="mb-2 text-xs text-zinc-600">
                ①-1 ~ ①-6 은 하나의 시연을 시간순으로 나눈 중간 지점입니다(위 → 아래). 처음부터 직접 조작하려면 ①-1 에서 시작하고, 버튼은 그 지점까지 건너뜁니다.
              </p>
            )}
            <ul className="space-y-2">
              {presets
                .filter((p) => p.scenario === g.s || (g.s === '①' && p.scenario === '-'))
                .map((p) => (
                  <li key={p.id} className={p.id === current ? 'rounded border border-blue-600 p-2' : 'rounded border p-2'}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{p.scenario === '-' ? `①-1 ${p.title}` : p.title}</span>
                      <PresetButton id={p.id} title={p.title} current={p.id === current} />
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
