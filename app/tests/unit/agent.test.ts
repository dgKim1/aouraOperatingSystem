/** 판단안 에이전트 — 가짜 Claude 클라이언트(실제 API 호출 없음). tool use 루프 · strict 도구 · stop_reason(refusal) · 실패 → 모의 대체 · 숫자 출처 검증 */
import { describe, expect, it } from 'vitest';
import { buildAssessmentBasis } from '@/domain/assessment';
import * as wf from '@/domain/workflow';
import { agentTools, runAssessmentAgent } from '@/server/ai/agent';
import { createAssessor } from '@/server/ai/assessor';
import type { Message, MessageCreateParams, MessagesClient } from '@/server/ai/client';
import { ds } from '../helpers/scenario';

function received() {
  let s = wf.initialState(ds);
  s = wf.receiveRenewalNotice(s).state;
  return wf.receiveProposal(s, ds).state;
}
const basis = buildAssessmentBasis(received(), ds, { subjectType: 'CONTRACT', subjectIds: ['CTR-INF-001-2026'] });

function msg(stop: Message['stop_reason'], content: unknown[]): Message {
  return { id: 'msg', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content, stop_reason: stop, stop_sequence: null, stop_details: null, container: null, diagnostics: null, usage: {} } as unknown as Message;
}
const toolUse = (id: string, name: string, input: unknown) => ({ type: 'tool_use', id, name, input, caller: { type: 'direct' } });
const submit = (rationale: string, alt = 'B') =>
  toolUse('t9', 'submit_assessment', { recommended_alternative_id: alt, rationale, perspectives: { marketing: 'INF-001 집행 비중 40.58% 1위, 실질 공헌이익 10위 (표본, 방향).', finance: '연 금액 하한 2,800,000,000원 > 10억 → 그룹 CEO/이사회.', contract: '7/17 경과 시 자동 갱신 = 체결.', scm: '해당 없음.' } });

class FakeClient implements MessagesClient {
  calls: MessageCreateParams[] = [];
  constructor(private readonly script: (Message | Error)[]) {}
  async create(p: MessageCreateParams): Promise<Message> {
    this.calls.push(structuredClone(p));
    const next = this.script.shift();
    if (!next) throw new Error('스크립트 끝');
    if (next instanceof Error) throw next;
    return next;
  }
}

describe('에이전트 요청 형식 (SDK 타입 기준)', () => {
  it('모델 claude-opus-5-5 · thinking adaptive · effort 명시 · 도구 strict · 상태 변경 도구 없음', async () => {
    const c = new FakeClient([msg('tool_use', [toolUse('t1', 'get_facts', { key_prefix: 'perf.' })]), msg('tool_use', [submit('자동 갱신을 막고 협상 여지를 남긴다. 28억과 곱하지 않는다.')])]);
    const out = await runAssessmentAgent(basis, c, { effort: 'medium' });
    expect(out.ok).toBe(true);
    const p = c.calls[0]!;
    expect(p).toMatchObject({ model: 'claude-opus-5-5', thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } });
    expect(p.tools!.every((t) => 'strict' in t && t.strict === true)).toBe(true);
    expect(p.tools!.map((t) => ('name' in t ? t.name : ''))).toEqual(['get_facts', 'get_rule_results', 'get_alternatives', 'get_open_gaps', 'get_claims', 'submit_assessment']);
    // 두 번째 호출에 도구 결과(도메인 값)가 들어간다
    const second = c.calls[1]!.messages.at(-1)!;
    expect(JSON.stringify(second.content)).toContain('-61308789');
    expect(out.ok && out.toolCalls.map((t) => t.name)).toEqual(['get_facts', 'submit_assessment']);
  });

  it('submit_assessment 의 권고 대안은 근거가 허용한 ID 로만 (기안 건은 규칙 권고안 A 하나)', () => {
    const lb = buildAssessmentBasis(received(), ds, { subjectType: 'EXPANSION_LINES', subjectIds: ['PLAN-001'] });
    const t = agentTools(lb).find((x) => x.name === 'submit_assessment')!;
    expect(JSON.stringify(t.input_schema)).toContain('"enum":["A"]');
  });
});

describe('Assessor — 실시간 결과 사용 · 모의 대체', () => {
  it('정상: aiMode LIVE, 숫자 출처 검증 통과', async () => {
    const a = createAssessor(new FakeClient([msg('tool_use', [submit('자동 갱신을 막고 협상 여지를 남긴다. 표본은 28억과 곱하지 않는다.')])]));
    const d = await a.assess(basis, { createdAt: '2026-07-01T09:00:00+09:00' });
    expect(d).toMatchObject({ aiMode: 'LIVE', fallbackReason: null, recommendation: { alternativeId: 'B' }, stopReason: 'tool_use' });
  });

  it('refusal → 모의 대체 + 거절 경고, 규칙 결과 · 숫자는 그대로', async () => {
    const a = createAssessor(new FakeClient([msg('refusal', [])]));
    const d = await a.assess(basis, { createdAt: 'x' });
    expect(d.aiMode).toBe('MOCK');
    expect(d.stopReason).toBe('refusal');
    expect(d.warnings).toContain('AI 가 판단안 작성을 거절했습니다 — 규칙 결과만 표시');
    expect(d.ruleResults).toEqual(basis.ruleResults);
  });

  it('호출 실패(예외) → 모의 대체 "실시간 호출 실패", 오류 원문은 남기지 않음', async () => {
    const a = createAssessor(new FakeClient([new Error('401 invalid x-api-key sk-ant-secret')]));
    const d = await a.assess(basis, { createdAt: 'x' });
    expect(d.aiMode).toBe('MOCK');
    expect(d.fallbackReason).toContain('실시간 호출 실패');
    expect(JSON.stringify(d)).not.toContain('sk-ant');
  });

  it('출처 없는 숫자 · 예상 GMV 를 쓰면 모의로 대체 (AC-1-05)', async () => {
    const a = createAssessor(new FakeClient([msg('tool_use', [submit('조건변경으로 연 5억원 절감 예상.')])]));
    const d = await a.assess(basis, { createdAt: 'x' });
    expect(d.aiMode).toBe('MOCK');
    expect(d.fallbackReason).toContain('NUMBER_NOT_IN_FACTS');
    expect(d.recommendation).toEqual(basis.mockNarrative.recommendation);
  });

  it('제출 없이 끝나면 한 번 재촉, 그래도 없으면 모의', async () => {
    const c = new FakeClient([msg('end_turn', [{ type: 'text', text: '...' }]), msg('end_turn', [{ type: 'text', text: '...' }])]);
    const d = await createAssessor(c).assess(basis, { createdAt: 'x' });
    expect(c.calls).toHaveLength(2);
    expect(d.aiMode).toBe('MOCK');
  });

  it('키가 없으면(클라이언트 null) 모의 — 도구는 SYSTEM 이 같은 함수로 실행한 기록', async () => {
    const d = await createAssessor(null).assess(basis, { createdAt: 'x' });
    expect(d.aiMode).toBe('MOCK');
    expect(d.toolCalls!.every((t) => t.actor === 'SYSTEM')).toBe(true);
  });
});
