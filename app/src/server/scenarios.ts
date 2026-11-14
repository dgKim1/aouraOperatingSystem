/**
 * 시연 프리셋 (S-13) — 초기화 → 시작 지점까지 사건을 도메인 함수로 재생 (이벤트 소싱처럼 결정적).
 * 판단안은 재생 중 모의 문장으로 만든다(실제 AI 호출 없음 — 결과가 항상 같아야 하므로).
 * 모의 회신은 요청 번호가 아니라 대상으로 요청을 찾는다 (BE-05).
 */
import type { PresetId, PresetInfo, ScenarioCheckView } from '@/domain/api-types';
import { buildAssessmentBasis, type AssessmentSubject } from '@/domain/assessment';
import type { MasilDataset } from '@/domain/dataset';
import { DomainError } from '@/domain/errors';
import { MOCK_REPLIES } from '@/domain/mockReplies';
import * as wf from '@/domain/workflow';
import { mockDraft } from './ai/assessor';

export const PRESETS: PresetInfo[] = [
  { id: 'SEED', scenario: '-', title: '초기 상태 (7/1 09:00)', description: '통보 · 기안 미접수', next: '사건 입력에서 갱신 통보 · 확대 기안 접수' },
  { id: 'S1_RECEIVED', scenario: '①', title: '① 접수 · 확인 (S1-1~2)', description: '계약 UNDER_REVIEW · 25건 VALIDATED', next: '판단안 만들기 → 승인 요청 만들기' },
  { id: 'S1_4', scenario: '①', title: '① 승인 요청 3건 (S1-4)', description: '판단안 2건 · 승인요청 3건 대기, 7/1 09:00', next: '승인함에서 그룹 CEO/이사회 역할로 계약 · PLAN-001~003 요청 회신, Masil 대표로 PLAN-004 · 005 요청 회신' },
  { id: 'S1_5', scenario: '①', title: '① 모의 회신 후 (S1-5, 7/10 14:00)', description: '계약 NOTICE_PENDING · PLAN-004 승인 · 4건 부결', next: '작업에서 통보 발송(SEND_NOTICE) 완료' },
  { id: 'S1_6', scenario: '①', title: '① 통보 · 수령확인 (S1-6, 7/14 11:00)', description: '계약 NEGOTIATING (수령확인 7/14)', next: '시점 7/18 00:00 으로 이동' },
  { id: 'S1_7', scenario: '①', title: '① 기한 도래 후 (S1-7, 7/18 00:00)', description: 'PLAN-004 CONFIRMED · 4건 CANCELLED · 자동 갱신 없음', next: '인플루언서 성과에서 남은 기안 배분 비중 확인' },
  { id: 'S2', scenario: '②', title: '② 회수 지연 → 재전망 (7/14 10:00)', description: '하회 구간 7/21~8/28, PLAN-004 재승인 요청 대기', next: '승인함에서 그룹 CEO/이사회 역할로 PLAN-004 새 요청에 조건부 승인' },
  { id: 'S3_1', scenario: '③', title: '③ 계약 반려 (7/10 14:00)', description: '계약 REVIEW_BEFORE_DEADLINE · 정보 요청 작업', next: '사건 입력에서 에이전시 정보 부족 회신' },
  { id: 'S3_B', scenario: '③', title: '③-B 미결로 기한 경과 (7/18 00:00)', description: '계약 AUTO_RENEWED (권한 미경유 체결)', next: '전속계약 상세에서 위약금 확인' },
  { id: 'S4', scenario: '④', title: '④ 더마 재고 게이트 (7/20 09:00)', description: 'PLAN-011 재고 부족 · 보충 제안 초안', next: '재고 커버에서 보충 제안 확인, SCM 역할로 보충 검토 회신' },
];

export const isPresetId = (x: string): x is PresetId => PRESETS.some((p) => p.id === x);
export const presetInfo = (id: PresetId) => PRESETS.find((p) => p.id === id)!;

