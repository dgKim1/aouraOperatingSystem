/** ① 정상 흐름 — AC-1-01 ~ AC-1-11 (AC-1-05 판단안 · AI 는 2단계) */
import { describe, expect, it } from 'vitest';
import * as wf from '@/domain/workflow';
import { DomainError } from '@/domain/errors';
import { requestShareRemaining } from '@/domain/performance';
import { at, ds, line, tasksOf, toS1_4, toS1_5 } from '../helpers/scenario';

describe('① 정상 흐름', () => {
  it('시드: simNow 2026-07-01 09:00, 계약 ACTIVE, 재전망 v1 하회 구간 7/21~8/21', () => {
    const s = wf.initialState(ds);
    expect(s.simNow).toBe(at('2026-07-01'));
    expect(s.contract.status).toBe('ACTIVE');
    expect(s.contract.fixedFeeAnnualKrw).toBe(2_800_000_000);
    expect(s.forecast.breachWindows).toEqual([{ start: '2026-07-21', end: '2026-08-21' }]);
    expect(s.audit).toHaveLength(0);
  });

  it('AC-1-01 갱신 통보 접수 → UNDER_REVIEW, 이력 1행 (HUMAN)', () => {
    const r = wf.receiveRenewalNotice(wf.initialState(ds));
    expect(r.state.contract.status).toBe('UNDER_REVIEW');
    expect(r.state.audit).toHaveLength(1);
    expect(r.state.audit[0]).toMatchObject({ fromStatus: 'ACTIVE', toStatus: 'UNDER_REVIEW', actorKind: 'HUMAN', actorRole: 'CONTRACT_OFFICER' });
    expect(r.state.audit[0]!.eventId).toBe(r.event.id);
    expect(r.event.label).toBe('ORIGINAL');
  });

  it('AC-1-02 · AC-1-04 기안 접수 → 25건 VALIDATED, 권한자 · CONTRACT_PENDING', () => {
    let s = wf.receiveRenewalNotice(wf.initialState(ds)).state;
    s = wf.receiveProposal(s, ds).state;
    expect(s.lines).toHaveLength(25);
    expect(s.lines.every((l) => l.status === 'VALIDATED')).toBe(true);
    expect(s.proposal?.totalRequestedKrw).toBe(180_803_272);
    expect(wf.contractRouting(s).requiredRole).toBe('GROUP_CEO_BOARD');
    for (const id of ['PLAN-001', 'PLAN-002', 'PLAN-003']) {
      expect(line(s, id).routing?.requiredRole).toBe('GROUP_CEO_BOARD');
      expect(line(s, id).routing?.reasons.map((r) => r.ruleId)).toContain('R-AUTH-03');
      expect(line(s, id).flags).toContain('CONTRACT_PENDING');
    }
    for (const id of ['PLAN-004', 'PLAN-005']) {
      expect(line(s, id).routing?.requiredRole).toBe('MASIL_CEO');
      expect(line(s, id).routing?.alsoReportTo).toContain('GROUP_CEO_BOARD');
      expect(line(s, id).flags).not.toContain('CONTRACT_PENDING');
      expect(line(s, id).flags).toContain('OVER_10M');
    }
    expect(s.lines.filter((l) => l.flags.includes('OVER_10M')).map((l) => l.id)).toEqual(['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-004', 'PLAN-005']);
    expect(s.lines.filter((l) => l.flags.includes('SETTLEMENT_BEFORE_DEADLINE'))).toHaveLength(12);
    expect(line(s, 'PLAN-004').flags).toContain('CP_POSITIVE');
    expect(line(s, 'PLAN-001').flags).toContain('CP_NEGATIVE');
    expect(line(s, 'PLAN-006').flags).toContain('CP_REF_SIGN_DIFFERS');
  });

  it('권고: PLAN-001 · 002 · 003 · 005 부결, PLAN-004 승인 (ASM-002)', () => {
    const s = wf.receiveProposal(wf.receiveRenewalNotice(wf.initialState(ds)).state, ds).state;
    const rec = Object.fromEntries(['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-004', 'PLAN-005'].map((id) => [id, wf.recommendLine(line(s, id)).decision]));
    expect(rec).toEqual({ 'PLAN-001': 'REJECT', 'PLAN-002': 'REJECT', 'PLAN-003': 'REJECT', 'PLAN-004': 'APPROVE', 'PLAN-005': 'REJECT' });
  });

  it('AC-1-06 승인요청 3건 (APR-001~003) · requiredRole · 기한, 계약 · 5건 PENDING_APPROVAL', () => {
    const s = toS1_4();
    expect(s.approvals.map((a) => [a.id, a.subjectType, a.requiredRole, a.subjectIds, a.internalDueAt, a.hardDeadline])).toEqual([
      ['APR-001', 'CONTRACT', 'GROUP_CEO_BOARD', ['CTR-INF-001-2026'], '2026-07-15T23:59:59+09:00', '2026-07-17'],
      ['APR-002', 'EXPANSION_LINES', 'GROUP_CEO_BOARD', ['PLAN-001', 'PLAN-002', 'PLAN-003'], '2026-07-16T23:59:59+09:00', '2026-07-17'],
      ['APR-003', 'EXPANSION_LINES', 'MASIL_CEO', ['PLAN-004', 'PLAN-005'], '2026-07-16T23:59:59+09:00', '2026-07-17'],
    ]);
    expect(s.approvals[2]!.alsoReportTo).toEqual(['GROUP_CEO_BOARD']);
    expect(s.approvals[1]!.routingReasons.map((r) => r.ruleId)).toContain('R-AUTH-03');
    expect(s.contract.status).toBe('PENDING_APPROVAL');
    for (const id of ['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-004', 'PLAN-005']) expect(line(s, id).status).toBe('PENDING_APPROVAL');
    expect(s.audit.length).toBeGreaterThanOrEqual(6);
  });

  it('AC-1-07 APR-002 에 MASIL_CEO 회신 → 422, 상태 변화 없음', () => {
    const s = toS1_4();
    const before = JSON.stringify(s);
    try {
      wf.replyToApproval(s, ds, { requestId: 'APR-002', respondentRole: 'MASIL_CEO', outcome: 'APPROVED', reason: '시도' });
      expect.unreachable();
    } catch (e) {
      expect((e as DomainError).code).toBe('FORBIDDEN_ROLE');
      expect((e as DomainError).httpStatus).toBe(422);
    }
    expect(JSON.stringify(s)).toBe(before);
  });

  it('R-AUTH-05 AI · 시스템은 회신할 수 없다', () => {
    const s = toS1_4();
    expect(() => wf.replyToApproval(s, ds, { requestId: 'APR-001', respondentRole: 'AI_AGENT' as never, outcome: 'APPROVED', decision: 'RENEW_SAME', reason: '' })).toThrow(DomainError);
  });

  it('AC-1-08 S1-5 회신 → 계약 NOTICE_PENDING + SEND_NOTICE · DOCUMENT_CONDITIONS, PLAN-004 APPROVED, 4건 REJECTED, REPORT_TO_GROUP 1건', () => {
    const s = toS1_5();
    expect(s.contract.status).toBe('NOTICE_PENDING');
    expect(s.contract.decision).toBe('RENEGOTIATE');
    expect(tasksOf(s, 'SEND_NOTICE')).toHaveLength(1);
    expect(tasksOf(s, 'SEND_NOTICE')[0]).toMatchObject({ ownerRole: 'CONTRACT_OFFICER', dueAt: '2026-07-16T23:59:59+09:00' });
    expect(tasksOf(s, 'DOCUMENT_CONDITIONS')).toHaveLength(1);
    expect(line(s, 'PLAN-004').status).toBe('APPROVED');
    expect(line(s, 'PLAN-004').approvedByRole).toBe('MASIL_CEO');
    for (const id of ['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-005']) expect(line(s, id).status).toBe('REJECTED');
    expect(tasksOf(s, 'REPORT_TO_GROUP')).toHaveLength(1);
    expect(s.approvals.map((a) => a.status)).toEqual(['APPROVED', 'APPROVED', 'APPROVED']);
    expect(s.replies.every((r) => r.label === 'MOCK')).toBe(true);
  });

  it('이미 회신된 요청에 다시 회신하면 409 INVALID_TRANSITION', () => {
    const s = toS1_5();
    expect(() => wf.replyToApproval(s, ds, { requestId: 'APR-002', respondentRole: 'GROUP_CEO_BOARD', outcome: 'APPROVED', reason: '' })).toThrow(
      expect.objectContaining({ code: 'INVALID_TRANSITION' }),
    );
  });

  it('AC-1-09 · AC-1-10 · AC-1-11 통보 → 수령확인 → 7/18 기한 감시 → 다음 판단 반영', () => {
    let s = toS1_5();
    s = wf.advanceClock(s, at('2026-07-13', '10:00')).state;
    s = wf.completeTask(s, ds, tasksOf(s, 'SEND_NOTICE')[0]!.id, { resultNote: '조건변경 통보 발송' }).state;
    expect(s.contract.status).toBe('NOTICE_SENT');
    expect(s.notices).toHaveLength(1);
    expect(tasksOf(s, 'CONFIRM_RECEIPT')).toHaveLength(1);
    s = wf.advanceClock(s, at('2026-07-14', '11:00')).state;
    s = wf.recordNoticeReceipt(s, { evidence: '에이전시 회신 메일 (모의)' }).state;
    expect(s.receipts).toHaveLength(1);
    expect(s.contract.status).toBe('NEGOTIATING');
    const contractTrail = s.audit.filter((a) => a.entityType === 'CONTRACT').map((a) => a.toStatus);
    expect(contractTrail.slice(-3)).toEqual(['NOTICE_SENT', 'NOTICE_ACKNOWLEDGED', 'NEGOTIATING']);

    const r = wf.advanceClock(s, at('2026-07-18', '00:00'));
    s = r.state;
    expect(line(s, 'PLAN-004').status).toBe('CONFIRMED');
    for (const id of ['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-005']) expect(line(s, id).status).toBe('CANCELLED');
    expect(s.contract.status).not.toBe('AUTO_RENEWED');
    expect(s.lines.filter((l) => l.status === 'AUTO_CONFIRMED')).toHaveLength(0);
    expect(r.transitions.every((t) => t.actorKind === 'SYSTEM')).toBe(true);
    expect(tasksOf(s, 'RENOTIFY')).toHaveLength(0);

    // AC-1-11 다음 판단(8/14 묶음) 배분 점검 — 바뀐 상태가 입력이 된다
    const share = requestShareRemaining(ds, s.lines);
    expect(share.shares['INF-001'] ?? 0).toBe(0);
    expect(share.remainingTotal).toBe(120_081_310);
    expect(s.proposal?.totalRequestedKrw).toBe(180_803_272);
  });

  it('시점은 되돌릴 수 없다', () => {
    const s = wf.advanceClock(wf.initialState(ds), at('2026-07-05')).state;
    expect(() => wf.advanceClock(s, at('2026-07-02'))).toThrow(expect.objectContaining({ code: 'CLOCK_BACKWARD' }));
  });

  it('허용되지 않은 전이는 예외 (ACTIVE 에서 바로 통보 발송 불가)', () => {
    expect(() => wf.assertContractTransition('ACTIVE', 'NOTICE_SENT')).toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION' }));
    expect(() => wf.assertLineTransition('VALIDATED', 'APPROVED')).toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION' }));
  });

  it('원본 상태 객체를 변경하지 않는다 (순수 함수)', () => {
    const s0 = wf.initialState(ds);
    const snap = JSON.stringify(s0);
    wf.receiveRenewalNotice(s0);
    expect(JSON.stringify(s0)).toBe(snap);
  });
});
