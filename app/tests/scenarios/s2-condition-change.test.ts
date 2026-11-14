/** ② 조건 변경 — AC-2-01 ~ AC-2-08 */
import { describe, expect, it } from 'vitest';
import * as wf from '@/domain/workflow';
import { MOCK_REPLIES } from '@/domain/mockReplies';
import { at, ds, line, tasksOf, toS1_5 } from '../helpers/scenario';

function delayAt714() {
  const s = wf.advanceClock(toS1_5(), at('2026-07-14', '10:00')).state;
  return wf.arCollectionDelayed(s, ds, { arId: 'MAR-0004', newDueDate: '2026-08-30' });
}

describe('② 조건 변경 — 회수 지연으로 승인 주체 상향', () => {
  it('AC-2-01 재전망 v2: 하회 구간 7/21~8/28, 최저 1,921,839,555 @ 7/27, 이벤트 MOCK', () => {
    const r = delayAt714();
    expect(r.state.forecast.id).toBe('CF-v2');
    expect(r.state.forecast.breachWindows).toEqual([{ start: '2026-07-21', end: '2026-08-28' }]);
    expect(r.state.forecast.minClosing).toEqual({ date: '2026-07-27', krw: 1_921_839_555 });
    expect(r.event.label).toBe('MOCK');
  });

  it('AC-2-02 PLAN-004 · PLAN-024 → GROUP_CEO_BOARD (사유 R-AUTH-03 + CF-v2), 나머지 23건 라우팅 불변', () => {
    const before = toS1_5();
    const r = delayAt714();
    expect(r.routingChanges.map((c) => c.lineId).sort()).toEqual(['PLAN-004', 'PLAN-024']);
    for (const id of ['PLAN-004', 'PLAN-024']) {
      const rt = line(r.state, id).routing!;
      expect(rt.requiredRole).toBe('GROUP_CEO_BOARD');
      expect(rt.forecastRunId).toBe('CF-v2');
      expect(rt.reasons[0]!.ruleId).toBe('R-AUTH-03');
      expect(rt.reasons[0]!.text).toContain('CF-v2');
    }
    for (const l of before.lines) {
      if (l.id === 'PLAN-004' || l.id === 'PLAN-024') continue;
      expect(line(r.state, l.id).routing?.requiredRole).toBe(l.routing?.requiredRole);
    }
  });

  it('AC-2-03 PLAN-004 APPROVED → REAPPROVAL_REQUIRED (이력 + 이벤트 ID) → APR-004(GCB) 생성', () => {
    const r = delayAt714();
    const a = r.state.audit.find((x) => x.entityId === 'PLAN-004' && x.fromStatus === 'APPROVED' && x.toStatus === 'REAPPROVAL_REQUIRED');
    expect(a).toBeDefined();
    expect(a!.eventId).toBe(r.event.id);
    expect(a!.ruleIds).toContain('R-AUTH-06');
    const apr4 = r.state.approvals.find((x) => x.id === 'APR-004')!;
    expect(apr4).toMatchObject({ requiredRole: 'GROUP_CEO_BOARD', subjectIds: ['PLAN-004'], supersedesId: 'APR-003', internalDueAt: '2026-07-16T23:59:59+09:00', status: 'PENDING' });
    expect(line(r.state, 'PLAN-004').status).toBe('PENDING_APPROVAL');
    expect(line(r.state, 'PLAN-004').approvedByRole).toBeNull();
    // PLAN-024 는 미상신(VALIDATED) — 라우팅만 갱신
    expect(line(r.state, 'PLAN-024').status).toBe('VALIDATED');
    // PLAN-005 (REJECTED) 불변
    expect(line(r.state, 'PLAN-005').status).toBe('REJECTED');
  });

  it('AC-2-04 APR-004 에 MASIL_CEO 회신 → 422', () => {
    const r = delayAt714();
    expect(() => wf.replyToApproval(r.state, ds, { requestId: 'APR-004', respondentRole: 'MASIL_CEO', outcome: 'APPROVED', reason: '' })).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN_ROLE', httpStatus: 422 }),
    );
  });

  it('AC-2-05 · AC-2-06 조건부 승인 → RESCHEDULE_CAMPAIGN → 집행일 8/31 (권한 하향: 재상신 없음) → 7/18 CONFIRMED', () => {
    let s = wf.advanceClock(delayAt714().state, at('2026-07-15', '15:00')).state;
    s = wf.replyToApproval(s, ds, MOCK_REPLIES.S2_4).state;
    expect(line(s, 'PLAN-004').status).toBe('CONDITIONALLY_APPROVED');
    expect(line(s, 'PLAN-004').approvedByRole).toBe('GROUP_CEO_BOARD');
    const task = tasksOf(s, 'RESCHEDULE_CAMPAIGN');
    expect(task).toHaveLength(1);
    expect(task[0]).toMatchObject({ ownerRole: 'MARKETING_TEAM', subjectId: 'PLAN-004', dueAt: '2026-07-16T23:59:59+09:00' });

    s = wf.advanceClock(s, at('2026-07-16', '10:00')).state;
    const nApprovals = s.approvals.length;
    const r = wf.completeTask(s, ds, task[0]!.id, { resultNote: '집행일 조정', payload: { settlementDate: '2026-08-31' } });
    s = r.state;
    expect(line(s, 'PLAN-004').settlementDate).toBe('2026-08-31');
    expect(line(s, 'PLAN-004').routing?.requiredRole).toBe('MASIL_CEO');
    expect(line(s, 'PLAN-004').status).toBe('CONDITIONALLY_APPROVED');
    expect(s.approvals).toHaveLength(nApprovals);
    expect(r.routingChanges[0]).toMatchObject({ lineId: 'PLAN-004', from: 'GROUP_CEO_BOARD', to: 'MASIL_CEO', action: 'KEEP_HIGHER_APPROVAL' });

    s = wf.advanceClock(s, at('2026-07-18', '00:00')).state;
    expect(line(s, 'PLAN-004').status).toBe('CONFIRMED');
  });

  it('AC-2-07 기한 후(7/20) 같은 지연 → PLAN-004 상태 불변 + POST_DEADLINE_REPORT 1건', () => {
    let s = toS1_5();
    s = wf.advanceClock(s, at('2026-07-20', '09:00')).state;
    expect(line(s, 'PLAN-004').status).toBe('CONFIRMED');
    const r = wf.arCollectionDelayed(s, ds, { arId: 'MAR-0004', newDueDate: '2026-08-30' });
    expect(line(r.state, 'PLAN-004').status).toBe('CONFIRMED');
    expect(r.state.approvals).toHaveLength(s.approvals.length);
    const reports = tasksOf(r.state, 'POST_DEADLINE_REPORT');
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ subjectId: 'PLAN-004', ownerRole: 'GROUP_CEO_BOARD' });
  });

  it('AC-2-08 / R-CASH-04 기안 승인 · 부결과 무관하게 재전망 잔액이 같다', () => {
    const a = delayAt714().state.forecast.daily;
    // 기안을 하나도 결정하지 않은 상태에서 같은 이벤트
    let s = wf.initialState(ds);
    s = wf.advanceClock(s, at('2026-07-14', '10:00')).state;
    const b = wf.arCollectionDelayed(s, ds, { arId: 'MAR-0004', newDueDate: '2026-08-30' }).state.forecast.daily;
    expect(b).toEqual(a);
  });

  it('INFO_MISSING: 조건 변경 입력에 바꿀 값이 없으면 오류', () => {
    const s = toS1_5();
    expect(() => wf.changeLineTerms(s, ds, { lineId: 'PLAN-004' })).toThrow(expect.objectContaining({ code: 'INFO_MISSING' }));
  });
});
