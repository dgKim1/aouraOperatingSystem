/**
 * 1단계 데이터 공급 — 운영 상태(WorldState)를 백엔드 도메인 함수로 "재생"해서 만든다.
 *
 * - DB · API 가 아직 없으므로(백엔드 2단계) 시연 프리셋별로 DEMO_SCENARIOS 의 사건 순서를
 *   도메인 순수 함수(workflow.ts)로 그대로 재생한다. 저장하지 않는다(읽기 전용, 요청마다 같은 결과).
 * - 화면은 이 모듈을 직접 부르지 않고 `views.ts` 만 부른다. 2단계에서는 views.ts 의 각 함수 몸통을
 *   `fetch('/api/…')` 로 바꾸면 되고, 이 파일은 지운다.
 * - 계산 · 판정 로직을 새로 만들지 않는다. 회신 입력은 백엔드의 MOCK_REPLIES 를 그대로 쓴다.
 */
import 'server-only';
import { MOCK_REPLIES } from '@/domain/mockReplies';
import type { MasilDataset } from '@/domain/dataset';
import * as wf from '@/domain/workflow';
import { getMasil } from '@/server/raw/masil';

export type PresetId = 'SEED' | 'S1_RECEIVED' | 'S1_4' | 'S1_5' | 'S1_6' | 'S1_7' | 'S2' | 'S3_1' | 'S3_B' | 'S4';

export interface PresetInfo {
  id: PresetId;
  scenario: '①' | '②' | '③' | '④' | '-';
  title: string;
  description: string;
  /** 다음에 할 행동 안내 (S-13) */
  next: string;
}

export const PRESETS: PresetInfo[] = [
  { id: 'SEED', scenario: '-', title: '초기 상태 (7/1 09:00)', description: '통보 · 기안 미접수', next: '사건 입력에서 갱신 통보 · 확대 기안 접수' },
  { id: 'S1_RECEIVED', scenario: '①', title: '① 접수 · 확인 (S1-1~2)', description: '계약 UNDER_REVIEW · 25건 VALIDATED', next: '판단안 확인 후 승인 요청 만들기' },
  { id: 'S1_4', scenario: '①', title: '① 승인 요청 3건 (S1-4)', description: 'APR-001~003 대기, 7/1 09:00', next: '승인함에서 그룹 CEO/이사회 역할로 APR-001 · APR-002 회신, Masil 대표로 APR-003 회신' },
  { id: 'S1_5', scenario: '①', title: '① 모의 회신 후 (S1-5, 7/10 14:00)', description: '계약 NOTICE_PENDING · PLAN-004 승인 · 4건 부결', next: '작업에서 통보 발송(SEND_NOTICE) 완료' },
  { id: 'S1_6', scenario: '①', title: '① 통보 · 수령확인 (S1-6, 7/14 11:00)', description: '계약 NEGOTIATING (수령확인 7/14)', next: '시점 7/18 00:00 으로 이동' },
  { id: 'S1_7', scenario: '①', title: '① 기한 도래 후 (S1-7, 7/18 00:00)', description: 'PLAN-004 CONFIRMED · 4건 CANCELLED · 자동 갱신 없음', next: '인플루언서 성과에서 남은 기안 배분 비중 확인' },
  { id: 'S2', scenario: '②', title: '② 회수 지연 → 재전망 (7/14 10:00)', description: '하회 구간 7/21~8/28, PLAN-004 재승인 필요', next: '승인함에서 그룹 CEO/이사회 역할로 새 요청 회신' },
  { id: 'S3_1', scenario: '③', title: '③ 계약 반려 (7/10 14:00)', description: '계약 REVIEW_BEFORE_DEADLINE · 정보 요청 작업', next: '사건 입력에서 에이전시 정보 부족 회신' },
  { id: 'S3_B', scenario: '③', title: '③-B 미결로 기한 경과 (7/18 00:00)', description: '계약 AUTO_RENEWED (권한 미경유 체결)', next: '전속계약 상세에서 위약금 확인' },
  { id: 'S4', scenario: '④', title: '④ 더마 재고 게이트 (7/20 09:00)', description: 'PLAN-011 재고 부족 · 보충 제안 초안', next: '재고 커버에서 보충 제안 확인, SCM 회신(모의)' },
];

