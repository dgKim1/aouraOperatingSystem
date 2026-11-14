/**
 * 모의 회신 데이터셋 (MOCK, A-24) — 외부 승인 · 회신을 대체한다.
 * PROBLEM 5절 원칙 3 / CLAUDE.md 규칙 7: 유리한 회신만 두지 않는다 — 거절(REJECTED) · 정보 부족(INFO_REQUESTED · INSUFFICIENT) 포함.
 * 문구 · 날짜는 DEMO_SCENARIOS 시나리오 그대로.
 */
import type { CounterpartyReplyInput, ReplyInput, ScmReviewInput } from './workflow';

type Mock<T> = T & { label: 'MOCK' };
const m = <T extends object>(x: T): Mock<T> => ({ ...x, label: 'MOCK' as const });

export const MOCK_REPLIES = {
  /** ① S1-5 (7/10 14:00) */
  S1_5: [
    m<ReplyInput>({ requestId: 'APR-001', respondentRole: 'GROUP_CEO_BOARD', outcome: 'APPROVED', decision: 'RENEGOTIATE', reason: '권고 B 조건변경 통보 승인 — 고정 피 비중 축소 · 성과 연동 강화 협의 요청 (모의)' }),
    m<ReplyInput>({ requestId: 'APR-002', respondentRole: 'GROUP_CEO_BOARD', outcome: 'APPROVED', reason: '권고안 승인 — PLAN-001~003 부결 (모의)' }),
    m<ReplyInput>({
      requestId: 'APR-003',
      respondentRole: 'MASIL_CEO',
      outcome: 'APPROVED',
      itemDecisions: [
        { itemId: 'PLAN-004', decision: 'APPROVE' },
        { itemId: 'PLAN-005', decision: 'REJECT' },
      ],
      reason: 'PLAN-004 승인 · PLAN-005 부결 (모의)',
    }),
  ],
  /** ② S2-4 (7/15 15:00) 조건부 승인 */
  S2_4: m<ReplyInput>({
    requestId: 'APR-004',
    respondentRole: 'GROUP_CEO_BOARD',
    outcome: 'APPROVED_WITH_CONDITIONS',
    itemDecisions: [{ itemId: 'PLAN-004', decision: 'CONDITIONAL', condition: '집행일 2026-08-31 이후로 조정' }],
    reason: '하회 구간 밖으로 집행일 조정 조건부 승인 (모의)',
  }),
  /** ③ S3-1 (7/10 14:00) 거절 */
  S3_1_REJECT: m<ReplyInput>({
    requestId: 'APR-001',
    respondentRole: 'GROUP_CEO_BOARD',
    outcome: 'REJECTED',
    reason: '성과 피 정산조건 미확인 — 조건변경안의 총 보수를 비교할 수 없음. 확인 후 재상신 (모의)',
    infoRequest: { target: 'AGENCY', question: '성과 피 산식 · 정산 주기' },
  }),
  /** ③ 변형: 정보 요청 회신 */
  S3_ALT_INFO_REQUESTED: m<ReplyInput>({
    requestId: 'APR-001',
    respondentRole: 'GROUP_CEO_BOARD',
    outcome: 'INFO_REQUESTED',
    reason: '성과 피 조건 확인 후 재상신 (모의)',
    infoRequest: { target: 'AGENCY', question: '성과 피 산식 · 정산 주기' },
  }),
  /** ③ S3-2 (7/13 16:00) 에이전시 정보 부족 */
  S3_2_AGENCY_INSUFFICIENT: m<CounterpartyReplyInput>({ from: 'AGENCY', outcome: 'INSUFFICIENT', note: '성과 피 산식은 계약 원문 별첨이며 7/24 이후 제공 가능 (모의)', label: 'MOCK' }),
  /** ③ S3-3 (7/15) 재상신 승인 — 해지 */
  S3_3_APPROVE_TERMINATE: m<ReplyInput>({ requestId: 'APR-005', respondentRole: 'GROUP_CEO_BOARD', outcome: 'APPROVED', decision: 'TERMINATE', reason: '해지 통보 승인 (모의)' }),
  /** ④-a SCM: 추가 발주 불필요 */
  S4A_SCM_NOT_NEEDED: m<ScmReviewInput>({
    from: 'SCM',
    outcome: 'NOT_NEEDED',
    note: 'SPO-0001~0004 는 in_transit 에 미포함, 9/14~9/18 입고 예정. 추가 발주 불필요. 9/14 전 입고 불가(Corevia F1 포화, Business_Process_Map 1.2) (모의)',
    inboundExpectedDate: '2026-09-18',
    label: 'MOCK',
  }),
  /** ④-a Masil 대표 조건부 승인 (requestId 는 실행 시 채움) */
  S4A_CEO_CONDITIONAL: m<Omit<ReplyInput, 'requestId'>>({
    respondentRole: 'MASIL_CEO',
    outcome: 'APPROVED_WITH_CONDITIONS',
    itemDecisions: [{ itemId: 'PLAN-011', decision: 'CONDITIONAL', condition: '집행일 2026-09-21 로 조정 (기발주 입고 이후)' }],
    reason: '재고 입고 이후 집행 조건부 승인 (모의)',
  }),
  /** ④-b SCM: 추가 발주 필요 */
  S4B_SCM_NEEDED: m<ScmReviewInput>({ from: 'SCM', outcome: 'NEEDED', note: 'SPO 는 in_transit 에 포함됨, 추가 발주 필요 (모의)', label: 'MOCK' }),
  /** ④-b 그룹 CEO/이사회 거절 */
  S4B_GCB_REJECT: m<Omit<ReplyInput, 'requestId'>>({
    respondentRole: 'GROUP_CEO_BOARD',
    outcome: 'REJECTED',
    reason: '하회 구간 신규 현금 약정 불가, 9월 지급 조건으로 재협의 (모의)',
  }),
} as const;

/** 전체 모의 회신 목록 (AC-3-08 점검 · /data 화면 '모의' 목록) */
export const MOCK_REPLY_DATASET: { key: string; outcome: string; label: 'MOCK' }[] = Object.entries(MOCK_REPLIES).flatMap(([key, v]) => {
  const items = (Array.isArray(v) ? v : [v]) as { outcome: string; label: 'MOCK' }[];
  return items.map((x) => ({ key, outcome: x.outcome, label: x.label }));
});
