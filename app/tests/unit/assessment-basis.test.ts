/** 판단안 근거 (domain/assessment) · 숫자 출처 검증 (domain/provenance) — AC-1-05 · AC-3-02 · AC-4-03 */
import { describe, expect, it } from 'vitest';
import { buildAssessmentBasis } from '@/domain/assessment';
import { extractNumbers, validateAssessmentNumbers } from '@/domain/provenance';
import { MOCK_REPLIES } from '@/domain/mockReplies';
import * as wf from '@/domain/workflow';
import { at, ds, tasksOf, toS1_4, toS1_5 } from '../helpers/scenario';

function received() {
  let s = wf.initialState(ds);
  s = wf.receiveRenewalNotice(s).state;
  return wf.receiveProposal(s, ds).state;
}
const fact = (b: { facts: { key: string; value: { value: unknown } }[] }, key: string) => b.facts.find((f) => f.key === key)?.value.value;
const asAssessment = (b: ReturnType<typeof buildAssessmentBasis>) => ({ ...b, recommendation: b.mockNarrative.recommendation, perspectives: b.mockNarrative.perspectives });

describe('판단안 근거 — 계약 (ASM-001)', () => {
  const b = buildAssessmentBasis(received(), ds, { subjectType: 'CONTRACT', subjectIds: ['CTR-INF-001-2026'] });

  it('facts 는 도메인 계산값: 고정 피 2,800,000,000 · INF-001 cp −61,308,789 · 순위 10 · 집행 비중 0.4058', () => {
    expect(fact(b, 'contract.fixedFee')).toBe(2_800_000_000);
    expect(fact(b, 'perf.INF-001.cp')).toBe(-61_308_789);
    expect(fact(b, 'perf.INF-001.cpRank')).toBe(10);
    expect(fact(b, 'perf.INF-001.adSpendShare') as number).toBeCloseTo(0.4058, 4);
    expect(fact(b, 'contract.daysLeft')).toBe(16);
    expect(b.facts.every((f) => f.key && f.name)).toBe(true);
  });

  it('권한자 · 권고: R-AUTH-02 → GROUP_CEO_BOARD, 대안 A/B/C, 권고 B, 승인요청 결정 RENEGOTIATE', () => {
    expect(b.ruleResults.find((r) => r.ruleId === 'R-AUTH-02')?.result).toBe('GROUP_CEO_BOARD');
    expect(b.alternatives.map((a) => [a.id, a.decision, a.requiresRole])).toEqual([
      ['A', 'RENEW_SAME', 'GROUP_CEO_BOARD'],
      ['B', 'RENEGOTIATE', 'GROUP_CEO_BOARD'],
      ['C', 'TERMINATE', 'GROUP_CEO_BOARD'],
    ]);
    expect(b.mockNarrative.recommendation.alternativeId).toBe('B');
    expect(b.proposedDecisions).toEqual([{ itemId: 'CTR-INF-001-2026', decision: 'RENEGOTIATE' }]);
    expect(b.mockNarrative.recommendation.rationale).toContain('28억과 곱하지 않는다');
    expect(b.mockNarrative.recommendation.rationale).toContain('하한만 확정');
  });

  it('AC-1-05 모의 판단안의 모든 숫자가 facts · ruleResults 에 있다', () => {
    const r = validateAssessmentNumbers(asAssessment(b));
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('1.4 참고값(cpRefDef14 −160,803,942)은 판단 근거 facts 에 없다 (UI-10)', () => {
    expect(b.facts.some((f) => f.value.value === -160_803_942)).toBe(false);
  });
});

describe('판단안 근거 — 기안 건 (ASM-002)', () => {
  const ids = ['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-004', 'PLAN-005'];
  const b = buildAssessmentBasis(received(), ds, { subjectType: 'EXPANSION_LINES', subjectIds: ids });

  it('규칙 권고: 001~003 REJECT · 004 APPROVE · 005 REJECT (AI 아님, DD-016)', () => {
    expect(b.proposedDecisions.map((p) => p.decision)).toEqual(['REJECT', 'REJECT', 'REJECT', 'APPROVE', 'REJECT']);
    expect(b.allowedAlternativeIds).toEqual(['A']);
    expect(fact(b, 'line.PLAN-004.cp')).toBe(14_382_286);
    expect(b.ruleResults.filter((r) => r.subjectId === 'PLAN-001').map((r) => r.ruleId)).toEqual(expect.arrayContaining(['R-AUTH-03', 'R-CP-05', 'R-CON-01']));
  });

  it('AC-1-05 예상 GMV 는 claimsCited 에만 — facts 에 CLAIM 없음, 문장 숫자 출처 위반 없음', () => {
    const l1 = received().lines.find((l) => l.id === 'PLAN-001')!;
    expect(b.facts.some((f) => f.value.label === 'CLAIM')).toBe(false);
    expect(b.facts.some((f) => f.value.value === l1.expectedGmvKrw)).toBe(false);
    expect(b.claimsCited.some((c) => c.text.includes(l1.expectedGmvKrw.toLocaleString('ko-KR')))).toBe(true);
    expect(validateAssessmentNumbers(asAssessment(b)).violations).toEqual([]);
  });
});

describe('숫자 출처 검증 — 위반 탐지', () => {
  const b = buildAssessmentBasis(received(), ds, { subjectType: 'EXPANSION_LINES', subjectIds: ['PLAN-001', 'PLAN-004'] });
  const base = asAssessment(b);

  it('출처 없는 숫자가 문장에 있으면 NUMBER_NOT_IN_FACTS', () => {
    const bad = { ...base, recommendation: { alternativeId: 'A', rationale: '예상 효과 123,456,789원 증가' } };
    const r = validateAssessmentNumbers(bad);
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toMatchObject({ field: 'recommendation.rationale', reason: 'NUMBER_NOT_IN_FACTS' });
  });

  it('예상 GMV(주장) 숫자를 문장에 쓰면 CLAIM_NUMBER_IN_TEXT', () => {
    const gmv = received().lines.find((l) => l.id === 'PLAN-004')!.expectedGmvKrw;
    const bad = { ...base, perspectives: { ...base.perspectives, marketing: `PLAN-004 예상 GMV ${gmv.toLocaleString('ko-KR')}원으로 승인 권고` } };
    expect(validateAssessmentNumbers(bad).violations.map((v) => v.reason)).toContain('CLAIM_NUMBER_IN_TEXT');
  });

  it('facts 에 CLAIM 값을 넣으면 CLAIM_IN_FACTS', () => {
    const bad = { ...base, facts: [...base.facts, { key: 'x', name: '예상 GMV', value: { value: 1, label: 'CLAIM' as const, refs: [], scale: 'SAMPLE' as const } }] };
    expect(validateAssessmentNumbers(bad).violations.map((v) => v.reason)).toContain('CLAIM_IN_FACTS');
  });

  it('반올림 표기(%, 억)는 표기 자릿수 안에서 사실 값과 맞으면 허용', () => {
    const c = asAssessment(buildAssessmentBasis(received(), ds, { subjectType: 'CONTRACT', subjectIds: ['CTR-INF-001-2026'] }));
    const ok = { ...c, recommendation: { alternativeId: 'B', rationale: '집행 비중 40.58% · 연 28억 · cp −61,308,789원 · 7/17 · R-AUTH-02 · G-02 · 10위' } };
    expect(validateAssessmentNumbers(ok).violations).toEqual([]);
    const bad = { ...c, recommendation: { alternativeId: 'B', rationale: '집행 비중 41.9%' } };
    expect(validateAssessmentNumbers(bad).ok).toBe(false);
  });

  it('extractNumbers: 날짜 · 식별자 · 절 번호는 숫자로 보지 않는다', () => {
    expect(extractNumbers('2026-07-17 PLAN-001 R-AUTH-03 G-02 A-23 CF-v2 E1 7/17 A05 5절 1.4 문자 그대로').map((t) => t.raw)).toEqual([]);
    expect(extractNumbers('−61,308,789원 · 28억 · 40.58%').map((t) => t.value)).toEqual([-61_308_789, 2_800_000_000, 0.4058]);
  });
});

describe('다음 판단 반영 — 판단안 v2 · 재고 게이트', () => {
  it('AC-3-02 정보 부족 회신 후 계약 판단안: G-02 남음 · 정보 미도착 사실 · 대안 A = 자동 갱신 결과 · 권고 C', () => {
    let s = wf.advanceClock(toS1_4(), at('2026-07-10', '14:00')).state;
    s = wf.replyToApproval(s, ds, MOCK_REPLIES.S3_1_REJECT).state;
    s = wf.advanceClock(s, at('2026-07-13', '16:00')).state;
    s = wf.recordCounterpartyReply(s, MOCK_REPLIES.S3_2_AGENCY_INSUFFICIENT).state;
    const b = buildAssessmentBasis(s, ds, { subjectType: 'CONTRACT', subjectIds: ['CTR-INF-001-2026'] });
    expect(b.unknowns.map((u) => u.gapId)).toContain('G-02');
    expect(String(fact(b, 'contract.infoRequest.result'))).toContain('INSUFFICIENT');
    expect(b.alternatives[0]!.effects.map((e) => String(e.value)).join(' ')).toContain('자동 갱신');
    expect(b.mockNarrative.recommendation.alternativeId).toBe('C');
    expect(validateAssessmentNumbers(asAssessment(b)).violations).toEqual([]);
  });

  it('③-B 자동 갱신 후 계약 판단안: 위약금 1,283,333,333 · 933,333,333 이 사실로 들어간다', () => {
    let s = wf.advanceClock(toS1_4(), at('2026-07-10', '14:00')).state;
    s = wf.replyToApproval(s, ds, MOCK_REPLIES.S3_1_REJECT).state;
    s = wf.advanceClock(s, '2026-07-18T00:00:00+09:00').state;
    const b = buildAssessmentBasis(s, ds, { subjectType: 'CONTRACT', subjectIds: ['CTR-INF-001-2026'] });
    expect(fact(b, 'contract.penalty.2026-09-30')).toBe(1_283_333_333);
    expect(fact(b, 'contract.penalty.2026-12-31')).toBe(933_333_333);
    expect(b.mockNarrative.recommendation.alternativeId).toBe('NONE');
    expect(validateAssessmentNumbers(asAssessment(b)).violations).toEqual([]);
  });

  it('AC-4-03 PLAN-011 (7/20) 규칙 권고 CONDITIONAL · 재고 사실 포함', () => {
    let s = toS1_5();
    s = wf.completeTask(wf.advanceClock(s, at('2026-07-13', '10:00')).state, ds, tasksOf(s, 'SEND_NOTICE')[0]!.id, {}).state;
    s = wf.counterpartyReply(wf.advanceClock(s, at('2026-07-14', '11:00')).state, ds, MOCK_REPLIES.S1_6_AGENCY_RECEIPT).state;
    s = wf.revalidateLines(wf.advanceClock(s, at('2026-07-20', '09:00')).state, ds).state;
    const b = buildAssessmentBasis(s, ds, { subjectType: 'EXPANSION_LINES', subjectIds: ['PLAN-011'] });
    expect(b.proposedDecisions[0]).toMatchObject({ itemId: 'PLAN-011', decision: 'CONDITIONAL' });
    expect(fact(b, 'line.PLAN-011.sku.SKU-1004.cover') as number).toBeCloseTo(2.209, 3);
    expect(b.unknowns.map((u) => u.gapId)).toEqual(expect.arrayContaining(['G-08']));
    expect(validateAssessmentNumbers(asAssessment(b)).violations).toEqual([]);
  });
});
