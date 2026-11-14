/** 시나리오 재생 도우미 — DEMO_SCENARIOS 의 사건 순서를 그대로 재생 (이벤트 소싱처럼 결정적) */
import * as wf from '@/domain/workflow';
import { MOCK_REPLIES } from '@/domain/mockReplies';
import type { MasilDataset } from '@/domain/dataset';
import { masil } from './raw';

export const ds: MasilDataset = masil();
export const at = (date: string, time = '09:00') => `${date}T${time}:00+09:00`;

/** ① S1-1 ~ S1-4 : 접수 → 확인 → 승인요청 3건 */
export function toS1_4(): wf.WorldState {
  let s = wf.initialState(ds);
  s = wf.receiveRenewalNotice(s).state;
  s = wf.receiveProposal(s, ds).state;
  s = wf.requestContractApproval(s, { proposedDecision: 'RENEGOTIATE' }).state;
  const lineIds = ['PLAN-001', 'PLAN-002', 'PLAN-003', 'PLAN-004', 'PLAN-005'];
  const proposed = Object.fromEntries(lineIds.map((id) => [id, wf.recommendLine(s.lines.find((l) => l.id === id)!).decision]));
  s = wf.requestLineApproval(s, { lineIds, proposed }).state;
  return s;
}

/** ① S1-5 : 7/10 14:00 모의 회신 3건 */
export function toS1_5(): wf.WorldState {
  let s = wf.advanceClock(toS1_4(), at('2026-07-10', '14:00')).state;
  for (const r of MOCK_REPLIES.S1_5) s = wf.replyToApproval(s, ds, r).state;
  return s;
}

export const line = (s: wf.WorldState, id: string) => s.lines.find((l) => l.id === id)!;
export const tasksOf = (s: wf.WorldState, type: string) => s.tasks.filter((t) => t.type === type);
