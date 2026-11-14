/** 2단계 도메인 추가분 — 외부 회신 4종 · 작업 시작/취소 · 판단안 기록 · 판단안 → 승인요청 */
import { describe, expect, it } from 'vitest';
import { buildAssessmentBasis } from '@/domain/assessment';
import { MOCK_REPLIES } from '@/domain/mockReplies';
import * as wf from '@/domain/workflow';
import { at, ds, line, tasksOf, toS1_4, toS1_5 } from '../helpers/scenario';

const C = 'CTR-INF-001-2026';
function received() {
  let s = wf.initialState(ds);
  s = wf.receiveRenewalNotice(s).state;
  return wf.receiveProposal(s, ds).state;
}
function draftOf(s: wf.WorldState, subjectType: 'CONTRACT' | 'EXPANSION_LINES', subjectIds: string[]): wf.AssessmentDraft {
  const b = buildAssessmentBasis(s, ds, { subjectType, subjectIds });
  return {
    subjectType,
    subjectIds: b.subjectIds,
    triggerEventId: b.triggerEventId,
    facts: b.facts,
    ruleResults: b.ruleResults,
    alternatives: b.alternatives,
    recommendation: b.mockNarrative.recommendation,
    perspectives: b.mockNarrative.perspectives,
    claimsCited: b.claimsCited,
    unknowns: b.unknowns,
    proposedDecisions: b.proposedDecisions,
    aiMode: 'MOCK',
    model: 'claude-opus-5-5',
    createdAt: s.simNow,
  };
}
function sentNotice(): wf.WorldState {
  let s = toS1_5();
  s = wf.completeTask(wf.advanceClock(s, at('2026-07-13', '10:00')).state, ds, tasksOf(s, 'SEND_NOTICE')[0]!.id, {}).state;
  return wf.advanceClock(s, at('2026-07-14', '11:00')).state;
}
function rejected(): wf.WorldState {
  const s = wf.advanceClock(toS1_4(), at('2026-07-10', '14:00')).state;
  return wf.advanceClock(wf.replyToApproval(s, ds, MOCK_REPLIES.S3_1_REJECT).state, at('2026-07-13', '16:00')).state;
}
function at720WithDrafts(): wf.WorldState {
  let s = wf.counterpartyReply(sentNotice(), ds, MOCK_REPLIES.S1_6_AGENCY_RECEIPT).state;
  s = wf.revalidateLines(wf.advanceClock(s, at('2026-07-20', '09:00')).state, ds).state;
  return wf.draftReplenishment(s, ds, { triggerLineId: 'PLAN-011' }).state;
}

