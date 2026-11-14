/** ④ 확장 · 부서 영향 — AC-4-02 ~ AC-4-06 (도메인 부분) */
import { describe, expect, it } from 'vitest';
import * as wf from '@/domain/workflow';
import { MOCK_REPLIES } from '@/domain/mockReplies';
import { at, ds, line, tasksOf, toS1_5 } from '../helpers/scenario';

/** ① 완료 후 7/20 09:00 */
function at720() {
  let s = toS1_5();
  s = wf.completeTask(wf.advanceClock(s, at('2026-07-13', '10:00')).state, ds, tasksOf(s, 'SEND_NOTICE')[0]!.id, {}).state;
  s = wf.recordNoticeReceipt(wf.advanceClock(s, at('2026-07-14', '11:00')).state, { evidence: '모의' }).state;
  s = wf.advanceClock(s, at('2026-07-20', '09:00')).state;
  return wf.revalidateLines(s, ds).state;
}

describe('④ PLAN-011 재고 게이트 · SCM', () => {
  it('AC-4-02 PLAN-011 만 INVENTORY_BELOW_MIN · STOCKOUT_BEFORE_SETTLEMENT, 권한자 MASIL_CEO + 그룹 보고', () => {
    const s = at720();
    const l = line(s, 'PLAN-011');
    expect(l.flags).toEqual(expect.arrayContaining(['INVENTORY_BELOW_MIN', 'STOCKOUT_BEFORE_SETTLEMENT', 'CP_POSITIVE', 'CP_REF_SIGN_DIFFERS']));
    expect(l.routing?.requiredRole).toBe('MASIL_CEO');
    expect(s.lines.filter((x) => x.flags.includes('INVENTORY_BELOW_MIN')).map((x) => x.id)).toEqual(['PLAN-011']);
  });

  it('AC-4-03 CP_POSITIVE 인데 권고가 APPROVE 아님 (CONDITIONAL). 게이트를 끄면 APPROVE', () => {
    const l = line(at720(), 'PLAN-011');
    expect(wf.recommendLine(l).decision).toBe('CONDITIONAL');
    expect(wf.recommendLine(l, { inventoryGate: false }).decision).toBe('APPROVE');
  });

  it('AC-4-05 보충요청 초안: 지급일 8/14 → GROUP_CEO_BOARD, 작업 REPLENISHMENT_REVIEW · INFO_REQUEST(SCM), 3 SKU', () => {
    const r = wf.draftReplenishment(at720(), ds, { triggerLineId: 'PLAN-011' });
    const reqs = r.state.replenishments;
    expect(reqs.map((x) => [x.skuId, x.finalQty, x.amountKrw, x.status])).toEqual([
      ['SKU-1001', 24000, 524_160_000, 'DRAFT'],
      ['SKU-1002', 24000, 524_160_000, 'DRAFT'],
      ['SKU-1004', 20000, 436_800_000, 'DRAFT'],
    ]);
    expect(reqs.every((x) => x.expectedPaymentDate === '2026-08-14' && x.requiredRole === 'GROUP_CEO_BOARD')).toBe(true);
    expect(reqs[0]!.openQuestions.join(' ')).toContain('in_transit');
    expect(tasksOf(r.state, 'REPLENISHMENT_REVIEW')).toHaveLength(1);
    expect(tasksOf(r.state, 'INFO_REQUEST').filter((t) => t.ownerRole === 'SCM')).toHaveLength(1);
  });

  it('AC-4-06 ④-a SCM "불필요 · 9/14~18 입고" → 보충 REJECTED, PLAN-011 조건부(9/21) → CONDITIONALLY_APPROVED + RESCHEDULE_CAMPAIGN', () => {
    let s = wf.draftReplenishment(at720(), ds, { triggerLineId: 'PLAN-011' }).state;
    s = wf.scmReview(s, ds, MOCK_REPLIES.S4A_SCM_NOT_NEEDED).state;
    expect(s.replenishments.every((x) => x.status === 'REJECTED')).toBe(true);
    expect(line(s, 'PLAN-011').supplyOutlook).toBe('INBOUND_CONFIRMED');
    expect(wf.recommendLine(line(s, 'PLAN-011')).decision).toBe('CONDITIONAL');
    s = wf.requestLineApproval(s, { lineIds: ['PLAN-011'], proposed: { 'PLAN-011': 'CONDITIONAL' } }).state;
    const apr = s.approvals.at(-1)!;
    expect(apr.requiredRole).toBe('MASIL_CEO');
    s = wf.replyToApproval(s, ds, { ...MOCK_REPLIES.S4A_CEO_CONDITIONAL, requestId: apr.id }).state;
    expect(line(s, 'PLAN-011').status).toBe('CONDITIONALLY_APPROVED');
    expect(tasksOf(s, 'RESCHEDULE_CAMPAIGN').some((t) => t.subjectId === 'PLAN-011')).toBe(true);
  });

  it('AC-4-06 ④-b SCM "추가 발주 필요" → SUBMITTED → GCB 승인요청 → 거절 → PLAN-011 권고 REJECT 로 변경', () => {
    let s = wf.draftReplenishment(at720(), ds, { triggerLineId: 'PLAN-011' }).state;
    const before = wf.recommendLine(line(s, 'PLAN-011')).decision;
    s = wf.scmReview(s, ds, MOCK_REPLIES.S4B_SCM_NEEDED).state;
    expect(s.replenishments.every((x) => x.status === 'SUBMITTED')).toBe(true);
    const apr = s.approvals.at(-1)!;
    expect(apr).toMatchObject({ subjectType: 'REPLENISHMENT', requiredRole: 'GROUP_CEO_BOARD' });
    expect(apr.routingReasons[0]!.ruleId).toBe('R-AUTH-03');
    // SCM 은 이 구간에서 전결 효력 없음
    expect(() => wf.replyToApproval(s, ds, { requestId: apr.id, respondentRole: 'SCM', outcome: 'APPROVED', reason: '' })).toThrow(
      expect.objectContaining({ code: 'FORBIDDEN_ROLE' }),
    );
    s = wf.replyToApproval(s, ds, { ...MOCK_REPLIES.S4B_GCB_REJECT, requestId: apr.id }).state;
    expect(s.replenishments.every((x) => x.status === 'REJECTED')).toBe(true);
    expect(line(s, 'PLAN-011').supplyOutlook).toBe('NO_SUPPLY');
    expect(before).toBe('CONDITIONAL');
    expect(wf.recommendLine(line(s, 'PLAN-011')).decision).toBe('REJECT');
  });
});