export const DEFAULT_PRESET: PresetId = 'S1_4';

export function isPresetId(x: string | undefined): x is PresetId {
  return PRESETS.some((p) => p.id === x);
}

const at = (date: string, time = '09:00') => `${date}T${time}:00+09:00`;

function ds(): MasilDataset {
  return getMasil().dataset;
}

/** ① S1-1 ~ S1-2 */
function received(): wf.WorldState {
  let s = wf.initialState(ds());
  s = wf.receiveRenewalNotice(s).state;
  s = wf.receiveProposal(s, ds()).state;
  return s;
}

/** ① S1-4 — 권고안은 규칙 기반 recommendLine 결과 (AI 아님) */
function s1_4(): wf.WorldState {
  let s = received();
  s = wf.requestContractApproval(s, { proposedDecision: 'RENEGOTIATE' }).state;
  const lineIds = ['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-004', 'PLAN-005'];
  const proposed = Object.fromEntries(lineIds.map((id) => [id, wf.recommendLine(s.lines.find((l) => l.id === id)!).decision]));
  return wf.requestLineApproval(s, { lineIds, proposed }).state;
}

function s1_5(): wf.WorldState {
  let s = wf.advanceClock(s1_4(), at('2026-07-10', '14:00')).state;
  for (const r of MOCK_REPLIES.S1_5) s = wf.replyToApproval(s, ds(), r).state;
  return s;
}

function s1_6(): wf.WorldState {
  let s = wf.advanceClock(s1_5(), at('2026-07-13', '10:00')).state;
  const send = s.tasks.find((t) => t.type === 'SEND_NOTICE')!;
  s = wf.completeTask(s, ds(), send.id, { resultNote: '조건변경 통보 발송 (모의)' }).state;
  s = wf.advanceClock(s, at('2026-07-14', '11:00')).state;
  return wf.recordNoticeReceipt(s, { evidence: '에이전시 회신 메일 (모의)' }).state;
}

function s2(): wf.WorldState {
  const s = wf.advanceClock(s1_5(), at('2026-07-14', '10:00')).state;
  return wf.arCollectionDelayed(s, ds(), { arId: 'MAR-0004', newDueDate: '2026-08-30' }).state;
}

function s3_1(): wf.WorldState {
  const s = wf.advanceClock(s1_4(), at('2026-07-10', '14:00')).state;
  return wf.replyToApproval(s, ds(), MOCK_REPLIES.S3_1_REJECT).state;
}

function s3_b(): wf.WorldState {
  let s = wf.advanceClock(s3_1(), at('2026-07-13', '16:00')).state;
  s = wf.recordCounterpartyReply(s, MOCK_REPLIES.S3_2_AGENCY_INSUFFICIENT).state;
  return wf.advanceClock(s, '2026-07-18T00:00:00+09:00').state;
}

function s4(): wf.WorldState {
  let s = wf.advanceClock(s1_6(), at('2026-07-20', '09:00')).state;
  s = wf.revalidateLines(s, ds()).state;
  return wf.draftReplenishment(s, ds(), { triggerLineId: 'PLAN-011' }).state;
}

const BUILD: Record<PresetId, () => wf.WorldState> = {
  SEED: () => wf.initialState(ds()),
  S1_RECEIVED: received,
  S1_4: s1_4,
  S1_5: s1_5,
  S1_6: s1_6,
  S1_7: () => wf.advanceClock(s1_6(), '2026-07-18T00:00:00+09:00').state,
  S2: s2,
  S3_1: s3_1,
  S3_B: s3_b,
  S4: s4,
};

const cache = new Map<PresetId, wf.WorldState>();

/** 프리셋 상태 (결정적 재생이므로 프로세스 내 캐시). 호출자는 수정하지 않는다. */
export function worldFor(id: PresetId): wf.WorldState {
  let s = cache.get(id);
  if (!s) {
    s = BUILD[id]();
    cache.set(id, s);
  }
  return s;
}

export function dataset(): MasilDataset {
  return ds();
}

export function rawTables() {
  return getMasil().tables;
}
