/**
 * 판단안 에이전트 — 단일 에이전트 + 우리가 정의한 도구(strict). (TECH_STACK 2-3 · 2-4, DD-003)
 * - 도구는 도메인 계산 결과(AssessmentBasis)만 돌려준다. 상태를 바꾸는 도구는 없다 (CLAUDE.md 규칙 10 — AI 는 전이를 일으키지 않음).
 * - 모델이 쓰는 것은 문장(권고 이유 · 관점별 근거)과 권고 대안 선택뿐. 숫자 · 권한자 · 건별 권고는 규칙 코드가 정한다.
 * - stop_reason 을 확인한다: refusal · max_tokens · 제출 없는 종료는 실패로 돌려주고 호출자가 모의로 대체한다.
 */
import type { AssessmentBasis, Narrative } from '@/domain/assessment';
import { factValues } from '@/domain/assessment';
import type { ToolCallLog } from '@/domain/types';
import { MODEL, type Message, type MessageParam, type MessagesClient, type Tool, type ToolResultBlockParam } from './client';

export type AgentOutcome =
  | { ok: true; narrative: Narrative; toolCalls: ToolCallLog[]; stopReason: string | null }
  | { ok: false; reason: string; refusal: boolean; toolCalls: ToolCallLog[]; stopReason: string | null };

export interface AgentOptions {
  effort?: 'low' | 'medium' | 'high';
  maxTurns?: number;
  maxTokens?: number;
}

const EMPTY = { type: 'object' as const, properties: {}, required: [] as string[], additionalProperties: false };

/** 도구 정의 (strict: true — 이름 · 입력 스키마 검증 보장) */
export function agentTools(basis: AssessmentBasis): Tool[] {
  return [
    {
      name: 'get_facts',
      description: '판단 대상의 확인된 사실(도메인 계산 결과)을 돌려준다. 각 항목: key · name · value · label(원본/집계/가정/모의 …) · scale(FULL 풀스케일 / SAMPLE 표본 / NONE). key_prefix 로 거른다(빈 문자열이면 전부).',
      strict: true,
      input_schema: { type: 'object', properties: { key_prefix: { type: 'string', description: "예: 'line.PLAN-004', 'perf.', 'contract.'" } }, required: ['key_prefix'], additionalProperties: false },
    },
    { name: 'get_rule_results', description: '규칙 엔진 결과(규칙 ID · 결과 · 입력값). 권한자 · 기한 단계 · 재고 게이트 · 건별 권고가 여기 있다. 권한자와 건별 권고는 규칙이 정하므로 바꾸지 않는다.', strict: true, input_schema: EMPTY },
    { name: 'get_alternatives', description: '대안 목록(효과 · 위험 · 필요한 권한자)과 규칙 권고 결정. 권고할 수 있는 대안 ID 목록도 포함.', strict: true, input_schema: EMPTY },
    { name: 'get_open_gaps', description: '아직 원본에 없는 정보(공백 G-xx)와 영향.', strict: true, input_schema: EMPTY },
    { name: 'get_claims', description: '주장(회의록 · 기안 예상 GMV · 공식 전망) 인용. 판단 근거로 쓰지 않는다 — 참고로만.', strict: true, input_schema: EMPTY },
    {
      name: 'submit_assessment',
      description: '판단안 문장을 제출한다(마지막에 한 번). 문장 속 숫자는 get_facts · get_rule_results 가 돌려준 값만 그대로 쓴다. 주장 숫자(예상 GMV 등)는 쓰지 않는다.',
      strict: true,
      input_schema: {
        type: 'object',
        properties: {
          recommended_alternative_id: { type: 'string', enum: basis.allowedAlternativeIds, description: '권고 대안 ID' },
          rationale: { type: 'string', description: '권고 이유 (한국어, 3문장 이내)' },
          perspectives: {
            type: 'object',
            properties: {
              marketing: { type: 'string' },
              finance: { type: 'string' },
              contract: { type: 'string' },
              scm: { type: 'string' },
            },
            required: ['marketing', 'finance', 'contract', 'scm'],
            additionalProperties: false,
          },
        },
        required: ['recommended_alternative_id', 'rationale', 'perspectives'],
        additionalProperties: false,
      },
    },
  ];
}

/** 도구 실행 — basis 의 값만 돌려준다 (모의 모드에서도 같은 함수로 도구 호출 기록을 만든다) */
export function runTool(basis: AssessmentBasis, name: string, input: unknown): unknown {
  switch (name) {
    case 'get_facts': {
      const prefix = typeof (input as { key_prefix?: unknown })?.key_prefix === 'string' ? (input as { key_prefix: string }).key_prefix : '';
      return factValues(basis.facts.filter((f) => f.key.startsWith(prefix)));
    }
    case 'get_rule_results':
      return basis.ruleResults;
    case 'get_alternatives':
      return { alternatives: basis.alternatives, proposedDecisions: basis.proposedDecisions, allowedAlternativeIds: basis.allowedAlternativeIds, ruleDefaultRecommendation: basis.mockNarrative.recommendation.alternativeId };
    case 'get_open_gaps':
      return basis.unknowns;
    case 'get_claims':
      return { note: '주장 — 판단 근거 아님 (R-CLAIM-01)', claims: basis.claimsCited };
    default:
      return { error: `알 수 없는 도구: ${name}` };
  }
}