describe('외부 회신 (S-02: 수령확인 · 정보 제공 · 정보 부족 · 거절)', () => {
  it('에이전시 수령확인 → NOTICE_ACKNOWLEDGED → NEGOTIATING (E1)', () => {
    const r = wf.counterpartyReply(sentNotice(), ds, MOCK_REPLIES.S1_6_AGENCY_RECEIPT);
    expect(r.state.contract.status).toBe('NEGOTIATING');
    expect(r.transitions.filter((t) => t.entityType === 'CONTRACT').map((t) => t.toStatus)).toEqual(['NOTICE_ACKNOWLEDGED', 'NEGOTIATING']);
    expect(r.state.receipts).toHaveLength(1);
  });

  it('에이전시 정보 부족 → 정보 요청 작업 DONE(결과 INSUFFICIENT), 계약은 재검토 유지', () => {
    const r = wf.counterpartyReply(rejected(), ds, MOCK_REPLIES.S3_2_AGENCY_INSUFFICIENT);
    expect(tasksOf(r.state, 'INFO_REQUEST')[0]).toMatchObject({ status: 'DONE' });
    expect(tasksOf(r.state, 'INFO_REQUEST')[0]!.resultNote).toMatch(/^INSUFFICIENT/);
    expect(r.state.contract.status).toBe('REVIEW_BEFORE_DEADLINE');
    expect(wf.openGaps(r.state)).toContain('G-02');
  });

  it('에이전시 정보 제공 → 성과 피 조건 기록(모의), G-02 해소', () => {
    const r = wf.counterpartyReply(rejected(), ds, { from: 'AGENCY', outcome: 'INFO_PROVIDED', note: 'GMV 3% 분기 정산 (모의)', label: 'MOCK' });
    expect(r.state.contract.performanceFeeTerms).toBe('GMV 3% 분기 정산 (모의)');
    expect(wf.openGaps(r.state)).not.toContain('G-02');
  });

  it('에이전시 거절 → 작업 DONE(REJECTED), 계약 상태 불변', () => {
    const r = wf.counterpartyReply(rejected(), ds, { from: 'AGENCY', outcome: 'REJECTED', note: '제공 불가 (모의)', label: 'MOCK' });
    expect(tasksOf(r.state, 'INFO_REQUEST')[0]!.resultNote).toMatch(/^REJECTED/);
    expect(r.state.contract.status).toBe('REVIEW_BEFORE_DEADLINE');
  });

  it('SCM 정보 부족 → 초안 유지, SCM 정보 요청만 닫힘, 보충 검토 작업은 열림', () => {
    const r = wf.counterpartyReply(at720WithDrafts(), ds, MOCK_REPLIES.S4_SCM_INSUFFICIENT);
    expect(r.state.replenishments.every((x) => x.status === 'DRAFT')).toBe(true);
    expect(tasksOf(r.state, 'INFO_REQUEST').find((t) => t.ownerRole === 'SCM')!.status).toBe('DONE');
    expect(tasksOf(r.state, 'REPLENISHMENT_REVIEW')[0]!.status).toBe('OPEN');
    expect(wf.recommendLine(line(r.state, 'PLAN-011')).decision).toBe('CONDITIONAL');
  });

  it('SCM 거절(보충 불가) → 보충 REJECTED · PLAN-011 공급 NO_SUPPLY → 권고 REJECT', () => {
    const r = wf.counterpartyReply(at720WithDrafts(), ds, { from: 'SCM', outcome: 'REJECTED', note: 'Corevia F1 포화 — 추가 생산 불가 (모의)', label: 'MOCK' });
    expect(r.state.replenishments.every((x) => x.status === 'REJECTED')).toBe(true);
    expect(line(r.state, 'PLAN-011').supplyOutlook).toBe('NO_SUPPLY');
    expect(wf.recommendLine(line(r.state, 'PLAN-011')).decision).toBe('REJECT');
  });

  it('SCM 정보 제공에 추가 발주 여부가 없으면 VALIDATION, 수령확인은 에이전시만', () => {
    expect(() => wf.counterpartyReply(at720WithDrafts(), ds, { from: 'SCM', outcome: 'INFO_PROVIDED', note: '', label: 'MOCK' })).toThrow(expect.objectContaining({ code: 'VALIDATION', httpStatus: 422 }));
    expect(() => wf.counterpartyReply(at720WithDrafts(), ds, { from: 'SCM', outcome: 'RECEIPT_CONFIRMED', note: '', label: 'MOCK' })).toThrow(expect.objectContaining({ code: 'VALIDATION' }));
  });

  it('Corevia 정보 제공(입고일) → SCM 정보 요청 닫고 PLAN-011 입고 예정일 기록', () => {
    const r = wf.counterpartyReply(at720WithDrafts(), ds, { from: 'COREVIA', outcome: 'INFO_PROVIDED', note: 'SPO-0001~0004 9/18 입고 (모의)', inboundExpectedDate: '2026-09-18', label: 'MOCK' });
    expect(line(r.state, 'PLAN-011').inboundExpectedDate).toBe('2026-09-18');
    expect(tasksOf(r.state, 'INFO_REQUEST').find((t) => t.ownerRole === 'SCM')!.status).toBe('DONE');
  });
});

