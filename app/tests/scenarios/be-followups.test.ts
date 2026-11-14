/** 기획 7-2절 백엔드 작업 BE-01 ~ BE-05 · BE-08 (+ AC-2-09) — 테스트 먼저 */
import { describe, expect, it } from 'vitest';
import { MOCK_REPLIES } from '@/domain/mockReplies';
import * as wf from '@/domain/workflow';
import type { AuditLogEntry } from '@/domain/types';
import { recordMockAssessment } from '@/server/scenarios';
import { at, ds, line, tasksOf, toS1_4, toS1_5 } from '../helpers/scenario';

/** 한 엔티티 이력의 연속성: 모든 행의 fromStatus = 직전 행 toStatus */
function continuous(rows: AuditLogEntry[]): boolean {
  return rows.every((r, i) => i === 0 || r.fromStatus === rows[i - 1]!.toStatus);
}

describe('AC-2-09 · BE-02 대기 중 건의 권한 상향 (RESUBMIT_PENDING) — 이력이 끊기지 않는다', () => {
  const s0 = wf.advanceClock(toS1_4(), at('2026-07-10', '09:00')).state;
  const apr3 = s0.approvals.find((a) => a.subjectIds.includes('PLAN-004'))!;
  const r = wf.arCollectionDelayed(s0, ds, { arId: 'MAR-0004', newDueDate: '2026-08-30' });
  const s = r.state;

  it('APR-003 SUPERSEDED, PLAN-004 → GCB 새 요청 · PLAN-005 → MASIL_CEO 새 요청 (둘 다 version 2, supersedes APR-003)', () => {
    expect(s.approvals.find((a) => a.id === apr3.id)!.status).toBe('SUPERSEDED');
    const n4 = s.approvals.find((a) => a.status === 'PENDING' && a.subjectIds.includes('PLAN-004'))!;
    const n5 = s.approvals.find((a) => a.status === 'PENDING' && a.subjectIds.includes('PLAN-005'))!;
    expect(n4).toMatchObject({ requiredRole: 'GROUP_CEO_BOARD', version: 2, supersedesId: apr3.id });
    expect(n5).toMatchObject({ requiredRole: 'MASIL_CEO', version: 2, supersedesId: apr3.id });
    expect(line(s, 'PLAN-004').approvalRequestId).toBe(n4.id);
    expect(line(s, 'PLAN-005').approvalRequestId).toBe(n5.id);
  });

  it('두 건 PENDING_APPROVAL 유지, 각 건 이력 연속 (전이표 밖 VALIDATED 없음)', () => {
    for (const id of ['PLAN-004', 'PLAN-005']) {
      expect(line(s, id).status).toBe('PENDING_APPROVAL');
      const rows = s.audit.filter((a) => a.entityType === 'EXPANSION_LINE' && a.entityId === id);
      expect(continuous(rows)).toBe(true);
      expect(rows.some((x) => x.toStatus === 'VALIDATED' && x.fromStatus === 'PENDING_APPROVAL')).toBe(false);
    }
    const resub = s.audit.filter((a) => a.entityId === 'PLAN-004' && a.reason.includes('재상신'));
    expect(resub).toHaveLength(1);
    expect(resub[0]).toMatchObject({ fromStatus: 'PENDING_APPROVAL', toStatus: 'PENDING_APPROVAL' });
    expect(resub[0]!.ruleIds).toContain('R-AUTH-06');
  });

  it('APR-003 에 MASIL_CEO 회신 → 409 (이미 SUPERSEDED)', () => {
    expect(() => wf.replyToApproval(s, ds, { requestId: apr3.id, respondentRole: 'MASIL_CEO', outcome: 'APPROVED', reason: '' })).toThrow(expect.objectContaining({ httpStatus: 409 }));
  });
});

