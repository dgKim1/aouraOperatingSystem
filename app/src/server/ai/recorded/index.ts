/**
 * 기록된 실제 실행 (RECORDED) — 실제 Claude 로 한 번 만든 판단안을 저장소에 남기고, 시연에서는 AI 를 다시 호출하지 않고 보여주기만 한다.
 * (2026-11-14 사용자 결정 (b)안: 비용을 아끼되 "AI 가 실제로 받은 입력 · 낸 출력"의 증거를 남긴다 — ONTOLOGY 9-1)
 *
 * 정직하게 표시한다:
 *  - aiMode 는 LIVE 가 아니라 RECORDED. 문구 "실제 Claude 실행 기록(시각, 모델) — 재생, 지금 호출하지 않음".
 *  - 운영 상태(판단안 · 승인요청 · 이력)에 끼워 넣지 않는다. 기록 안의 승인요청 · 이력은 그 실행 때 실제로 생긴 것의 사본이다.
 *  - 기록의 근거(facts · ruleResults · 대안 · 공백 · 규칙 권고)가 지금 도메인 계산과 같은지 매번 대조해 결과(basisCheck)를 함께 준다.
 * 기록 원문에는 키 · 요청 헤더 · 접속 문자열을 넣지 않는다. 숫자 출처 검증을 통과한 실시간 실행만 기록한다.
 */
import { isDeepStrictEqual } from 'node:util';
import type { AssessmentView, AuditRowView, RecordedRunView } from '@/domain/api-types';
import { buildAssessmentBasis } from '@/domain/assessment';
import type { MasilDataset } from '@/domain/dataset';
import { validateAssessmentNumbers } from '@/domain/provenance';
import type { ApprovalRequest, ToolCallLog } from '@/domain/types';
import * as wf from '@/domain/workflow';
import { REC_001_TEXT } from './rec-001-contract.record';

/** 기록 원문 모양 (rec-*.record.ts 안의 JSON). assessment 는 그 실행의 POST /api/assessments 응답 그대로 (aiMode = 'LIVE' 는 그 실행 당시의 사실) */
export interface RecordedRunFile {
  id: string;
  kind: 'RECORDED_LIVE_RUN';
  note: string;
  /** 실제 호출 시작 · 종료 시각 (UTC) */
  executedAt: string;
  finishedAt: string;
  model: string;
  request: RecordedRunView['request'];
  scenario: RecordedRunView['scenario'];
  assessmentHttpStatus: number;
  assessment: AssessmentView;
  followUp: { approvalHttpStatus: number; approvalRequests: ApprovalRequest[]; audit: AuditRowView[] };
}

/**
 * 기록 원문은 문자열로 두고 런타임에 JSON.parse 한다 — JSON 모듈 import 는 번들러가 소수를 1ULP 다르게 읽어
 * 서버가 내보내는 기록 값이 원문과 달라지고 대조가 거짓 불일치를 냈다 (rec-001-contract.record.ts 머리말).
 * 대조(verifyRecordedRun)는 그대로 정확히 같은 값만 통과시킨다 — 허용 오차를 두지 않는다.
 */
export const RECORDED_RUN_TEXTS: readonly string[] = [REC_001_TEXT];
export const RECORDED_RUNS: RecordedRunFile[] = RECORDED_RUN_TEXTS.map((t) => JSON.parse(t) as RecordedRunFile);

const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/**
 * 기록이 현재 규칙 계산과 같은 입력에서 나왔나 — 기록의 시나리오(시드 → 갱신 통보 접수)를 도메인 함수로 다시 재생해 근거를 만들고 기록과 비교한다.
 * 원본 데이터나 규칙이 바뀌어 값이 달라지면 mismatches 에 항목이 나온다 (조용히 통과시키지 않는다).
 */