export const SYSTEM_PROMPT = [
  '너는 Masil(화장품 브랜드) 마케팅 운영의 판단안 작성 보조다. 업무: W02 인플루언서 전속계약 갱신과 캠페인 확대 기안.',
  '규칙:',
  '1. 숫자는 get_facts · get_rule_results 가 돌려준 값만 쓴다. 새 숫자를 만들거나 계산하지 않는다(합계 · 비율 · 환산 포함).',
  '2. 표본(SAMPLE) 금액과 풀스케일(FULL) 금액을 더하거나 곱하지 않는다. 표본 성과는 비중 · 순위 · 방향까지만 말한다.',
  '3. 주장(회의록 · 기안 예상 GMV · 재무팀 공식 전망)은 판단 근거가 아니다. 숫자로 인용하지 않는다.',
  '4. 권한자와 건별 권고(승인 · 부결 · 조건부)는 규칙 엔진이 정한다. 바꾸거나 반대로 권고하지 않는다.',
  '5. 조건변경안의 구체 조건(인하율 등)을 수치로 만들지 않는다(A-23). 모르는 것은 공백 ID(G-xx)로 말한다.',
  '6. 너는 상태를 바꾸지 않는다. 결정은 권한자(사람)가 한다.',
  '먼저 도구로 사실 · 규칙 결과 · 대안 · 공백을 읽고, 마지막에 submit_assessment 를 한 번 호출해 한국어로 제출한다.',
].join('\n');

function userPrompt(basis: AssessmentBasis): string {
  const subject = basis.subjectType === 'CONTRACT' ? '전속계약' : basis.subjectType === 'EXPANSION_LINES' ? '확대 기안 건' : '재고 보충요청';
  return `판단 대상: ${subject} ${basis.subjectIds.join(', ')}. 도구로 근거를 확인한 뒤 판단안(권고 대안 · 권고 이유 · 마케팅/재무/계약/SCM 관점 근거)을 submit_assessment 로 제출하라.`;
}

function parseSubmit(basis: AssessmentBasis, input: unknown): Narrative | null {
  const x = input as { recommended_alternative_id?: unknown; rationale?: unknown; perspectives?: Record<string, unknown> } | null;
  if (!x || typeof x.rationale !== 'string' || typeof x.recommended_alternative_id !== 'string' || !x.perspectives) return null;
  if (!basis.allowedAlternativeIds.includes(x.recommended_alternative_id)) return null;
  const p = x.perspectives;
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : null);
  const [marketing, finance, contract, scm] = [str('marketing'), str('finance'), str('contract'), str('scm')];
  if (marketing === null || finance === null || contract === null || scm === null) return null;
  return { recommendation: { alternativeId: x.recommended_alternative_id, rationale: x.rationale }, perspectives: { marketing, finance, contract, scm } };
}

export async function runAssessmentAgent(basis: AssessmentBasis, client: MessagesClient, opts: AgentOptions = {}): Promise<AgentOutcome> {
  const tools = agentTools(basis);
  const messages: MessageParam[] = [{ role: 'user', content: userPrompt(basis) }];
  const toolCalls: ToolCallLog[] = [];
  let nudged = false;
  let stopReason: string | null = null;
  for (let turn = 0; turn < (opts.maxTurns ?? 8); turn++) {
    let res: Message;
    try {
      res = await client.create({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 16_000,
        thinking: { type: 'adaptive' },
        output_config: { effort: opts.effort ?? 'medium' },
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });
    } catch (e) {
      // 키 · 네트워크 · 한도 오류 — 원문(키 포함 가능성)은 남기지 않고 종류만
      const kind = e instanceof Error ? e.constructor.name : 'Error';
      const status = (e as { status?: number })?.status;
      return { ok: false, reason: `실시간 호출 실패 (${kind}${status ? ` ${status}` : ''})`, refusal: false, toolCalls, stopReason };
    }
    stopReason = res.stop_reason;
    if (res.stop_reason === 'refusal') return { ok: false, reason: 'AI 가 판단안 작성을 거절했습니다 (refusal)', refusal: true, toolCalls, stopReason };
    const uses = res.content.filter((b): b is Extract<typeof b, { type: 'tool_use' }> => b.type === 'tool_use');
    const submit = uses.find((u) => u.name === 'submit_assessment');
    if (submit) {
      toolCalls.push({ name: submit.name, input: submit.input, output: null, actor: 'AI' });
      const narrative = parseSubmit(basis, submit.input);
      if (!narrative) return { ok: false, reason: 'submit_assessment 입력이 스키마와 맞지 않음', refusal: false, toolCalls, stopReason };
      return { ok: true, narrative, toolCalls, stopReason };
    }
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content });
      continue;
    }
    if (res.stop_reason === 'tool_use' && uses.length > 0) {
      messages.push({ role: 'assistant', content: res.content });
      const results: ToolResultBlockParam[] = uses.map((u) => {
        const output = runTool(basis, u.name, u.input);
        toolCalls.push({ name: u.name, input: u.input, output, actor: 'AI' });
        return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(output) };
      });
      messages.push({ role: 'user', content: results });
      continue;
    }
    if (res.stop_reason === 'end_turn' && !nudged) {
      nudged = true;
      messages.push({ role: 'assistant', content: res.content });
      messages.push({ role: 'user', content: 'submit_assessment 도구로 판단안을 제출하라.' });
      continue;
    }
    return { ok: false, reason: `판단안 제출 없이 종료 (stop_reason=${res.stop_reason})`, refusal: false, toolCalls, stopReason };
  }
  return { ok: false, reason: '도구 호출 횟수 한도 초과', refusal: false, toolCalls, stopReason };
}