describe('BE-04 재승인 요청 version = 이전 + 1 (AC-2-03)', () => {
  it('② PLAN-004 새 요청 version 2 · supersedes 이전 요청 · 최종 PENDING_APPROVAL', () => {
    const s0 = wf.advanceClock(toS1_5(), at('2026-07-14', '10:00')).state;
    const prev = line(s0, 'PLAN-004').approvalRequestId!;
    const s = wf.arCollectionDelayed(s0, ds, { arId: 'MAR-0004', newDueDate: '2026-08-30' }).state;
    const n = s.approvals.find((a) => a.status === 'PENDING' && a.subjectIds.includes('PLAN-004'))!;
    expect(n).toMatchObject({ version: 2, supersedesId: prev, requiredRole: 'GROUP_CEO_BOARD', internalDueAt: '2026-07-16T23:59:59+09:00' });
    expect(n.subjectIds).toEqual(['PLAN-004']);
    expect(line(s, 'PLAN-004').status).toBe('PENDING_APPROVAL');
    expect(line(s, 'PLAN-004').approvedByRole ?? null).toBeNull();
    const rows = s.audit.filter((a) => a.entityId === 'PLAN-004' && a.entityType === 'EXPANSION_LINE');
    expect(continuous(rows)).toBe(true);
  });
});

describe('BE-01 수령 미확인 에스컬레이션 = ESCALATE_NOTICE_UNCONFIRMED (AC-3-05)', () => {
  it('NOTICE_UNCONFIRMED 때 ESCALATE 2건(GCB · 계약 담당, 7/24), INCIDENT_AUTO_RENEWAL 0건', () => {
    let s = toS1_5();
    s = wf.completeTask(wf.advanceClock(s, at('2026-07-16', '10:00')).state, ds, tasksOf(s, 'SEND_NOTICE')[0]!.id, {}).state;
    s = wf.advanceClock(s, '2026-07-18T00:00:00+09:00').state;
    expect(s.contract.status).toBe('NOTICE_UNCONFIRMED');
    const esc = tasksOf(s, 'ESCALATE_NOTICE_UNCONFIRMED');
    expect(esc.map((t) => t.ownerRole).sort()).toEqual(['CONTRACT_OFFICER', 'GROUP_CEO_BOARD']);
    expect(esc.every((t) => t.dueAt === '2026-07-24T23:59:59+09:00')).toBe(true);
    expect(tasksOf(s, 'INCIDENT_AUTO_RENEWAL')).toHaveLength(0);
  });
});

describe('BE-03 ④ SCM 작업 기한 A-27 = min(생성일 + 3일, 확정기한 − 2일)', () => {
  it('7/20 초안 → INFO_REQUEST · REPLENISHMENT_REVIEW 기한 7/23 23:59:59', () => {
    let s = toS1_5();
    s = wf.completeTask(wf.advanceClock(s, at('2026-07-13', '10:00')).state, ds, tasksOf(s, 'SEND_NOTICE')[0]!.id, {}).state;
    s = wf.recordNoticeReceipt(wf.advanceClock(s, at('2026-07-14', '11:00')).state, { evidence: '모의' }).state;
    s = wf.revalidateLines(wf.advanceClock(s, at('2026-07-20', '09:00')).state, ds).state;
    s = wf.draftReplenishment(s, ds, { triggerLineId: 'PLAN-011' }).state;
    const due = [...tasksOf(s, 'REPLENISHMENT_REVIEW'), ...tasksOf(s, 'INFO_REQUEST').filter((t) => t.ownerRole === 'SCM')].map((t) => t.dueAt);
    expect(due).toEqual(['2026-07-23T23:59:59+09:00', '2026-07-23T23:59:59+09:00']);
  });
});

describe('BE-05 모의 회신은 요청 번호가 아니라 대상 · 상태로 요청을 찾는다', () => {
  it('모의 회신 데이터에 requestId 하드코딩이 없다', () => {
    const all = Object.values(MOCK_REPLIES).flatMap((v) => (Array.isArray(v) ? v : [v])) as object[];
    expect(all.some((x) => 'requestId' in x)).toBe(false);
  });

  it('③-A 재상신 요청(번호 무관)에 S3_3_APPROVE_TERMINATE 가 덮어쓰기 없이 붙는다', () => {
    let s = wf.advanceClock(toS1_4(), at('2026-07-10', '14:00')).state;
    s = wf.replyToApproval(s, ds, MOCK_REPLIES.S3_1_REJECT).state;
    s = wf.recordCounterpartyReply(wf.advanceClock(s, at('2026-07-13', '16:00')).state, MOCK_REPLIES.S3_2_AGENCY_INSUFFICIENT).state;
    s = recordMockAssessment(wf.advanceClock(s, at('2026-07-14', '10:00')).state, ds, { subjectType: 'CONTRACT', subjectIds: ['CTR-INF-001-2026'] }).state; // BE-22: 재상신 근거 판단안
    s = wf.completeTask(s, ds, tasksOf(s, 'RESUBMIT')[0]!.id, { payload: { proposedDecision: 'TERMINATE' } }).state;
    s = wf.replyToApproval(wf.advanceClock(s, at('2026-07-15', '10:00')).state, ds, MOCK_REPLIES.S3_3_APPROVE_TERMINATE).state;
    expect(s.contract).toMatchObject({ status: 'NOTICE_PENDING', decision: 'TERMINATE' });
  });

  it('대상에 맞는 대기 요청이 없으면 404', () => {
    expect(() => wf.replyToApproval(wf.initialState(ds), ds, MOCK_REPLIES.S3_1_REJECT)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }));
  });
});

