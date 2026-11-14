/**
 * 판단안 만들기 — 결정적 근거(domain/assessment) + 문장(AI 실시간 또는 모의).
 * 실시간 결과는 숫자 출처 검증(AC-1-05)을 통과해야 쓴다. 키 없음 · 호출 실패 · 거절 · 출처 위반이면 결정적인 모의 문장으로 대체하고 aiMode='MOCK'.
 */
import type { AssessmentBasis, Narrative } from '@/domain/assessment';
import { validateAssessmentNumbers } from '@/domain/provenance';
import type { AiTurnTrace, IsoDateTime, ToolCallLog } from '@/domain/types';
import type { AssessmentDraft } from '@/domain/workflow';
import { runAssessmentAgent, runTool, type AgentOptions } from './agent';
import { MODEL, type MessagesClient } from './client';

export interface Assessor {
  readonly mode: 'LIVE' | 'MOCK';
  assess(basis: AssessmentBasis, ctx: { createdAt: IsoDateTime }): Promise<AssessmentDraft>;
}

const MOCK_TOOLS = ['get_facts', 'get_rule_results', 'get_alternatives', 'get_open_gaps', 'get_claims'] as const;

/** 모의 모드 도구 호출 기록 — 같은 도구 함수를 코드가 직접 실행 (actor SYSTEM) */
export function systemToolCalls(basis: AssessmentBasis): ToolCallLog[] {
  return MOCK_TOOLS.map((name) => {
    const input = name === 'get_facts' ? { key_prefix: '' } : {};
    return { name, input, output: runTool(basis, name, input), actor: 'SYSTEM' as const };
  });
}

export function draftFromBasis(
  basis: AssessmentBasis,
  narrative: Narrative,
  meta: { aiMode: 'LIVE' | 'MOCK'; createdAt: IsoDateTime; toolCalls: ToolCallLog[]; fallbackReason?: string | null; stopReason?: string | null; warnings?: string[]; trace?: AiTurnTrace[] },
): AssessmentDraft {
  return {
    subjectType: basis.subjectType,
    subjectIds: basis.subjectIds,
    triggerEventId: basis.triggerEventId,
    facts: basis.facts,
    ruleResults: basis.ruleResults,
    alternatives: basis.alternatives,
    recommendation: narrative.recommendation,
    perspectives: narrative.perspectives,
    claimsCited: basis.claimsCited,
    unknowns: basis.unknowns,
    proposedDecisions: basis.proposedDecisions,
    aiMode: meta.aiMode,
    model: MODEL,
    createdAt: meta.createdAt,
    toolCalls: meta.toolCalls,
    fallbackReason: meta.fallbackReason ?? null,
    stopReason: meta.stopReason ?? null,
    warnings: meta.warnings ?? [],
    ...(meta.trace && meta.trace.length > 0 ? { aiTrace: meta.trace } : {}),
  };
}

export function mockDraft(basis: AssessmentBasis, createdAt: IsoDateTime, extra: { fallbackReason?: string | null; warnings?: string[]; toolCalls?: ToolCallLog[]; stopReason?: string | null; trace?: AiTurnTrace[] } = {}): AssessmentDraft {
  return draftFromBasis(basis, basis.mockNarrative, {
    aiMode: 'MOCK',
    createdAt,
    toolCalls: [...(extra.toolCalls ?? []), ...systemToolCalls(basis)],
    fallbackReason: extra.fallbackReason ?? null,
    stopReason: extra.stopReason ?? null,
    warnings: extra.warnings ?? [],
    ...(extra.trace ? { trace: extra.trace } : {}),
  });
}

export const mockAssessor: Assessor = {
  mode: 'MOCK',
  async assess(basis, ctx) {
    return mockDraft(basis, ctx.createdAt, { warnings: ['AI 키 없음 — 모의 모드 (문장은 규칙 문구, 숫자 · 권고는 동일)'] });
  },
};

export function createAssessor(client: MessagesClient | null, opts: AgentOptions = {}): Assessor {
  if (!client) return mockAssessor;
  return {
    mode: 'LIVE',
    async assess(basis, ctx) {
      const out = await runAssessmentAgent(basis, client, opts);
      if (!out.ok) {
        const warn = out.refusal ? 'AI 가 판단안 작성을 거절했습니다 — 규칙 결과만 표시' : '실시간 호출 실패 → 모의로 생성';
        return mockDraft(basis, ctx.createdAt, { fallbackReason: out.reason, warnings: [warn], toolCalls: out.toolCalls, stopReason: out.stopReason, trace: out.trace });
      }
      const draft = draftFromBasis(basis, out.narrative, { aiMode: 'LIVE', createdAt: ctx.createdAt, toolCalls: out.toolCalls, stopReason: out.stopReason, trace: out.trace });
      const check = validateAssessmentNumbers(draft);
      if (!check.ok) {
        const list = check.violations.slice(0, 5).map((v) => `${v.field}:${v.token}(${v.reason})`).join(', ');
        return mockDraft(basis, ctx.createdAt, { fallbackReason: `AI 문장에 출처 없는 숫자 — ${list}`, warnings: ['AI 문장의 숫자가 사실 · 규칙 결과에 없어 규칙 문구로 대체'], toolCalls: out.toolCalls, stopReason: out.stopReason, trace: out.trace });
      }
      return draft;
    },
  };
}
