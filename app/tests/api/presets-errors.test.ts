/** 프리셋 재생 · 점검 · 오류 형식 · BE-07 미리보기 · BE-10 cash API · ② ③ ④ 를 API 로 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as reset from '@/app/api/scenarios/[id]/reset/route';
import * as check from '@/app/api/scenarios/[id]/check/route';
import * as events from '@/app/api/events/route';
import * as replies from '@/app/api/approval-requests/[id]/replies/route';
import * as approvalsList from '@/app/api/approval-requests/route';
import * as task from '@/app/api/tasks/[id]/route';
import * as tasksList from '@/app/api/tasks/route';
import * as cash from '@/app/api/analytics/cash/route';
import * as clockPreview from '@/app/api/clock/preview/route';
import * as contract from '@/app/api/contracts/[id]/route';
import * as penalty from '@/app/api/contracts/[id]/penalty/route';
import * as assessments from '@/app/api/assessments/route';
import * as replenish from '@/app/api/replenishment-requests/route';
import * as registry from '@/app/api/data-registry/route';
import * as proposal from '@/app/api/proposals/[id]/route';
import type { ApiError, ApprovalView, AssessmentCreateResponse, CashView, ContractView, EventResponse, PenaltyView, ProposalView, RegistryView, ReplyResponse, ScenarioCheckView, ScenarioResetResponse, TaskView } from '@/domain/api-types';
import { PRESETS } from '@/server/scenarios';
import { call, ctx, makeService, req } from '../helpers/api';

const C = 'CTR-INF-001-2026';
const doReset = (id: string) => call<ScenarioResetResponse>(reset.POST(req('', 'POST'), ctx({ id })));

describe('시연 프리셋 (S-13)', () => {
  beforeEach(() => makeService());

  it.each(PRESETS.map((p) => p.id))('%s 재생 후 기대 결과 점검 모두 통과', async (id) => {
    const r = await doReset(id);
    expect(r.status).toBe(200);
    const c = await call<ScenarioCheckView>(check.GET(req(''), ctx({ id })));
    expect(c.body.criteria.filter((x) => !x.passed)).toEqual(id === 'SEED' || id === 'S1_RECEIVED' || id === 'S1_4' || id === 'S1_5' || id === 'S1_6' ? expect.any(Array) : []);
  });

  it('없는 프리셋 404 · 오류 형식', async () => {
    const r = await call<ApiError>(reset.POST(req('', 'POST'), ctx({ id: 'NOPE' })));
    expect(r.status).toBe(404);
    expect(r.body.error).toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('사건 입력 검증 (S-02)', () => {
  beforeEach(() => makeService());

  it('필수값 누락 · 과거 날짜 · 알 수 없는 유형은 422, 없는 ID 는 404', async () => {
    await doReset('S1_5');
    const miss = await call<ApiError>(events.POST(req('', 'POST', { type: 'AR_COLLECTION_DELAYED', payload: { arId: 'MAR-0004' } })));
    expect([miss.status, miss.body.error.code]).toEqual([422, 'VALIDATION']);
    const past = await call<ApiError>(events.POST(req('', 'POST', { type: 'AR_COLLECTION_DELAYED', payload: { arId: 'MAR-0004', newDueDate: '2026-06-01' } })));
    expect(past.body.error.message).toBe('기준시각 이전 사건은 넣을 수 없습니다');
    const nf = await call<ApiError>(events.POST(req('', 'POST', { type: 'AR_COLLECTION_DELAYED', payload: { arId: 'MAR-9999', newDueDate: '2026-08-30' } })));
    expect(nf.status).toBe(404);
    const unk = await call<ApiError>(events.POST(req('', 'POST', { type: 'X' })));
    expect(unk.status).toBe(422);
    const notJson = await call<ApiError>(events.POST(new Request('http://local/api/events', { method: 'POST', body: '{' })));
    expect(notJson.status).toBe(422);
  });

  it('외부 회신: 맞는 열린 작업이 없으면 404, 수령확인은 에이전시만(422)', async () => {
    await doReset('S1_4');
    const r = await call<ApiError>(events.POST(req('', 'POST', { type: 'COUNTERPARTY_REPLY', payload: { from: 'AGENCY', outcome: 'INSUFFICIENT', note: 'x' } })));
    expect(r.status).toBe(404);
    const r2 = await call<ApiError>(events.POST(req('', 'POST', { type: 'COUNTERPARTY_REPLY', payload: { from: 'COREVIA', outcome: 'RECEIPT_CONFIRMED', note: 'x' } })));
    expect(r2.status).toBe(422);
  });
});

describe('② 조건 변경을 API 로 (AC-2-01~05 · AC-2-10)', () => {
  beforeEach(() => makeService());

  it('회수 지연 → routingChanges · 새 요청 · 422 · 조건부 승인', async () => {
    await doReset('S1_5');
    await call(events.POST(req('', 'POST', { type: 'CLOCK_ADVANCED', payload: { to: '2026-07-14T10:00:00+09:00' } })));
    const e = await call<EventResponse>(events.POST(req('', 'POST', { type: 'AR_COLLECTION_DELAYED', payload: { arId: 'MAR-0004', newDueDate: '2026-08-30' } })));
    expect(e.body.event.label).toBe('MOCK');
    expect(e.body.routingChanges.map((c) => [c.lineId, c.from, c.to, c.action])).toEqual([
      ['PLAN-004', 'MASIL_CEO', 'GROUP_CEO_BOARD', 'REAPPROVAL_REQUIRED'],
      ['PLAN-024', 'MASIL_CEO', 'GROUP_CEO_BOARD', 'ROUTING_UPDATED'],
    ]);
    const n = e.body.createdApprovals[0]!;
    expect(n).toMatchObject({ requiredRole: 'GROUP_CEO_BOARD', version: 2, subjectIds: ['PLAN-004'] });
    expect(e.body.needsAssessment).toEqual(expect.arrayContaining(['PLAN-004', 'PLAN-024']));
    // 판단안이 생기면 대기 요청에 판단안 ID 연결
    const a = await call<AssessmentCreateResponse>(assessments.POST(req('', 'POST', { subjectType: 'EXPANSION_LINES', subjectIds: ['PLAN-004'] })));
    expect(a.body.assessment.approvalRequestIds).toEqual([n.id]);
    const list = await call<ApprovalView[]>(approvalsList.GET(req('/api/approval-requests?role=GROUP_CEO_BOARD&status=PENDING')));
    expect(list.body[0]!.request).toMatchObject({ id: n.id, assessmentId: a.body.assessment.id });
    const f = await call<ApiError>(replies.POST(req('', 'POST', { respondentRole: 'MASIL_CEO', outcome: 'APPROVED', reason: '' }), ctx({ id: n.id })));
    expect(f.status).toBe(422);
    const mismatch = await call<ApiError>(replies.POST(req('', 'POST', { respondentRole: 'GROUP_CEO_BOARD', outcome: 'APPROVED', itemDecisions: [{ itemId: 'PLAN-004', decision: 'CONDITIONAL' }], conditions: '집행일 조정', reason: 'x' }), ctx({ id: n.id })));
    expect([mismatch.status, mismatch.body.error.code]).toEqual([422, 'VALIDATION']);
    const ok = await call<ReplyResponse>(
      replies.POST(req('', 'POST', { respondentRole: 'GROUP_CEO_BOARD', outcome: 'APPROVED_WITH_CONDITIONS', itemDecisions: [{ itemId: 'PLAN-004', decision: 'CONDITIONAL' }], conditions: '집행일 2026-08-31 이후로 조정', reason: '모의' }), ctx({ id: n.id })),
    );
    expect(ok.body.createdTasks.map((t) => t.type)).toEqual(['RESCHEDULE_CAMPAIGN']);
    // 집행일 조정 작업 완료 → 권한 하향, 재상신 없음 (AC-2-06)
    const done = await call<{ createdApprovals: unknown[]; routingChanges: { action: string }[] }>(task.PATCH(req('', 'PATCH', { status: 'DONE', actorRole: 'MARKETING_TEAM', payload: { settlementDate: '2026-08-31' } }), ctx({ id: ok.body.createdTasks[0]!.id })));
    expect(done.body.createdApprovals).toEqual([]);
    expect(done.body.routingChanges.map((r) => r.action)).toEqual(['KEEP_HIGHER_APPROVAL']);
    const c = await call<CashView>(cash.GET(req('/api/analytics/cash')));
    expect(c.body.current.windows).toEqual([{ start: '2026-07-21', end: '2026-08-28' }]);
    expect(c.body.largestGap!.week).toBe('2026-08-24');
    const row = c.body.officialComparison.find((r) => r.week === '2026-08-24')!;
    expect([row.official.label, row.official.value, row.recalculated.label, row.recalculated.value, row.diff.value, row.belowDays]).toEqual(['CLAIM', 7_108_078_432, 'AGGREGATED', 1_921_839_555, -5_186_238_877, 5]);
    expect(row.recalculated.assumptionIds).toEqual(['A-08', 'A-09', 'A-32']);
    expect(c.body.largestGap!.notes.every((n) => n.label === 'INTERPRETED' && n.value.includes('미확인'))).toBe(true);
    const v1 = await call<CashView>(cash.GET(req('/api/analytics/cash?version=v1')));
    expect(v1.body.largestGap!.week).toBe('2026-08-17');
    const p = await call<ProposalView>(proposal.GET(req('/api/proposals/PROP-2026-07?role=GROUP_CEO_BOARD'), ctx({ id: 'PROP-2026-07' })));
    expect(p.body.lines.find((l) => l.id === 'PLAN-024')!.routing).toMatchObject({ previousRole: 'MASIL_CEO', requiredRole: 'GROUP_CEO_BOARD' });
  });
});

describe('③ 거절 · 정보 부족을 API 로', () => {
  beforeEach(() => makeService());

  it('반려 → 정보 부족 → 판단안 v2 권고 C → 방치 7/18 자동 갱신 → 위약금', async () => {
    await doReset('S3_1');
    const e = await call<EventResponse>(events.POST(req('', 'POST', { type: 'COUNTERPARTY_REPLY', payload: { from: 'AGENCY', outcome: 'INSUFFICIENT', note: '7/24 이후 제공 가능 (모의)' } })));
    expect(e.body.needsAssessment).toContain(C);
    const a = await call<AssessmentCreateResponse>(assessments.POST(req('', 'POST', { subjectType: 'CONTRACT', subjectIds: [C] })));
    expect(a.body.assessment).toMatchObject({ version: 2, recommendation: { alternativeId: 'C' } });
    expect(a.body.assessment.unknowns.map((u) => u.gapId)).toContain('G-02');
    await call(events.POST(req('', 'POST', { type: 'CLOCK_ADVANCED', payload: { to: '2026-07-18T00:00:00+09:00' } })));
    const cv = await call<ContractView>(contract.GET(req('/api/contracts/x?terminateOn=2026-12-31'), ctx({ id: C })));
    expect(cv.body.contract).toMatchObject({ status: 'AUTO_RENEWED', autoRenewed: true });
    expect(cv.body.penaltyPreview!.amount.value).toBe(933_333_333);
    const pen = await call<PenaltyView>(penalty.GET(req('/api/x?terminateOn=2026-09-30'), ctx({ id: C })));
    expect(pen.body).toMatchObject({ applies: true, remainingMonths: 11, amount: { value: 1_283_333_333, scale: 'FULL' } });
    const ts = await call<TaskView[]>(tasksList.GET(req('/api/tasks?role=GROUP_CEO_BOARD')));
    expect(ts.body.some((t) => t.type === 'INCIDENT_AUTO_RENEWAL' && t.typeText === '자동 갱신 사고 대응')).toBe(true);
  });
});

describe('④ 재고 · SCM 을 API 로', () => {
  beforeEach(() => makeService());

  it('보충 초안(중복 409) → SCM 추가 발주 필요 → GCB 승인요청 → 거절 → 권고 부결', async () => {
    await doReset('S4');
    const dup = await call<ApiError>(replenish.POST(req('', 'POST', { triggerLineId: 'PLAN-011', actorRole: 'SCM' })));
    expect(dup.status).toBe(409);
    const e = await call<EventResponse>(events.POST(req('', 'POST', { type: 'COUNTERPARTY_REPLY', payload: { from: 'SCM', outcome: 'INFO_PROVIDED', replenishmentNeeded: true, note: '추가 발주 필요 (모의)' } })));
    const apr = e.body.createdApprovals[0]!;
    expect(apr).toMatchObject({ subjectType: 'REPLENISHMENT', requiredRole: 'GROUP_CEO_BOARD' });
    await call(replies.POST(req('', 'POST', { respondentRole: 'GROUP_CEO_BOARD', outcome: 'REJECTED', reason: '하회 구간 신규 현금 약정 불가 (모의)' }), ctx({ id: apr.id })));
    const p = await call<ProposalView>(proposal.GET(req('/api/proposals/PROP-2026-07'), ctx({ id: 'PROP-2026-07' })));
    expect(p.body.lines.find((l) => l.id === 'PLAN-011')).toMatchObject({ supplyOutlook: 'NO_SUPPLY', recommendation: { decision: 'REJECT' } });
    const c = await call<CashView>(cash.GET(req('/api/analytics/cash')));
    expect(c.body.extraOutflow).toBeNull(); // 거절된 보충은 추가 유출에서 빠짐
  });

  it('보충 제안 대상이 아닌 건 · SKU 는 422', async () => {
    await doReset('S4');
    const r = await call<ApiError>(replenish.POST(req('', 'POST', { triggerLineId: 'PLAN-001', actorRole: 'SCM' })));
    expect(r.status).toBe(422);
  });
});

describe('BE-07 시점 이동 미리보기 · 데이터 출처', () => {
  beforeEach(() => makeService());

  it('미리보기는 저장하지 않고 지나갈 기한을 알려준다', async () => {
    await doReset('S1_4');
    const to = encodeURIComponent('2026-07-18T00:00:00+09:00');
    const a = await call<{ preview: true; passingDeadlines: { kind: string }[]; transitions: unknown[] }>(clockPreview.GET(req(`/api/clock/preview?to=${to}`)));
    const b = await call<{ transitions: unknown[] }>(clockPreview.GET(req(`/api/clock/preview?to=${to}`)));
    expect(a.body.preview).toBe(true);
    expect(a.body.passingDeadlines.map((x) => x.kind)).toEqual(expect.arrayContaining(['CONTRACT_NOTICE', 'LINE_DEADLINE', 'APPROVAL']));
    expect(a.body.transitions).toEqual(b.body.transitions); // 상태가 바뀌지 않음
    const back = await call<ApiError>(clockPreview.GET(req(`/api/clock/preview?to=${encodeURIComponent('2026-06-01T00:00:00+09:00')}`)));
    expect(back.body.error.code).toBe('CLOCK_BACKWARD');
  });

  it('데이터 출처: 원본 17개 파일 행 수 · 가정 36개 · 모의 회신에 거절 · 정보 부족 포함', async () => {
    const r = await call<RegistryView>(registry.GET());
    expect(r.body.sources).toHaveLength(17);
    expect(r.body.sources.find((x) => x.file.endsWith('mkt_orders_ms.csv'))!.rows).toBe(15_650);
    expect(r.body.assumptions).toHaveLength(36);
    expect(r.body.mocks.map((m) => m.outcome)).toEqual(expect.arrayContaining(['REJECTED', 'INSUFFICIENT', 'INFO_REQUESTED']));
  });
});
