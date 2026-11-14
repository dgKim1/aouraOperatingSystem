/** ③ 정보 부족 + 승인 거절 — AC-3-01 ~ AC-3-08 (AC-3-02 판단안 문장은 2단계) */
import { describe, expect, it } from 'vitest';
import * as wf from '@/domain/workflow';
import { MOCK_REPLIES, MOCK_REPLY_DATASET } from '@/domain/mockReplies';
import { at, ds, tasksOf, toS1_4 } from '../helpers/scenario';

function rejected() {
  const s = wf.advanceClock(toS1_4(), at('2026-07-10', '14:00')).state;
  return wf.replyToApproval(s, ds, MOCK_REPLIES.S3_1_REJECT);
}

describe('③ 정보 부족 · 거절', () => {
  it('AC-3-01 그룹 CEO/이사회 REJECTED → REVIEW_BEFORE_DEADLINE + 작업 3종 각 1건, 미갱신 확정 아님', () => {
    const s = rejected().state;
    expect(s.contract.status).toBe('REVIEW_BEFORE_DEADLINE');
    expect(s.contract.decision).toBeNull();
    expect(tasksOf(s, 'INFO_REQUEST')).toHaveLength(1);
    expect(tasksOf(s, 'INFO_REQUEST')[0]).toMatchObject({ ownerRole: 'CONTRACT_OFFICER', dueAt: '2026-07-13T23:59:59+09:00' });
    expect(tasksOf(s, 'REVIEW_BEFORE_DEADLINE')).toHaveLength(1);
    expect(tasksOf(s, 'RESUBMIT')).toHaveLength(1);
    expect(tasksOf(s, 'RESUBMIT')[0]!.dueAt).toBe('2026-07-15T23:59:59+09:00');
    expect(s.approvals[0]!.status).toBe('REJECTED');
    expect(wf.deadlineView(s).contract.level).toBe('WARNING');
  });

  it('AC-3-02 (도메인 부분) 에이전시 INSUFFICIENT → INFO_REQUEST DONE, 성과 피(G-02) 미해결', () => {
    let s = wf.advanceClock(rejected().state, at('2026-07-13', '16:00')).state;
    s = wf.recordCounterpartyReply(s, MOCK_REPLIES.S3_2_AGENCY_INSUFFICIENT).state;
    const t = tasksOf(s, 'INFO_REQUEST')[0]!;
    expect(t.status).toBe('DONE');
    expect(t.resultNote).toContain('INSUFFICIENT');
    expect(s.contract.performanceFeeTerms).toBeNull();
    expect(wf.openGaps(s)).toContain('G-02');
  });

  // 주: DEMO_SCENARIOS 의 'APR-005' 는 ① → ② 연속 진행 시 번호. ③ 프리셋(① S1-4 까지만 재생)에서는 APR-004 가 된다 — 의미(v2 · supersedes)로 검증
  it('AC-3-03 재상신 → 새 요청 version 2, supersedes APR-001 (REJECTED 는 그대로 + 링크)', () => {
    let s = wf.advanceClock(rejected().state, at('2026-07-14', '10:00')).state;
    s = wf.completeTask(s, ds, tasksOf(s, 'RESUBMIT')[0]!.id, { resultNote: '해지 통보안으로 재상신', payload: { proposedDecision: 'TERMINATE' } }).state;
    const apr5 = s.approvals.at(-1)!;
    expect(apr5.id).toBe('APR-004');
    expect(apr5).toMatchObject({ version: 2, supersedesId: 'APR-001', requiredRole: 'GROUP_CEO_BOARD', status: 'PENDING' });
    expect(s.approvals.find((a) => a.id === 'APR-001')!.status).toBe('REJECTED');
    expect(s.contract.status).toBe('PENDING_APPROVAL');
  });

  function branchA() {
    let s = wf.advanceClock(rejected().state, at('2026-07-14', '10:00')).state;
    s = wf.completeTask(s, ds, tasksOf(s, 'RESUBMIT')[0]!.id, { payload: { proposedDecision: 'TERMINATE' } }).state;
    s = wf.advanceClock(s, at('2026-07-15', '10:00')).state;
    s = wf.replyToApproval(s, ds, { ...MOCK_REPLIES.S3_3_APPROVE_TERMINATE, requestId: s.approvals.at(-1)!.id }).state;
    expect(s.contract.status).toBe('NOTICE_PENDING');
    s = wf.advanceClock(s, at('2026-07-16', '10:00')).state;
    s = wf.completeTask(s, ds, tasksOf(s, 'SEND_NOTICE')[0]!.id, {}).state;
    expect(s.contract.status).toBe('NOTICE_SENT');
    return s;
  }

  it('AC-3-04 NOTICE_SENT 수령 미확인 → 7/17 09:00 RENOTIFY 1건 (중복 없음) → 수령확인 시 TERMINATING', () => {
    let s = branchA();
    s = wf.advanceClock(s, at('2026-07-17', '08:59')).state;
    expect(tasksOf(s, 'RENOTIFY')).toHaveLength(0);
    s = wf.advanceClock(s, at('2026-07-17', '09:00')).state;
    expect(tasksOf(s, 'RENOTIFY')).toHaveLength(1);
    s = wf.advanceClock(s, at('2026-07-17', '12:00')).state;
    expect(tasksOf(s, 'RENOTIFY')).toHaveLength(1);
    s = wf.advanceClock(s, at('2026-07-17', '15:00')).state;
    s = wf.recordNoticeReceipt(s, { evidence: '에이전시 수령 회신 (모의)' }).state;
    expect(s.contract.status).toBe('TERMINATING');
    s = wf.advanceClock(s, at('2026-07-18', '00:00')).state;
    expect(s.contract.status).toBe('TERMINATING');
  });

  it('AC-3-05 수령 미확인으로 7/18 00:00 → NOTICE_UNCONFIRMED (AUTO_RENEWED 아님) + 에스컬레이션', () => {
    const s = wf.advanceClock(branchA(), at('2026-07-18', '00:00')).state;
    expect(s.contract.status).toBe('NOTICE_UNCONFIRMED');
    const esc = s.tasks.filter((t) => t.type === 'ESCALATE_NOTICE_UNCONFIRMED');
    expect(esc.map((t) => t.ownerRole).sort()).toEqual(['CONTRACT_OFFICER', 'GROUP_CEO_BOARD']);
    expect(tasksOf(s, 'INCIDENT_AUTO_RENEWAL')).toHaveLength(0); // BE-01
    expect(tasksOf(s, 'RENOTIFY')).toHaveLength(1); // 기한 당일 09:00 를 지나쳐 이동해도 1회 생성
  });

  it('AC-3-06 분기 B: REVIEW_BEFORE_DEADLINE 방치 → 7/18 AUTO_RENEWED + INCIDENT_AUTO_RENEWAL, SYSTEM 이력, 미결 요청 EXPIRED', () => {
    let s = rejected().state;
    const r = wf.advanceClock(s, at('2026-07-18', '00:00'));
    s = r.state;
    expect(s.contract.status).toBe('AUTO_RENEWED');
    const inc = tasksOf(s, 'INCIDENT_AUTO_RENEWAL');
    expect(inc).toHaveLength(1);
    expect(inc[0]).toMatchObject({ ownerRole: 'GROUP_CEO_BOARD', dueAt: '2026-07-24T23:59:59+09:00' });
    const a = s.audit.find((x) => x.entityType === 'CONTRACT' && x.toStatus === 'AUTO_RENEWED')!;
    expect(a.actorKind).toBe('SYSTEM');
    expect(a.ruleIds).toContain('R-DL-02');
    expect(a.reason).toContain('권한 미경유 체결');
    // APR-002 · 003 미회신 → EXPIRED, PLAN-001~005 AUTO_CONFIRMED + POST_DEADLINE_REPORT
    expect(s.approvals.filter((x) => x.status === 'EXPIRED').map((x) => x.id)).toEqual(['APR-002', 'APR-003']);
    expect(s.lines.filter((l) => l.status === 'AUTO_CONFIRMED').map((l) => l.id)).toEqual(['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-004', 'PLAN-005']);
    expect(tasksOf(s, 'POST_DEADLINE_REPORT')).toHaveLength(5);
  });

  it('③-B 다음 판단 반영: AUTO_RENEWED 이면 해지 대안 비용 = 위약금 (AC-3-07 값)', () => {
    const s = wf.advanceClock(rejected().state, at('2026-07-18', '00:00')).state;
    const view = wf.contractConsequences(s);
    expect(view.committedTermKrw).toBe(2_800_000_000);
    expect(view.renewalTerm).toEqual({ start: '2026-09-01', end: '2027-08-31' });
    expect(wf.contractConsequences(s, '2026-09-30').penaltyKrw).toBe(1_283_333_333);
    expect(wf.contractConsequences(s, '2026-12-31').penaltyKrw).toBe(933_333_333);
    // 갱신 전 상태에서는 위약금 없음 (만료 전 통보)
    expect(wf.contractConsequences(rejected().state, '2026-09-30').penaltyKrw).toBe(0);
  });

  it('AC-3-08 모의 회신 데이터셋에 REJECTED · INFO_REQUESTED · INSUFFICIENT 가 각 1건 이상', () => {
    const outcomes = MOCK_REPLY_DATASET.map((r) => r.outcome);
    expect(outcomes).toContain('REJECTED');
    expect(outcomes).toContain('INFO_REQUESTED');
    expect(outcomes).toContain('INSUFFICIENT');
    expect(MOCK_REPLY_DATASET.every((r) => r.label === 'MOCK')).toBe(true);
  });

  it('INFO_REQUESTED 회신도 기한 전 재검토로 간다 (정보 요청 작업 포함)', () => {
    const s = wf.advanceClock(toS1_4(), at('2026-07-10', '14:00')).state;
    const r = wf.replyToApproval(s, ds, MOCK_REPLIES.S3_ALT_INFO_REQUESTED);
    expect(r.state.contract.status).toBe('REVIEW_BEFORE_DEADLINE');
    expect(r.state.approvals[0]!.status).toBe('INFO_REQUESTED');
    expect(tasksOf(r.state, 'INFO_REQUEST')).toHaveLength(1);
  });

  it('기안 건 INFO_REQUESTED → ON_HOLD + REVIEW_BEFORE_DEADLINE, 방치하면 기한에 AUTO_CONFIRMED', () => {
    let s = wf.advanceClock(toS1_4(), at('2026-07-10', '14:00')).state;
    s = wf.replyToApproval(s, ds, { requestId: 'APR-003', respondentRole: 'MASIL_CEO', outcome: 'INFO_REQUESTED', reason: '재고 확인 후 재상신 (모의)' }).state;
    expect(s.lines.find((l) => l.id === 'PLAN-004')!.status).toBe('ON_HOLD');
    expect(tasksOf(s, 'REVIEW_BEFORE_DEADLINE').some((t) => t.subjectId === 'PLAN-004')).toBe(true);
    s = wf.advanceClock(s, at('2026-07-18', '00:00')).state;
    expect(s.lines.find((l) => l.id === 'PLAN-004')!.status).toBe('AUTO_CONFIRMED');
  });
});
