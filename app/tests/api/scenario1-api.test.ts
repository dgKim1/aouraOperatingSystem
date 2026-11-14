/** ① 정상 흐름을 API 만으로 끝까지 — 입력 → 확인 → 판단(모의) → 승인 요청 → 회신 → 작업 → 수령확인 → 시점 이동 → 다음 판단 반영 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as events from '@/app/api/events/route';
import * as assessments from '@/app/api/assessments/route';
import * as approvals from '@/app/api/approval-requests/route';
import * as replies from '@/app/api/approval-requests/[id]/replies/route';
import * as tasks from '@/app/api/tasks/route';
import * as task from '@/app/api/tasks/[id]/route';
import * as clockAdvance from '@/app/api/clock/advance/route';
import * as clockPreview from '@/app/api/clock/preview/route';
import * as overview from '@/app/api/overview/route';
import * as meta from '@/app/api/meta/route';
import * as proposal from '@/app/api/proposals/[id]/route';
import * as influencers from '@/app/api/analytics/influencers/route';
import * as audit from '@/app/api/audit/route';
import type { ApprovalCreateResponse, AssessmentCreateResponse, ClockResponse, EventResponse, MetaView, OverviewView, ProposalView, ReplyResponse, TaskPatchResponse, TaskView, InfluencersView, ApiError } from '@/domain/api-types';
import type { AuditLogEntry } from '@/domain/types';
import { call, ctx, makeService, req } from '../helpers/api';

const C = 'CTR-INF-001-2026';

describe('API ① 정상 흐름 (메모리 저장소 · 모의 AI)', () => {
  beforeEach(() => makeService());

  it('끝까지 돈다', async () => {
    const m = await call<MetaView>(meta.GET());
    expect(m.body).toMatchObject({ workId: 'W02', aiMode: 'MOCK', persistence: 'MEMORY', simNow: '2026-07-01T09:00:00+09:00', dataMode: 'API' });

    // S1-1 접수
    const e1 = await call<EventResponse>(events.POST(req('/api/events', 'POST', { type: 'RENEWAL_NOTICE_RECEIVED', payload: { contractId: C } })));
    expect(e1.status).toBe(201);
    expect(e1.body.transitions[0]).toMatchObject({ entityType: 'CONTRACT', fromStatus: 'ACTIVE', toStatus: 'UNDER_REVIEW', actorKind: 'HUMAN' });
    expect(e1.body.needsAssessment).toContain(C);
    const e2 = await call<EventResponse>(events.POST(req('/api/events', 'POST', { type: 'EXPANSION_PROPOSAL_RECEIVED', payload: { proposalId: 'PROP-2026-07' } })));
    expect(e2.body.needsAssessment).toEqual(['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-004', 'PLAN-005']);

    // S1-2 확인 — 집계는 서버가: 기한별 합계 · 비중
    const p = await call<ProposalView>(proposal.GET(req('/api/proposals/PROP-2026-07'), ctx({ id: 'PROP-2026-07' })));
    expect(p.body.proposal!.total.value).toBe(180_803_272);
    expect(p.body.summary!.groups.map((g) => [g.deadline, g.count, g.total.value])).toEqual([
      ['2026-07-17', 5, 70_902_290],
      ['2026-08-14', 12, expect.any(Number)],
      ['2026-09-11', 8, expect.any(Number)],
    ]);
    expect(p.body.summary!.groups[0]!.share.value).toBeCloseTo(0.392, 3);

    // S1-3 판단 (모의)
    const a1 = await call<AssessmentCreateResponse>(assessments.POST(req('/api/assessments', 'POST', { subjectType: 'CONTRACT', subjectIds: [C] })));
    expect(a1.status).toBe(201);
    expect(a1.body.assessment).toMatchObject({ id: 'ASM-001', mock: true, aiMode: 'MOCK', provenance: { ok: true } });
    expect(a1.body.assessment.facts.every((f) => f.key && f.name)).toBe(true);
    const a2 = await call<AssessmentCreateResponse>(assessments.POST(req('/api/assessments', 'POST', { subjectType: 'EXPANSION_LINES', subjectIds: e2.body.needsAssessment })));

    // S1-4 승인 요청
    const r1 = await call<ApprovalCreateResponse>(approvals.POST(req('/api/approval-requests', 'POST', { assessmentId: a1.body.assessment.id })));
    const r2 = await call<ApprovalCreateResponse>(approvals.POST(req('/api/approval-requests', 'POST', { assessmentId: a2.body.assessment.id })));
    const [contractReq] = r1.body.requests;
    const [gcbReq, ceoReq] = r2.body.requests;
    expect(contractReq).toMatchObject({ requiredRole: 'GROUP_CEO_BOARD', assessmentId: 'ASM-001', proposed: [{ itemId: C, decision: 'RENEGOTIATE' }] });
    expect(gcbReq).toMatchObject({ requiredRole: 'GROUP_CEO_BOARD', subjectIds: ['PLAN-001', 'PLAN-002', 'PLAN-003'], assessmentId: 'ASM-002' });
    expect(ceoReq).toMatchObject({ requiredRole: 'MASIL_CEO', subjectIds: ['PLAN-004', 'PLAN-005'] });
    expect(r2.body.transitions.filter((t) => t.toStatus === 'PENDING_APPROVAL')).toHaveLength(5);

    // 시점 이동 7/10 14:00 (미리보기 = 실제)
    const to = '2026-07-10T14:00:00+09:00';
    const pv = await call<ClockResponse>(clockPreview.GET(req(`/api/clock/preview?to=${encodeURIComponent(to)}`)));
    const adv = await call<ClockResponse>(clockAdvance.POST(req('/api/clock/advance', 'POST', { to })));
    expect(adv.body.transitions.map((t) => [t.entityId, t.toStatus])).toEqual(pv.body.transitions.map((t) => [t.entityId, t.toStatus]));

    // AC-1-07 권한 없는 회신 → 422, 상태 불변
    const forbidden = await call<ApiError>(replies.POST(req('', 'POST', { respondentRole: 'MASIL_CEO', outcome: 'APPROVED', reason: '' }), ctx({ id: gcbReq!.id })));
    expect(forbidden.status).toBe(422);
    expect(forbidden.body.error.code).toBe('FORBIDDEN_ROLE');
    expect(forbidden.body.error.message).toContain('그룹 CEO/이사회만 결정할 수 있습니다');

    // S1-5 회신
    const rp1 = await call<ReplyResponse>(replies.POST(req('', 'POST', { respondentRole: 'GROUP_CEO_BOARD', outcome: 'APPROVED', decision: 'RENEGOTIATE', reason: '권고 B 승인 (모의)' }), ctx({ id: contractReq!.id })));
    expect(rp1.status).toBe(201);
    expect(rp1.body.transitions.find((t) => t.entityType === 'CONTRACT')).toMatchObject({ fromStatus: 'PENDING_APPROVAL', toStatus: 'NOTICE_PENDING' });
    expect(rp1.body.createdTasks.map((t) => t.type)).toEqual(['SEND_NOTICE', 'DOCUMENT_CONDITIONS']);
    await call(replies.POST(req('', 'POST', { respondentRole: 'GROUP_CEO_BOARD', outcome: 'APPROVED', reason: '권고안 승인 (모의)' }), ctx({ id: gcbReq!.id })));
    const rp3 = await call<ReplyResponse>(
      replies.POST(req('', 'POST', { respondentRole: 'MASIL_CEO', outcome: 'APPROVED', itemDecisions: [{ itemId: 'PLAN-004', decision: 'APPROVE' }, { itemId: 'PLAN-005', decision: 'REJECT' }], reason: '모의' }), ctx({ id: ceoReq!.id })),
    );
    expect(rp3.body.createdTasks.map((t) => t.type)).toEqual(['REPORT_TO_GROUP']);
    // BE-08 혼합은 통과, 조건부 불일치는 422 (이미 회신된 요청은 409)
    const again = await call<ApiError>(replies.POST(req('', 'POST', { respondentRole: 'MASIL_CEO', outcome: 'APPROVED', reason: '' }), ctx({ id: ceoReq!.id })));
    expect(again.status).toBe(409);

    // S1-6 통보 발송 작업 → 수령확인 회신
    await call(clockAdvance.POST(req('/api/clock/advance', 'POST', { to: '2026-07-13T10:00:00+09:00' })));
    const list = await call<TaskView[]>(tasks.GET(req('/api/tasks?role=CONTRACT_OFFICER')));
    const send = list.body.find((t) => t.type === 'SEND_NOTICE')!;
    const done = await call<TaskPatchResponse>(task.PATCH(req('', 'PATCH', { status: 'DONE', actorRole: 'CONTRACT_OFFICER', resultNote: '조건변경 통보 발송 (모의)' }), ctx({ id: send.id })));
    expect(done.body.transitions.find((t) => t.entityType === 'CONTRACT')).toMatchObject({ toStatus: 'NOTICE_SENT' });
    expect(done.body.createdTasks.map((t) => t.type)).toEqual(['CONFIRM_RECEIPT']);
    await call(clockAdvance.POST(req('/api/clock/advance', 'POST', { to: '2026-07-14T11:00:00+09:00' })));
    const rcp = await call<EventResponse>(events.POST(req('/api/events', 'POST', { type: 'COUNTERPARTY_REPLY', payload: { from: 'AGENCY', outcome: 'RECEIPT_CONFIRMED', note: '에이전시 회신 메일 (모의)' } })));
    expect(rcp.body.transitions.filter((t) => t.entityType === 'CONTRACT').map((t) => t.toStatus)).toEqual(['NOTICE_ACKNOWLEDGED', 'NEGOTIATING']);

    // 과거 시각 이동은 409
    const back = await call<ApiError>(clockAdvance.POST(req('/api/clock/advance', 'POST', { to: '2026-07-01T09:00:00+09:00' })));
    expect([back.status, back.body.error.code]).toEqual([409, 'CLOCK_BACKWARD']);

    // S1-7 7/18 00:00 — 다음 판단 반영
    const ov0 = await call<OverviewView>(overview.GET());
    expect(ov0.body.contract.autoRenewalRisk).toBe(false);
    const fin = await call<ClockResponse>(clockAdvance.POST(req('/api/clock/advance', 'POST', { to: '2026-07-18T00:00:00+09:00' })));
    expect(fin.body.transitions.filter((t) => t.entityType === 'EXPANSION_LINE').map((t) => [t.entityId, t.toStatus])).toEqual([
      ['PLAN-001', 'CANCELLED'],
      ['PLAN-002', 'CANCELLED'],
      ['PLAN-003', 'CANCELLED'],
      ['PLAN-004', 'CONFIRMED'],
      ['PLAN-005', 'CANCELLED'],
    ]);
    const ov = await call<OverviewView>(overview.GET());
    expect(ov.body.contract.status).toBe('NEGOTIATING');
    expect(ov.body.alerts.some((a) => a.subjectIds.includes(C) && a.kind === 'AUTO_RENEWAL')).toBe(false);
    expect(ov.body.timeline.find((x) => x.id === 'TL-LINES-2026-07-17')!.state).toBe('DONE');
    expect(ov.body.poPaymentTotal.value).toBe(3_749_760_000);
    const inf = await call<InfluencersView>(influencers.GET(req('/api/analytics/influencers')));
    expect(inf.body.remaining!.shares['INF-001']!.value).toBe(0); // AC-1-11
    expect(inf.body.rows[0]!.cpRefDef14).toBeUndefined();

    const au = await call<AuditLogEntry[]>(audit.GET(req('/api/audit?entityType=CONTRACT')));
    expect(au.body.map((a) => a.toStatus).reverse()).toEqual(['UNDER_REVIEW', 'PENDING_APPROVAL', 'NOTICE_PENDING', 'NOTICE_SENT', 'NOTICE_ACKNOWLEDGED', 'NEGOTIATING']);
  });
});
