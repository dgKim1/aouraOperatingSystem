/**
 * 4단계 다듬기 BE-21 ~ BE-24 (ONTOLOGY 10-4) — 테스트 먼저.
 *  BE-21 판단안 unknowns 에 공백 상태(status · statusText) — 모의 회신으로 채워진 공백을 목록에서 빼지 않는다 (S-12 와 같은 판정 함수)
 *  BE-22 근거 판단안 없는 재상신 거부 · proposedSource · 상신자 지정 결정은 이력 사유에
 *  BE-23 재상신 완료 → 열린 「기한 전 재검토」 자동 종료(CANCELLED, SYSTEM). 「승인조건 문서화」는 자동으로 닫지 않는다
 *  BE-24 프리셋 S4 에 PLAN-011 판단안 v1
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as reset from '@/app/api/scenarios/[id]/reset/route';
import * as check from '@/app/api/scenarios/[id]/check/route';
import * as scenariosList from '@/app/api/scenarios/route';
import * as events from '@/app/api/events/route';
import * as clockAdvance from '@/app/api/clock/advance/route';
import * as assessments from '@/app/api/assessments/route';
import * as approval from '@/app/api/approval-requests/[id]/route';
import * as replies from '@/app/api/approval-requests/[id]/replies/route';
import * as tasksList from '@/app/api/tasks/route';
import * as task from '@/app/api/tasks/[id]/route';
import * as registry from '@/app/api/data-registry/route';
import type { ApiError, ApprovalView, AssessmentCreateResponse, AssessmentView, PresetInfo, RegistryView, ReplyResponse, ScenarioCheckView, TaskPatchResponse, TaskView } from '@/domain/api-types';
import { gapStatus, GAP_STATUS_TEXT } from '@/domain/gaps';
import { ASSUMPTIONS } from '@/domain/registry';
import { MOCK_REPLIES } from '@/domain/mockReplies';
import * as wf from '@/domain/workflow';
import { recordMockAssessment } from '@/server/scenarios';
import { at, ds, tasksOf, toS1_4 } from '../helpers/scenario';
import { call, ctx, makeService, req } from '../helpers/api';

const C = 'CTR-INF-001-2026';
const FILLED = '모의 회신으로 보완 — 원본 공백은 그대로';
const doReset = (id: string) => call(reset.POST(req('', 'POST'), ctx({ id })));
const advance = (to: string) => call(clockAdvance.POST(req('', 'POST', { to })));
const event = (payload: unknown) => call(events.POST(req('', 'POST', { type: 'COUNTERPARTY_REPLY', payload })));
const assess = async (subjectType: string, subjectIds: string[]) => (await call<AssessmentCreateResponse>(assessments.POST(req('', 'POST', { subjectType, subjectIds })))).body.assessment;
const gaps = async () => (await call<RegistryView>(registry.GET())).body.gaps;
const taskList = async (q = '') => (await call<TaskView[]>(tasksList.GET(req(`/api/tasks${q}`)))).body;
const patch = (id: string, body: unknown) => call<TaskPatchResponse & ApiError>(task.PATCH(req('', 'PATCH', body), ctx({ id })));
const getApproval = async (id: string) => (await call<ApprovalView>(approval.GET(req(''), ctx({ id })))).body;
const unknown = (a: AssessmentView, id: string) => a.unknowns.find((u) => u.gapId === id);

describe('BE-21 판단안 미확인 목록의 공백 상태', () => {
  beforeEach(() => makeService());

  it('③ 에이전시 「정보 제공」 뒤 계약 판단안: G-02 가 목록에 남고 FILLED_BY_MOCK, 성과 피 사실은 MOCK, 연 금액은 하한 그대로', async () => {
    await doReset('S3_1');
    await event({ from: 'AGENCY', outcome: 'INFO_PROVIDED', note: '성과 피 = 분기 GMV 연동, 분기 정산 (모의)' });
    const a = await assess('CONTRACT', [C]);
    expect(unknown(a, 'G-02')).toMatchObject({ status: 'FILLED_BY_MOCK', statusText: FILLED });
    expect(a.facts.find((f) => f.key === 'contract.performanceFee')!.value.label).toBe('MOCK');
    expect(a.ruleResults.find((r) => r.ruleId === 'R-AUTH-02')!.inputs).toMatchObject({ lowerBound: true });
    // S-12 와 같은 상태 · 같은 문구
    const g = (await gaps()).find((x) => x.id === 'G-02')!;
    expect([g.status, g.statusText]).toEqual([unknown(a, 'G-02')!.status, unknown(a, 'G-02')!.statusText]);
    expect(a.provenance.ok).toBe(true);
  });

  it('③ 에이전시 「정보 부족」이면 G-02 는 OPEN(미확인) — AC-3-02 그대로', async () => {
    await doReset('S3_1');
    await event({ from: 'AGENCY', outcome: 'INSUFFICIENT', note: '7/24 이후 제공 가능 (모의)' });
    const a = await assess('CONTRACT', [C]);
    expect(unknown(a, 'G-02')).toMatchObject({ status: 'OPEN', statusText: '미확인' });
    expect(a.recommendation.alternativeId).toBe('C');
  });

  it('① 수령확인 뒤 계약 판단안: G-03 이 목록에 남고 FILLED_BY_MOCK. 수령확인 전에는 OPEN', async () => {
    await doReset('S1_5');
    expect(unknown(await assess('CONTRACT', [C]), 'G-03')).toMatchObject({ status: 'OPEN' });
    await doReset('S1_6');
    const a = await assess('CONTRACT', [C]);
    expect(unknown(a, 'G-03')).toMatchObject({ status: 'FILLED_BY_MOCK', statusText: FILLED });
    expect((await gaps()).find((x) => x.id === 'G-03')!.status).toBe('FILLED_BY_MOCK');
    // 모든 항목에 상태가 붙는다
    expect(a.unknowns.every((u) => (u.status === 'OPEN' || u.status === 'FILLED_BY_MOCK') && u.statusText.length > 0)).toBe(true);
  });

  it('④ SCM 모의 회신 뒤 PLAN-011 판단안: G-08 이 FILLED_BY_MOCK (S-12 와 일치), 회신 전에는 OPEN', async () => {
    await doReset('S4');
    expect(unknown(await assess('EXPANSION_LINES', ['PLAN-011']), 'G-08')).toMatchObject({ status: 'OPEN' });
    await event({ from: 'SCM', outcome: 'INFO_PROVIDED', replenishmentNeeded: false, inboundExpectedDate: '2026-09-18', note: '추가 발주 불필요 (모의)' });
    const a = await assess('EXPANSION_LINES', ['PLAN-011']);
    expect(unknown(a, 'G-08')).toMatchObject({ status: 'FILLED_BY_MOCK', statusText: FILLED });
    expect((await gaps()).find((x) => x.id === 'G-08')!.statusText).toBe(FILLED);
  });

  it('판정 함수는 도메인 하나 (gapStatus) — 시드에서는 G-02 · G-03 · G-08 모두 OPEN', () => {
    const s = wf.initialState(ds);
    expect(['G-02', 'G-03', 'G-08'].map((g) => gapStatus(s, g))).toEqual(['OPEN', 'OPEN', 'OPEN']);
    expect(GAP_STATUS_TEXT).toEqual({ OPEN: '미확인', FILLED_BY_MOCK: FILLED });
  });
});

/** ③ S3-1 반려 → 7/13 16:00 에이전시 정보 부족 → 판단안 v2 (권고 C 해지) */
async function toS3_2() {
  await doReset('S3_1');
  await advance('2026-07-13T16:00:00+09:00');
  await event({ from: 'AGENCY', outcome: 'INSUFFICIENT', note: '성과 피 산식은 7/24 이후 제공 가능 (모의)' });
  return assess('CONTRACT', [C]);
}
const openTaskOf = async (type: string) => (await taskList('?role=CONTRACT_OFFICER')).find((t) => t.type === type && ['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(t.status));

describe('BE-22 재상신 근거 판단안 · proposedSource', () => {
  beforeEach(() => makeService());

  it('도메인: 계약 판단안이 하나도 없으면 재상신 거부 — 422 INFO_MISSING, 작업 · 계약 · 승인요청 불변', () => {
    let s = wf.advanceClock(toS1_4(), at('2026-07-10', '14:00')).state;
    s = wf.advanceClock(wf.replyToApproval(s, ds, MOCK_REPLIES.S3_1_REJECT).state, at('2026-07-14', '10:00')).state;
    expect(s.assessments).toHaveLength(0);
    const before = JSON.stringify(s);
    const id = tasksOf(s, 'RESUBMIT')[0]!.id;
    for (const payload of [undefined, { proposedDecision: 'TERMINATE' }]) {
      expect(() => wf.completeTask(s, ds, id, payload ? { payload } : {})).toThrow(expect.objectContaining({ code: 'INFO_MISSING', httpStatus: 422, message: '근거 판단안이 없습니다 — 판단안을 만든 뒤 재상신하세요' }));
    }
    expect(JSON.stringify(s)).toBe(before);
  });

  it('지정 없이 재상신 → 권고 = 판단안 권고(TERMINATE) · proposedSource ASSESSMENT', async () => {
    const asm = await toS3_2();
    const r = await patch((await openTaskOf('RESUBMIT'))!.id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER' });
    const apr = r.body.createdApprovals[0]!;
    expect(apr.proposed).toEqual([{ itemId: C, decision: 'TERMINATE' }]);
    const v = await getApproval(apr.id);
    expect(v).toMatchObject({ proposedSource: 'ASSESSMENT', assessmentId: asm.id, assessmentDecisionText: '해지 통보' });
    const created = v.audit.find((x) => x.entityId === apr.id && x.fromStatus === null)!;
    expect(created.reason).not.toContain('상신자 지정');
  });

  it('상신자가 다른 결정을 지정 → proposed = 그 값 · proposedSource SUBMITTER · 이력 사유에 "상신자 지정 … 다름"', async () => {
    const asm = await toS3_2();
    const r = await patch((await openTaskOf('RESUBMIT'))!.id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER', payload: { proposedDecision: 'RENEGOTIATE' } });
    const apr = r.body.createdApprovals[0]!;
    expect(apr.proposed[0]!.decision).toBe('RENEGOTIATE');
    const v = await getApproval(apr.id);
    expect(v).toMatchObject({ proposedSource: 'SUBMITTER', assessmentDecisionText: '해지 통보' });
    const created = v.audit.find((x) => x.entityId === apr.id && x.fromStatus === null)!;
    expect(created.reason).toContain('상신자 지정 결정 RENEGOTIATE');
    expect(created.reason).toContain(`근거 판단안 ${asm.id} 권고 TERMINATE 와 다름`);
  });

  it('상신자가 판단안과 같은 결정을 지정 → proposedSource 는 ASSESSMENT, 지정 사실은 이력에 남는다', async () => {
    await toS3_2();
    const r = await patch((await openTaskOf('RESUBMIT'))!.id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER', payload: { proposedDecision: 'TERMINATE' } });
    const v = await getApproval(r.body.createdApprovals[0]!.id);
    expect(v.proposedSource).toBe('ASSESSMENT');
    expect(v.audit.find((x) => x.entityId === v.request.id && x.fromStatus === null)!.reason).toContain('상신자 지정 결정 TERMINATE');
  });

  it('첫 상신(판단안에서 만든 요청)도 proposedSource ASSESSMENT · 판단안 권고 문구', async () => {
    await doReset('S1_4');
    const first = (await call<ApprovalView[]>((await import('@/app/api/approval-requests/route')).GET(req('/api/approval-requests')))).body.find((x) => x.request.subjectType === 'CONTRACT')!;
    expect(first).toMatchObject({ proposedSource: 'ASSESSMENT', assessmentDecisionText: '조건변경 통보' });
  });
});

describe('BE-23 재상신 완료 → 「기한 전 재검토」 자동 종료', () => {
  beforeEach(() => makeService());

  it('재상신 완료 응답 transitions 에 재검토 작업 → CANCELLED (SYSTEM) 1행, 열린 재검토 작업 없음', async () => {
    const asm = await toS3_2();
    await advance('2026-07-14T11:00:00+09:00');
    const review = (await openTaskOf('REVIEW_BEFORE_DEADLINE'))!;
    const r = await patch((await openTaskOf('RESUBMIT'))!.id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER' });
    const apr = r.body.createdApprovals[0]!;
    const rows = r.body.transitions.filter((t) => t.entityType === 'TASK' && t.entityId === review.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ fromStatus: 'OPEN', toStatus: 'CANCELLED', actorRole: 'SYSTEM', actorKind: 'SYSTEM' });
    expect(rows[0]!.reason).toBe(`재상신 완료로 종료 — 재검토 결과는 재상신 요청 ${apr.id} · 근거 판단안 ${asm.id}`);
    expect(await openTaskOf('REVIEW_BEFORE_DEADLINE')).toBeUndefined();
    // 7/18 이동 뒤 OVERDUE 에 재검토 없음
    await advance('2026-07-18T00:00:00+09:00');
    expect((await taskList('?status=OVERDUE')).map((t) => t.type)).not.toContain('REVIEW_BEFORE_DEADLINE');
  });

  it('계약 담당이 재상신 전에 재검토를 직접 완료했으면 그 DONE 을 그대로 둔다', async () => {
    await toS3_2();
    const review = (await openTaskOf('REVIEW_BEFORE_DEADLINE'))!;
    await patch(review.id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER', resultNote: '재검토 완료' });
    const r = await patch((await openTaskOf('RESUBMIT'))!.id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER' });
    expect(r.body.transitions.filter((t) => t.entityId === review.id)).toEqual([]);
    expect((await taskList()).find((t) => t.id === review.id)!.status).toBe('DONE');
  });

  it('재상신이 다시 반려되면 새 재검토 · 재상신 작업 각 1건', async () => {
    await toS3_2();
    const r = await patch((await openTaskOf('RESUBMIT'))!.id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER' });
    const again = await call<ReplyResponse>(replies.POST(req('', 'POST', { respondentRole: 'GROUP_CEO_BOARD', outcome: 'REJECTED', reason: '대체 파트너 계획 없이 해지 불가 (모의)' }), ctx({ id: r.body.createdApprovals[0]!.id })));
    expect(again.status).toBe(201);
    const open = (await taskList('?role=CONTRACT_OFFICER')).filter((t) => ['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(t.status));
    expect(open.filter((t) => t.type === 'REVIEW_BEFORE_DEADLINE')).toHaveLength(1);
    expect(open.filter((t) => t.type === 'RESUBMIT')).toHaveLength(1);
  });

  it('「승인조건 문서화」는 자동으로 닫히지 않는다 — 재상신 승인 → 통보 → 수령확인까지 끝나도 완료하지 않으면 7/17 뒤 OVERDUE', async () => {
    await toS3_2();
    const r = await patch((await openTaskOf('RESUBMIT'))!.id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER' });
    await advance('2026-07-15T10:00:00+09:00');
    await call(replies.POST(req('', 'POST', { respondentRole: 'GROUP_CEO_BOARD', outcome: 'APPROVED', decision: 'TERMINATE', reason: '해지 통보 승인 (모의)' }), ctx({ id: r.body.createdApprovals[0]!.id })));
    await advance('2026-07-16T10:00:00+09:00');
    await patch((await openTaskOf('SEND_NOTICE'))!.id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER' });
    await event({ from: 'AGENCY', outcome: 'RECEIPT_CONFIRMED', note: '수령 (모의)' });
    expect((await openTaskOf('DOCUMENT_CONDITIONS'))!.status).toBe('OPEN');
    await advance('2026-07-18T00:00:00+09:00');
    expect((await taskList('?status=OVERDUE')).map((t) => t.type)).toEqual(['DOCUMENT_CONDITIONS']);
  });

  it('가정 목록 사본 A-35 에 "사건의 결과로 규칙 코드가 닫는 작업" 문구가 있다 (ONTOLOGY 5절)', () => {
    const a35 = ASSUMPTIONS.find((a) => a.id === 'A-35')!;
    expect(a35.text).toContain('재상신 완료 → 재검토 작업 종료');
    expect(a35.text).toContain('사람이 PATCH 로 처리하는 경우');
  });
});

describe('BE-24 프리셋 S4 에 PLAN-011 판단안 v1', () => {
  beforeEach(() => makeService());
  const list = async () => (await call<AssessmentView[]>(assessments.GET(req('/api/assessments?subjectId=PLAN-011')))).body;

  it('S4 재생 직후 PLAN-011 판단안 1건 — v1 · 조건부 · 모의, 보충 초안보다 먼저 기록', async () => {
    await doReset('S4');
    const got = await list();
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ version: 1, mock: true, subjectType: 'EXPANSION_LINES', subjectIds: ['PLAN-011'], createdAt: '2026-07-20T09:00:00+09:00' });
    expect(got[0]!.proposedDecisions).toMatchObject([{ itemId: 'PLAN-011', decision: 'CONDITIONAL' }]);
    // 보충 초안 전: 판단안 사실에 SCM 회신 · 보충요청 흔적이 없다
    expect(got[0]!.facts.some((f) => f.key === 'line.PLAN-011.supplyOutlook')).toBe(false);
    expect(unknown(got[0]!, 'G-08')).toMatchObject({ status: 'OPEN' });
  });

  it('S4 점검에 판단안 v1 항목 · next 안내 갱신', async () => {
    await doReset('S4');
    const c = (await call<ScenarioCheckView>(check.GET(req(''), ctx({ id: 'S4' })))).body;
    expect(c.criteria.find((x) => x.id === 'AC-4-06a')).toMatchObject({ passed: true, text: 'PLAN-011 판단안 v1 · 권고 조건부' });
    expect(c.passed).toBe(c.total);
    const p = (await call<PresetInfo[]>(scenariosList.GET())).body.find((x) => x.id === 'S4')!;
    expect(p.next).toBe('SCM 역할로 보충 검토 회신 → PLAN-011 판단안 다시 만들기(v2)');
  });

  it('④-c SCM 「거절」 뒤 다시 만들면 v2 · 부결', async () => {
    await doReset('S4');
    await event({ from: 'SCM', outcome: 'REJECTED', note: 'Corevia F1 포화로 9월 전 추가 생산 불가 (모의)' });
    const a = await assess('EXPANSION_LINES', ['PLAN-011']);
    expect(a.version).toBe(2);
    expect(a.proposedDecisions).toMatchObject([{ itemId: 'PLAN-011', decision: 'REJECT' }]);
  });

  it('④-b 권한자 반려 뒤 다시 만들면 v2 · 부결', async () => {
    await doReset('S4');
    const e = await call<{ createdApprovals: { id: string }[] }>(events.POST(req('', 'POST', { type: 'COUNTERPARTY_REPLY', payload: { from: 'SCM', outcome: 'INFO_PROVIDED', replenishmentNeeded: true, note: '추가 발주 필요 (모의)' } })));
    await call(replies.POST(req('', 'POST', { respondentRole: 'GROUP_CEO_BOARD', outcome: 'REJECTED', reason: '하회 구간 신규 현금 약정 불가 (모의)' }), ctx({ id: e.body.createdApprovals[0]!.id })));
    const a = await assess('EXPANSION_LINES', ['PLAN-011']);
    expect([a.version, a.proposedDecisions![0]!.decision]).toEqual([2, 'REJECT']);
  });
});

describe('도메인 도우미 — 재상신 전 판단안 기록 (AC-3-03 테스트가 쓰는 경로)', () => {
  it('판단안을 기록하면 지정 결정으로 재상신할 수 있다', () => {
    let s = wf.advanceClock(toS1_4(), at('2026-07-10', '14:00')).state;
    s = wf.advanceClock(wf.replyToApproval(s, ds, MOCK_REPLIES.S3_1_REJECT).state, at('2026-07-14', '10:00')).state;
    s = recordMockAssessment(s, ds, { subjectType: 'CONTRACT', subjectIds: [C] }).state;
    const r = wf.completeTask(s, ds, tasksOf(s, 'RESUBMIT')[0]!.id, { payload: { proposedDecision: 'TERMINATE' } });
    expect(r.createdApprovals[0]).toMatchObject({ version: 2, assessmentId: 'ASM-001', proposed: [{ itemId: C, decision: 'TERMINATE' }] });
  });
});
