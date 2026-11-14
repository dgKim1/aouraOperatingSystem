/**
 * 시연 ③ 화면 검증에서 나온 결함 (테스트 먼저).
 * 1. 재상신(RESUBMIT 완료)으로 만든 승인요청의 권고 결정은 그 시점 최신 계약 판단안의 권고를 따른다 (S3-2 재판단 권고 C 해지 → S3-3 재상신).
 * 2. 자동 갱신 위험 경고의 「다음 행동」은 계약 상태별로 다르다 (반려 · 재검토 중이면 계약 담당의 재검토 · 재상신 작업).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as reset from '@/app/api/scenarios/[id]/reset/route';
import * as events from '@/app/api/events/route';
import * as clockAdvance from '@/app/api/clock/advance/route';
import * as assessments from '@/app/api/assessments/route';
import * as tasksList from '@/app/api/tasks/route';
import * as task from '@/app/api/tasks/[id]/route';
import * as overview from '@/app/api/overview/route';
import type { ApiError, AssessmentCreateResponse, OverviewView, TaskPatchResponse, TaskView } from '@/domain/api-types';
import { call, ctx, makeService, req } from '../helpers/api';

const doReset = (id: string) => call(reset.POST(req('', 'POST'), ctx({ id })));
const advance = (to: string) => call(clockAdvance.POST(req('', 'POST', { to })));
const CONTRACT = 'CTR-INF-001-2026';

/** ③ S3-1 반려 → S3-2 에이전시 정보 부족(7/13 16:00) → 재판단(판단안 v2) */
async function toS3_2() {
  await doReset('S3_1');
  await advance('2026-07-13T16:00:00+09:00');
  await call(events.POST(req('', 'POST', { type: 'COUNTERPARTY_REPLY', payload: { from: 'AGENCY', outcome: 'INSUFFICIENT', note: '성과 피 산식은 7/24 이후 제공 가능 (모의)' } })));
  const a = await call<AssessmentCreateResponse>(assessments.POST(req('', 'POST', { subjectType: 'CONTRACT', subjectIds: [CONTRACT] })));
  return a.body.assessment;
}
const resubmitTask = async () => (await call<TaskView[]>(tasksList.GET(req('/api/tasks?role=CONTRACT_OFFICER')))).body.find((t) => t.type === 'RESUBMIT')!;
const patch = (id: string, body: unknown) => call<TaskPatchResponse & ApiError>(task.PATCH(req('', 'PATCH', body), ctx({ id })));
const recommended = (a: { alternatives: { id: string; decision?: string }[]; recommendation: { alternativeId: string } }) => a.alternatives.find((x) => x.id === a.recommendation.alternativeId)!.decision;

describe('③ S3-3 재상신 — 승인요청 권고는 최신 판단안을 따른다', () => {
  beforeEach(() => makeService());

  it('S3-2 재판단(v2) 권고는 해지(TERMINATE) — 첫 요청의 조건변경과 다르다', async () => {
    const asm = await toS3_2();
    expect(asm.version).toBe(2);
    expect(recommended(asm)).toBe('TERMINATE');
  });

  it('판단안을 골라 재상신(payload.assessmentId) → 새 요청 v2 의 권고 = 그 판단안의 권고(TERMINATE)', async () => {
    const asm = await toS3_2();
    await advance('2026-07-14T10:00:00+09:00');
    const r = await patch((await resubmitTask()).id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER', payload: { assessmentId: asm.id } });
    expect(r.status).toBe(200);
    const apr = r.body.createdApprovals[0]!;
    expect(apr).toMatchObject({ subjectType: 'CONTRACT', version: 2, requiredRole: 'GROUP_CEO_BOARD', status: 'PENDING', assessmentId: asm.id });
    expect(apr.supersedesId).toBeTruthy();
    expect(apr.proposed).toEqual([{ itemId: CONTRACT, decision: 'TERMINATE' }]);
  });

  it('판단안을 지정하지 않아도 그 시점 최신 계약 판단안을 근거로 붙이고 그 권고를 따른다', async () => {
    const asm = await toS3_2();
    const r = await patch((await resubmitTask()).id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER' });
    const apr = r.body.createdApprovals[0]!;
    expect(apr.assessmentId).toBe(asm.id);
    expect(apr.proposed[0]!.decision).toBe('TERMINATE');
  });

  it('사람이 결정을 직접 지정(payload.proposedDecision)하면 그 값이 우선', async () => {
    await toS3_2();
    const r = await patch((await resubmitTask()).id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER', payload: { proposedDecision: 'RENEGOTIATE' } });
    expect(r.body.createdApprovals[0]!.proposed[0]!.decision).toBe('RENEGOTIATE');
  });

  it('없는 판단안 · 계약 판단안이 아닌 것을 지정하면 거부, 상태 불변', async () => {
    await toS3_2();
    const t = await resubmitTask();
    const r = await patch(t.id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER', payload: { assessmentId: 'ASM-999' } });
    expect(r.status).toBe(404);
    const lines = await patch(t.id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER', payload: { assessmentId: 'ASM-002' } });
    expect([lines.status, lines.body.error.code]).toEqual([422, 'VALIDATION']);
    expect((await resubmitTask()).status).not.toBe('DONE');
  });
});

describe('자동 갱신 위험 경고의 다음 행동 — 계약 상태별', () => {
  beforeEach(() => makeService());
  const autoAlert = async () => (await call<OverviewView>(overview.GET())).body.alerts.find((a) => a.id === 'AL-AUTO-RENEWAL')!;

  it('승인 대기(7/10): 그룹 CEO/이사회 승인 회신', async () => {
    await doReset('S1_4');
    await advance('2026-07-10T09:00:00+09:00');
    const a = await autoAlert();
    expect(a.nextAction.role).toBe('GROUP_CEO_BOARD');
    expect(a.nextAction.text).toContain('승인');
    expect(a.nextAction.href).toMatch(/^\/approvals\//);
  });

  it('반려 · 재검토 중(③ S3-1): 계약 담당의 정보 요청 · 재검토 · 재상신 작업', async () => {
    await doReset('S3_1');
    const a = await autoAlert();
    expect(a.nextAction).toMatchObject({ role: 'CONTRACT_OFFICER', href: '/tasks' });
    expect(a.nextAction.text).toContain('재상신');
    expect(a.nextAction.text).not.toContain('그룹 CEO/이사회 승인 →');
  });

  it('통보 대기(① S1-5): 계약 담당 통보 발송', async () => {
    await doReset('S1_5');
    const a = await autoAlert();
    expect(a.nextAction).toMatchObject({ role: 'CONTRACT_OFFICER', href: '/tasks' });
    expect(a.nextAction.text).toContain('통보 발송');
  });
});