describe('작업 시작 · 취소 (S-07)', () => {
  it('OPEN → IN_PROGRESS 이력, 이미 진행 중이면 409', () => {
    const s = toS1_5();
    const t = tasksOf(s, 'SEND_NOTICE')[0]!;
    const r = wf.startTask(s, t.id, 'CONTRACT_OFFICER');
    expect(r.state.tasks.find((x) => x.id === t.id)!.status).toBe('IN_PROGRESS');
    expect(r.transitions[0]).toMatchObject({ entityType: 'TASK', fromStatus: 'OPEN', toStatus: 'IN_PROGRESS', actorKind: 'HUMAN' });
    expect(() => wf.startTask(r.state, t.id, 'CONTRACT_OFFICER')).toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION', httpStatus: 409 }));
  });

  it('취소는 사유 필수(422), 취소 후 다시 완료할 수 없다(409)', () => {
    const s = toS1_5();
    const t = tasksOf(s, 'DOCUMENT_CONDITIONS')[0]!;
    expect(() => wf.cancelTask(s, t.id, { actorRole: 'CONTRACT_OFFICER', reason: ' ' })).toThrow(expect.objectContaining({ httpStatus: 422 }));
    const r = wf.cancelTask(s, t.id, { actorRole: 'CONTRACT_OFFICER', reason: '중복 작업' });
    expect(r.state.tasks.find((x) => x.id === t.id)).toMatchObject({ status: 'CANCELLED', resultNote: '중복 작업' });
    expect(() => wf.completeTask(r.state, ds, t.id, {})).toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION' }));
  });
});

describe('판단안 기록 · 판단안 → 승인요청', () => {
  it('ASM-001(계약) · ASM-002(기안) 기록 → 승인요청 APR-001~003 에 판단안 ID 가 채워진다 (AC-1-06)', () => {
    let s = received();
    const a1 = wf.recordAssessment(s, draftOf(s, 'CONTRACT', [C]));
    s = a1.state;
    expect(a1.assessment).toMatchObject({ id: 'ASM-001', version: 1 });
    expect(a1.transitions[0]).toMatchObject({ entityType: 'ASSESSMENT', toStatus: 'CREATED', actorKind: 'MOCK' });
    expect(s.contract.status).toBe('UNDER_REVIEW'); // 판단안은 상태를 바꾸지 않는다
    const ids = ['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-004', 'PLAN-005'];
    const a2 = wf.recordAssessment(s, draftOf(s, 'EXPANSION_LINES', ids));
    s = a2.state;
    s = wf.requestApprovalFromAssessment(s, 'ASM-001').state;
    const r = wf.requestApprovalFromAssessment(s, 'ASM-002');
    s = r.state;
    expect(s.approvals.map((a) => [a.id, a.requiredRole, a.assessmentId, a.hardDeadline])).toEqual([
      ['APR-001', 'GROUP_CEO_BOARD', 'ASM-001', '2026-07-17'],
      ['APR-002', 'GROUP_CEO_BOARD', 'ASM-002', '2026-07-17'],
      ['APR-003', 'MASIL_CEO', 'ASM-002', '2026-07-17'],
    ]);
    expect(s.approvals[0]!.proposed).toEqual([{ itemId: C, decision: 'RENEGOTIATE' }]);
    expect(s.approvals[1]!.proposed.map((p) => p.decision)).toEqual(['REJECT', 'REJECT', 'REJECT']);
    expect(s.contract.status).toBe('PENDING_APPROVAL');
    expect(ids.every((id) => line(s, id).status === 'PENDING_APPROVAL')).toBe(true);
  });

  it('같은 대상 재판단은 version + 1, 판단안 ID 가 빈 대기 요청(② 자동 재상신 APR-004)에 연결', () => {
    let s = wf.advanceClock(toS1_5(), at('2026-07-14', '10:00')).state;
    s = wf.arCollectionDelayed(s, ds, { arId: 'MAR-0004', newDueDate: '2026-08-30' }).state;
    const apr4 = s.approvals.find((a) => a.subjectIds.includes('PLAN-004') && a.status === 'PENDING')!;
    expect(apr4.assessmentId).toBeNull();
    const r1 = wf.recordAssessment(s, draftOf(s, 'EXPANSION_LINES', ['PLAN-004']));
    expect(r1.state.approvals.find((a) => a.id === apr4.id)!.assessmentId).toBe(r1.assessment.id);
    const r2 = wf.recordAssessment(r1.state, draftOf(r1.state, 'EXPANSION_LINES', ['PLAN-004']));
    expect(r2.assessment.version).toBe(2);
  });

  it('권한 없는 회신 메시지는 화면 문구 그대로 (UI-04)', () => {
    const s = wf.advanceClock(toS1_4(), at('2026-07-10', '14:00')).state;
    expect(() => wf.replyToApproval(s, ds, { requestId: 'APR-002', respondentRole: 'MASIL_CEO', outcome: 'APPROVED', reason: '' })).toThrow('그룹 CEO/이사회만 결정할 수 있습니다');
  });
});