export function verifyRecordedRun(run: RecordedRunFile, ds: MasilDataset): RecordedRunView['basisCheck'] {
  const replayedSteps = 'SEED → 갱신 통보 접수';
  const a = run.assessment;
  const mismatches: string[] = [];
  let basis;
  try {
    basis = plain(buildAssessmentBasis(wf.receiveRenewalNotice(wf.initialState(ds)).state, ds, { subjectType: a.subjectType, subjectIds: a.subjectIds }));
  } catch {
    return { ok: false, replayedSteps, mismatches: ['basis: 현재 규칙으로 근거를 다시 만들 수 없음'] };
  }
  const now = new Map(basis.facts.map((f) => [f.key, f]));
  const then = new Map(a.facts.map((f) => [f.key, f]));
  for (const [k, f] of then) if (!isDeepStrictEqual(f, now.get(k))) mismatches.push(`facts.${k}`);
  for (const k of now.keys()) if (!then.has(k)) mismatches.push(`facts.${k} (기록에 없음)`);
  const same = (name: string, x: unknown, y: unknown) => {
    if (!isDeepStrictEqual(plain(x), y)) mismatches.push(name);
  };
  same('ruleResults', a.ruleResults, basis.ruleResults);
  same('alternatives', a.alternatives, basis.alternatives);
  same('unknowns', a.unknowns, basis.unknowns);
  same('proposedDecisions', a.proposedDecisions ?? [], basis.proposedDecisions);
  same('claimsCited', a.claimsCited, basis.claimsCited);
  if (!basis.allowedAlternativeIds.includes(a.recommendation.alternativeId)) mismatches.push('recommendation.alternativeId (허용 대안 밖)');
  return { ok: mismatches.length === 0, replayedSteps, mismatches };
}

/** UTC ISO → 'YYYY-MM-DD HH:MM' (KST) */
function kstMinute(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
}

/** 도구 호출 한 줄 요약 — 건수는 기록된 출력에서 센다 (새 숫자를 만들지 않는다) */
function toolSummary(t: ToolCallLog): string {
  const out = t.output as unknown;
  const n = (x: unknown) => (Array.isArray(x) ? x.length : 0);
  switch (t.name) {
    case 'get_facts':
      return `확인된 사실 ${n(out)}건을 읽음`;
    case 'get_rule_results':
      return `규칙 결과 ${n(out)}건을 읽음`;
    case 'get_alternatives':
      return `대안 ${n((out as { alternatives?: unknown })?.alternatives)}건과 규칙 권고를 읽음`;
    case 'get_open_gaps':
      return `미확인 · 공백 ${n(out)}건을 읽음`;
    case 'get_claims':
      return `주장 인용 ${n((out as { claims?: unknown })?.claims)}건을 읽음 (판단 근거 아님)`;
    case 'submit_assessment':
      return `판단안 제출 — 권고 대안 ${String((t.input as { recommended_alternative_id?: unknown })?.recommended_alternative_id ?? '-')}`;
    default:
      return t.name;
  }
}

export function recordedRunView(run: RecordedRunFile, ds: MasilDataset): RecordedRunView {
  const executedAtKst = kstMinute(run.executedAt);
  const { aiMode: originalAiMode, ...rest } = run.assessment;
  void originalAiMode; // 그 실행은 LIVE 였지만, 지금 보여주는 것은 재생이므로 RECORDED 로만 내보낸다
  return {
    id: run.id,
    aiMode: 'RECORDED',
    label: `실제 Claude 실행 기록(${executedAtKst}, ${run.model}) — 재생, 지금 호출하지 않음`,
    calledNow: false,
    inOperationalState: false,
    executedAt: run.executedAt,
    finishedAt: run.finishedAt,
    executedAtKst,
    durationMs: Date.parse(run.finishedAt) - Date.parse(run.executedAt),
    toolCallSummaries: (run.assessment.toolCalls ?? []).map((t) => ({ name: t.name, actor: t.actor, summary: toolSummary(t) })),
    model: run.model,
    request: run.request,
    scenario: run.scenario,
    assessment: { ...rest, aiMode: 'RECORDED', mock: false, provenance: validateAssessmentNumbers(run.assessment) },
    followUp: { approvalRequests: run.followUp.approvalRequests, audit: run.followUp.audit },
    basisCheck: verifyRecordedRun(run, ds),
  };
}