const at = (date: string, time = '09:00') => `${date}T${time}:00+09:00`;
export const CONTRACT_ID = 'CTR-INF-001-2026';
const FIRST_LINES = ['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-004', 'PLAN-005'];

/** 서비스와 같은 후처리: 매 처리 뒤 기안 건 플래그 재계산 (시점 · 계약 결정에 따라 바뀜, 상태 전이 없음) */
export function settle(s: wf.WorldState, ds: MasilDataset): wf.WorldState {
  return wf.revalidateLines(s, ds).state;
}

function step(s: wf.WorldState, ds: MasilDataset, f: (s: wf.WorldState) => { state: wf.WorldState }): wf.WorldState {
  return settle(f(s).state, ds);
}

/** 모의 판단안 기록 (재생용, 결정적) */
export function recordMockAssessment(s: wf.WorldState, ds: MasilDataset, subject: AssessmentSubject) {
  const basis = buildAssessmentBasis(s, ds, subject);
  return wf.recordAssessment(s, mockDraft(basis, s.simNow, { warnings: ['시연 프리셋 재생 — 모의 판단안'] }));
}

function openTask(s: wf.WorldState, type: string): string {
  const t = s.tasks.find((x) => x.type === type && ['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(x.status));
  if (!t) throw new DomainError('NOT_FOUND', `열린 작업 없음: ${type}`);
  return t.id;
}

function received(ds: MasilDataset) {
  let s = wf.initialState(ds);
  s = step(s, ds, wf.receiveRenewalNotice);
  return step(s, ds, (x) => wf.receiveProposal(x, ds));
}
function s1_4(ds: MasilDataset) {
  let s = received(ds);
  const a1 = recordMockAssessment(s, ds, { subjectType: 'CONTRACT', subjectIds: [CONTRACT_ID] });
  s = a1.state;
  const a2 = recordMockAssessment(s, ds, { subjectType: 'EXPANSION_LINES', subjectIds: FIRST_LINES });
  s = a2.state;
  s = step(s, ds, (x) => wf.requestApprovalFromAssessment(x, a1.assessment.id));
  return step(s, ds, (x) => wf.requestApprovalFromAssessment(x, a2.assessment.id));
}
function s1_5(ds: MasilDataset) {
  let s = step(s1_4(ds), ds, (x) => wf.advanceClock(x, at('2026-07-10', '14:00')));
  for (const r of MOCK_REPLIES.S1_5) s = step(s, ds, (x) => wf.replyToApproval(x, ds, r));
  return s;
}
function s1_6(ds: MasilDataset) {
  let s = step(s1_5(ds), ds, (x) => wf.advanceClock(x, at('2026-07-13', '10:00')));
  const send = s.tasks.find((t) => t.type === 'SEND_NOTICE' && t.status !== 'DONE')!;
  s = step(s, ds, (x) => wf.completeTask(x, ds, send.id, { resultNote: '조건변경 통보 발송 (모의)' }));
  // BE-16: 승인조건 문서화 (수치 조건은 만들지 않음 — A-23)
  s = step(s, ds, (x) => wf.completeTask(x, ds, openTask(x, 'DOCUMENT_CONDITIONS'), { resultNote: '조건변경 협의 요청 사항 문서화 (모의)' }));
  s = step(s, ds, (x) => wf.advanceClock(x, at('2026-07-14', '11:00')));
  s = step(s, ds, (x) => wf.counterpartyReply(x, ds, MOCK_REPLIES.S1_6_AGENCY_RECEIPT));
  // BE-16: 그룹 보고 (Masil 대표, A-29)
  return step(s, ds, (x) => wf.completeTask(x, ds, openTask(x, 'REPORT_TO_GROUP'), { resultNote: 'PLAN-004 승인 · PLAN-005 부결 그룹 보고 (모의)' }));
}
function s2(ds: MasilDataset) {
  const s = step(s1_5(ds), ds, (x) => wf.advanceClock(x, at('2026-07-14', '10:00')));
  return step(s, ds, (x) => wf.arCollectionDelayed(x, ds, { arId: 'MAR-0004', newDueDate: '2026-08-30' }));
}
function s3_1(ds: MasilDataset) {
  const s = step(s1_4(ds), ds, (x) => wf.advanceClock(x, at('2026-07-10', '14:00')));
  return step(s, ds, (x) => wf.replyToApproval(x, ds, MOCK_REPLIES.S3_1_REJECT));
}
function s3_b(ds: MasilDataset) {
  let s = step(s3_1(ds), ds, (x) => wf.advanceClock(x, at('2026-07-13', '16:00')));
  s = step(s, ds, (x) => wf.counterpartyReply(x, ds, MOCK_REPLIES.S3_2_AGENCY_INSUFFICIENT));
  return step(s, ds, (x) => wf.advanceClock(x, '2026-07-18T00:00:00+09:00'));
}
function s4(ds: MasilDataset) {
  const s = step(s1_6(ds), ds, (x) => wf.advanceClock(x, at('2026-07-20', '09:00')));
  return step(s, ds, (x) => wf.draftReplenishment(x, ds, { triggerLineId: 'PLAN-011' }));
}

const BUILD: Record<PresetId, (ds: MasilDataset) => wf.WorldState> = {
  SEED: (ds) => wf.initialState(ds),
  S1_RECEIVED: received,
  S1_4: s1_4,
  S1_5: s1_5,
  S1_6: s1_6,
  S1_7: (ds) => step(s1_6(ds), ds, (x) => wf.advanceClock(x, '2026-07-18T00:00:00+09:00')),
  S2: s2,
  S3_1: s3_1,
  S3_B: s3_b,
  S4: s4,
};

export function buildPreset(id: string, ds: MasilDataset): wf.WorldState {
  if (!isPresetId(id)) throw new DomainError('NOT_FOUND', `시연 프리셋 없음: ${id}`);
  return BUILD[id](ds);
}

// ───────────────────────── 기대 결과 점검 (S-13 체크리스트) ─────────────────────────

type C = ScenarioCheckView['criteria'][number];
const crit = (id: string, text: string, actual: unknown, expected: unknown): C => ({ id, text, passed: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });

/** 프리셋별 수용 기준 요약을 현재 상태와 비교 (DEMO_SCENARIOS AC 요약) */
export function checkScenario(id: string, s: wf.WorldState): ScenarioCheckView {
  if (!isPresetId(id)) throw new DomainError('NOT_FOUND', `시연 프리셋 없음: ${id}`);
  const line = (x: string) => s.lines.find((l) => l.id === x);
  const tasks = (t: string) => s.tasks.filter((x) => x.type === t);
  const list: C[] = [];
  const sc = presetInfo(id).scenario;
  if (sc === '①' || id === 'SEED') {
    list.push(crit('AC-1-02', '계약 권한자 = 그룹 CEO/이사회', wf.contractRouting(s).requiredRole, 'GROUP_CEO_BOARD'));
    list.push(crit('AC-1-02b', 'PLAN-001~003 권한자 = 그룹 CEO/이사회 (covenant 우선)', ['PLAN-001', 'PLAN-002', 'PLAN-003'].map((x) => line(x)?.routing?.requiredRole ?? null), ['GROUP_CEO_BOARD', 'GROUP_CEO_BOARD', 'GROUP_CEO_BOARD']));
    list.push(crit('AC-1-06', '승인요청 3건 · 판단안 ID 연결', s.approvals.filter((a) => a.version === 1 && a.hardDeadline === '2026-07-17').map((a) => [a.requiredRole, !!a.assessmentId]), [['GROUP_CEO_BOARD', true], ['GROUP_CEO_BOARD', true], ['MASIL_CEO', true]]));
    list.push(crit('AC-1-08', 'PLAN-004 승인 · 나머지 4건 부결(또는 확정 · 취소)', FIRST_LINES.map((x) => line(x)?.status ?? null), id === 'S1_7' ? ['CANCELLED', 'CANCELLED', 'CANCELLED', 'CONFIRMED', 'CANCELLED'] : ['REJECTED', 'REJECTED', 'REJECTED', 'APPROVED', 'REJECTED']));
    list.push(crit('AC-1-09', '계약 수령확인 후 NEGOTIATING (E1)', s.contract.status, 'NEGOTIATING'));
    list.push(crit('AC-1-10', '7/18 이후 자동 갱신 · 자동 확정 없음', [s.contract.status === 'AUTO_RENEWED', s.lines.filter((l) => l.status === 'AUTO_CONFIRMED').length], [false, 0]));
    list.push(crit('AC-1-10b', 'OVERDUE 작업 0 (승인조건 문서화 · 그룹 보고 완료, BE-16)', s.tasks.filter((t) => t.status === 'OVERDUE').map((t) => t.type), []));
  }
  if (sc === '②') {
    list.push(crit('AC-2-01', '재전망 하회 구간 7/21~8/28', s.forecast.breachWindows, [{ start: '2026-07-21', end: '2026-08-28' }]));
    list.push(crit('AC-2-02', 'PLAN-004 · PLAN-024 권한자 그룹 CEO/이사회', [line('PLAN-004')?.routing?.requiredRole, line('PLAN-024')?.routing?.requiredRole], ['GROUP_CEO_BOARD', 'GROUP_CEO_BOARD']));
    const n = s.approvals.find((a) => a.subjectIds.length === 1 && a.subjectIds[0] === 'PLAN-004' && a.supersedesId);
    list.push(crit('AC-2-03', 'PLAN-004 새 요청 (GCB, version 2) · 건 PENDING_APPROVAL', [n?.requiredRole ?? null, n?.version ?? null, line('PLAN-004')?.status], ['GROUP_CEO_BOARD', 2, 'PENDING_APPROVAL']));
  }
  if (sc === '③') {
    list.push(crit('AC-3-01', '계약 반려 → 기한 전 재검토 (미갱신 확정 아님)', s.contract.status === 'AUTO_RENEWED' ? 'AUTO_RENEWED' : s.contract.status, id === 'S3_B' ? 'AUTO_RENEWED' : 'REVIEW_BEFORE_DEADLINE'));
    list.push(crit('AC-3-01b', '정보 요청 · 재검토 · 재상신 작업 각 1건', ['INFO_REQUEST', 'REVIEW_BEFORE_DEADLINE', 'RESUBMIT'].map((t) => tasks(t).filter((x) => x.subjectType === 'CONTRACT').length), [1, 1, 1]));
    if (id === 'S3_B') list.push(crit('AC-3-06', '자동 갱신 사고 대응 작업 1건', tasks('INCIDENT_AUTO_RENEWAL').length, 1));
  }
  if (sc === '④') {
    list.push(crit('AC-4-02', 'PLAN-011 재고 게이트 플래그', ['INVENTORY_BELOW_MIN', 'STOCKOUT_BEFORE_SETTLEMENT'].every((f) => line('PLAN-011')?.flags.includes(f as never)), true));
    list.push(crit('AC-4-03', 'PLAN-011 권고 ≠ APPROVE (재고 게이트 우선)', line('PLAN-011') ? wf.recommendLine(line('PLAN-011')!).decision !== 'APPROVE' : null, true));
    list.push(crit('AC-4-04', '보충 제안 1001 · 1002 · 1004 = 24000 · 24000 · 20000', s.replenishments.map((r) => [r.skuId, r.finalQty]), [['SKU-1001', 24000], ['SKU-1002', 24000], ['SKU-1004', 20000]]));
    list.push(crit('AC-4-05', '보충요청 권한자 (지급 8/14 → 그룹 CEO/이사회)', [...new Set(s.replenishments.map((r) => r.requiredRole))], ['GROUP_CEO_BOARD']));
  }
  return { preset: presetInfo(id), criteria: list, passed: list.filter((c) => c.passed).length, total: list.length };
}