describe('BE-08 기안 건 회신 outcome ↔ 건별 결정 불일치는 422 · 상태 불변', () => {
  const s = wf.advanceClock(toS1_4(), at('2026-07-10', '14:00')).state;
  const apr3 = s.approvals.find((a) => a.subjectIds.includes('PLAN-004'))!;

  it('CONDITIONAL 건이 있는데 outcome APPROVED → 422', () => {
    expect(() =>
      wf.replyToApproval(s, ds, { requestId: apr3.id, respondentRole: 'MASIL_CEO', outcome: 'APPROVED', itemDecisions: [{ itemId: 'PLAN-004', decision: 'CONDITIONAL', condition: '집행일 조정' }], reason: '' }),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION', httpStatus: 422 }));
  });

  it('APPROVED_WITH_CONDITIONS 인데 CONDITIONAL 건 없음 → 422', () => {
    expect(() =>
      wf.replyToApproval(s, ds, { requestId: apr3.id, respondentRole: 'MASIL_CEO', outcome: 'APPROVED_WITH_CONDITIONS', itemDecisions: [{ itemId: 'PLAN-004', decision: 'APPROVE' }], reason: '' }),
    ).toThrow(expect.objectContaining({ code: 'VALIDATION', httpStatus: 422 }));
  });

  it('혼합 승인 · 부결은 APPROVED 로 통과', () => {
    const r = wf.replyToApproval(s, ds, { requestId: apr3.id, respondentRole: 'MASIL_CEO', outcome: 'APPROVED', itemDecisions: [{ itemId: 'PLAN-004', decision: 'APPROVE' }, { itemId: 'PLAN-005', decision: 'REJECT' }], reason: '' });
    expect([line(r.state, 'PLAN-004').status, line(r.state, 'PLAN-005').status]).toEqual(['APPROVED', 'REJECTED']);
  });
});

describe('BE-09 (선택) 보충요청 권한 재판정', () => {
  it('지급일 8/24 SCM 대기 요청 → 재전망 v2(7/21~8/28) 뒤 GCB 로 재상신 (version 2, SUPERSEDED)', () => {
    let s = toS1_5();
    s = wf.completeTask(wf.advanceClock(s, at('2026-07-13', '10:00')).state, ds, tasksOf(s, 'SEND_NOTICE')[0]!.id, {}).state;
    s = wf.recordNoticeReceipt(wf.advanceClock(s, at('2026-07-14', '11:00')).state, { evidence: '모의' }).state;
    // 7/30 초안 → 지급일 8/24 (v1 하회 구간 7/21~8/21 밖 → SCM)
    s = wf.revalidateLines(wf.advanceClock(s, at('2026-07-30', '09:00')).state, ds).state;
    s = wf.draftReplenishment(s, ds, { triggerLineId: 'PLAN-011' }).state;
    expect(s.replenishments[0]).toMatchObject({ expectedPaymentDate: '2026-08-24', requiredRole: 'SCM' });
    s = wf.scmReview(s, ds, MOCK_REPLIES.S4B_SCM_NEEDED).state;
    const old = s.approvals.at(-1)!;
    expect(old).toMatchObject({ subjectType: 'REPLENISHMENT', requiredRole: 'SCM' });
    s = wf.arCollectionDelayed(s, ds, { arId: 'MAR-0004', newDueDate: '2026-08-30' }).state;
    expect(s.approvals.find((a) => a.id === old.id)!.status).toBe('SUPERSEDED');
    expect(s.approvals.at(-1)).toMatchObject({ subjectType: 'REPLENISHMENT', requiredRole: 'GROUP_CEO_BOARD', version: 2, supersedesId: old.id, status: 'PENDING' });
    expect(s.replenishments.every((r) => r.requiredRole === 'GROUP_CEO_BOARD')).toBe(true);
  });
});
