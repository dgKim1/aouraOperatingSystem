/**
 * 원본 공백(G-xx)의 현재 상태 — 판단안 미확인 목록(unknowns)과 S-12 데이터 출처가 같은 함수 · 같은 문구를 쓴다 (BE-12 · BE-21, ONTOLOGY 1-3 Assessment).
 * 모의 회신으로 채워진 공백은 FILLED_BY_MOCK. 원본 공백 자체는 남으므로 '해소'로 돌려주지 않는다 (A-33, CLAUDE.md 규칙 5).
 *   G-02: 에이전시 모의 「정보 제공」으로 performanceFeeTerms 가 채워짐
 *   G-03: 모의 수령확인(NoticeReceipt)이 있음
 *   G-08: SCM · Corevia 모의 회신으로 공급 전망 · 입고 예정일이 기록됨
 */
import type { WorldState } from './workflow';

export type GapStatus = 'OPEN' | 'FILLED_BY_MOCK';

export const GAP_STATUS_TEXT: Record<GapStatus, string> = {
  OPEN: '미확인',
  FILLED_BY_MOCK: '모의 회신으로 보완 — 원본 공백은 그대로',
};

export function gapStatus(s: Pick<WorldState, 'contract' | 'receipts' | 'lines'>, id: string): GapStatus {
  if (id === 'G-02' && s.contract.performanceFeeTerms !== null) return 'FILLED_BY_MOCK';
  if (id === 'G-03' && s.receipts.length > 0) return 'FILLED_BY_MOCK';
  if (id === 'G-08' && s.lines.some((l) => (l.supplyOutlook ?? 'UNKNOWN') !== 'UNKNOWN' || !!l.inboundExpectedDate)) return 'FILLED_BY_MOCK';
  return 'OPEN';
}

/** 공백 상태 + 표시 문구 */
export function gapState(s: Pick<WorldState, 'contract' | 'receipts' | 'lines'>, id: string): { status: GapStatus; statusText: string } {
  const status = gapStatus(s, id);
  return { status, statusText: GAP_STATUS_TEXT[status] };
}
