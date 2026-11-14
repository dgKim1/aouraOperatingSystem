/**
 * 기록된 실제 실행(RECORDED) — 실제 Claude 로 한 번 만든 판단안을 시연에서 AI 호출 없이 보여준다 (테스트 먼저).
 * - 정직한 표시: aiMode 는 LIVE 가 아니라 RECORDED, "재생, 지금 호출하지 않음" 문구
 * - 운영 상태(판단안 · 승인요청 · 이력)에 끼워 넣지 않는다
 * - 기록의 근거(facts · ruleResults · 대안 · 공백)가 지금 도메인 계산과 같은 입력에서 나왔는지 대조한다
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import * as recorded from '@/app/api/assessments/recorded/route';
import * as assessments from '@/app/api/assessments/route';
import * as audit from '@/app/api/audit/route';
import * as meta from '@/app/api/meta/route';
import * as reset from '@/app/api/scenarios/[id]/reset/route';
import type { AssessmentView, AuditRowView, MetaView, RecordedRunsResponse } from '@/domain/api-types';
import { buildAssessmentBasis, factValues } from '@/domain/assessment';
import { validateAssessmentNumbers } from '@/domain/provenance';
import * as wf from '@/domain/workflow';
import type { Message, MessagesClient } from '@/server/ai/client';
import { RECORDED_RUNS, RECORDED_RUN_TEXTS, verifyRecordedRun } from '@/server/ai/recorded';
import { fromTables, getMasil } from '@/server/raw/masil';
import { ds } from '../helpers/scenario';
import { call, ctx, makeService, req } from '../helpers/api';

class CountingClient implements MessagesClient {
  calls = 0;
  async create(): Promise<Message> {
    this.calls++;
    throw new Error('기록 재생 중에는 AI 를 호출하면 안 된다');
  }
}
const get = async () => (await call<RecordedRunsResponse>(recorded.GET())).body;
const rec = RECORDED_RUNS[0]!;

describe('GET /api/assessments/recorded — 실제 실행 기록 재생', () => {
  let client: CountingClient;
  beforeEach(() => {
    client = new CountingClient();
    makeService({ client });
  });

  it('기록 1건 — aiMode RECORDED(LIVE 아님) · 정직한 표시 문구 · AI 호출 0회', async () => {
    const { runs } = await get();
    expect(runs).toHaveLength(1);
    const r = runs[0]!;
    expect(r).toMatchObject({ id: 'REC-001', aiMode: 'RECORDED', calledNow: false, inOperationalState: false, model: 'claude-opus-5-5', executedAtKst: '2026-11-14 17:19' });
    expect(r.label).toBe('실제 Claude 실행 기록(2026-11-14 17:19, claude-opus-5-5) — 재생, 지금 호출하지 않음');
    expect(r.assessment.aiMode).toBe('RECORDED');
    expect(r.assessment.mock).toBe(false);
    // 'LIVE' 는 그 실행 당시 이력 사본(판단안 생성 행의 snapshot)에만 남는다 — 화면이 읽는 aiMode 필드에는 없다
    const { followUp, ...shown } = r;
    expect(JSON.stringify(shown)).not.toContain('"aiMode":"LIVE"');
    expect(followUp.audit.find((x) => x.entityType === 'ASSESSMENT')!.actorKind).toBe('AI');
    expect(client.calls).toBe(0);
  });

  it('그 실행의 증거가 들어 있다 — stop_reason · 도구 호출 입력/출력(모델이 호출) · 응답 모델 ID · 숫자 출처 검증 통과', async () => {
    const a = (await get()).runs[0]!.assessment;
    expect(a.stopReason).toBe('tool_use');
    expect(a.fallbackReason).toBeNull();
    expect(a.provenance).toEqual({ ok: true, violations: [] });
    expect(a.toolCalls.map((t) => `${t.actor}:${t.name}`)).toEqual(['AI:get_facts', 'AI:get_rule_results', 'AI:get_alternatives', 'AI:get_open_gaps', 'AI:get_claims', 'AI:submit_assessment']);
    expect(a.aiTrace!.length).toBeGreaterThan(0);
    expect(a.aiTrace!.every((t) => t.model === 'claude-opus-5-5' && t.messageId.startsWith('msg_'))).toBe(true);
    // 제출 도구 입력 = 저장된 문장 (모델이 쓴 그대로)
    const submit = a.toolCalls.at(-1)!.input as { recommended_alternative_id: string; rationale: string };
    expect([submit.recommended_alternative_id, submit.rationale]).toEqual([a.recommendation.alternativeId, a.recommendation.rationale]);
    expect(['A', 'B', 'C']).toContain(a.recommendation.alternativeId);
  });

  it('소요 시간 · 도구 호출 요약 — 기록에서 계산한 값만', async () => {
    const r = (await get()).runs[0]!;
    expect(r.durationMs).toBe(Date.parse(r.finishedAt) - Date.parse(r.executedAt));
    expect(r.durationMs).toBeGreaterThan(0);
    expect(r.toolCallSummaries.map((t) => `${t.actor}:${t.name}:${t.summary}`)).toEqual([
      'AI:get_facts:확인된 사실 19건을 읽음',
      'AI:get_rule_results:규칙 결과 3건을 읽음',
      'AI:get_alternatives:대안 3건과 규칙 권고를 읽음',
      'AI:get_open_gaps:미확인 · 공백 5건을 읽음',
      'AI:get_claims:주장 인용 3건을 읽음 (판단 근거 아님)',
      'AI:submit_assessment:판단안 제출 — 권고 대안 B',
    ]);
  });

  it('승인요청으로 이어진 이력이 기록에 있다 — 권한자는 규칙이 정했고(그룹 CEO/이사회) 판단안이 근거로 붙었다', async () => {
    const r = (await get()).runs[0]!;
    expect(r.followUp.approvalRequests).toMatchObject([{ subjectType: 'CONTRACT', requiredRole: 'GROUP_CEO_BOARD', assessmentId: r.assessment.id, status: 'PENDING' }]);
    expect(r.followUp.audit.map((x) => `${x.entityType}:${x.toStatus}:${x.actorKind}`)).toEqual(['CONTRACT:UNDER_REVIEW:HUMAN', 'ASSESSMENT:CREATED:AI', 'APPROVAL_REQUEST:PENDING:SYSTEM', 'CONTRACT:PENDING_APPROVAL:SYSTEM']);
  });

  it('운영 상태에 끼워 넣지 않는다 — 판단안 목록 · 이력 · 상태 버전 · meta.aiMode 불변', async () => {
    await call(reset.POST(req('', 'POST'), ctx({ id: 'S1_4' })));
    const before = (await call<MetaView>(meta.GET())).body;
    await get();
    const after = (await call<MetaView>(meta.GET())).body;
    expect(after.stateVersion).toBe(before.stateVersion);
    const list = (await call<AssessmentView[]>(assessments.GET(req('/api/assessments')))).body;
    expect(list.every((a) => a.mock)).toBe(true); // 프리셋의 모의 판단안만
    const rows = (await call<AuditRowView[]>(audit.GET(req('/api/audit?actorKind=AI')))).body;
    expect(rows).toEqual([]);
  });

  it('배포 런타임(AOURA_AI_MODE=mock)에서도 같은 기록이 나온다 — meta.aiMode 는 MOCK 그대로', async () => {
    makeService();
    expect((await call<MetaView>(meta.GET())).body.aiMode).toBe('MOCK');
    expect((await get()).runs[0]!.aiMode).toBe('RECORDED');
  });
});

describe('기록 대 현재 규칙 계산 대조', () => {
  const basis = () => buildAssessmentBasis(wf.receiveRenewalNotice(wf.initialState(ds)).state, ds, { subjectType: 'CONTRACT', subjectIds: ['CTR-INF-001-2026'] });

  it('기록의 facts · ruleResults · 대안 · 공백 · 규칙 권고가 지금 도메인 계산(같은 입력: 시드 → 통보 접수)과 일치', async () => {
    expect(verifyRecordedRun(rec, ds)).toEqual({ ok: true, replayedSteps: 'SEED → 갱신 통보 접수', mismatches: [] });
    const b = basis();
    expect(rec.assessment.facts).toEqual(JSON.parse(JSON.stringify(b.facts)));
    expect(rec.assessment.ruleResults).toEqual(JSON.parse(JSON.stringify(b.ruleResults)));
    expect((await get()).runs[0]!.basisCheck.ok).toBe(true);
  });

  it('모델이 받은 도구 출력 = 지금 도메인 값 (get_facts 전체)', () => {
    const got = rec.assessment.toolCalls!.find((t) => t.name === 'get_facts')!;
    expect(got.input).toEqual({ key_prefix: '' });
    expect(got.output).toEqual(JSON.parse(JSON.stringify(factValues(basis().facts))));
  });

  it('기록의 숫자 출처 검증을 지금 검증기로 다시 돌려도 통과', () => {
    expect(validateAssessmentNumbers(rec.assessment)).toEqual({ ok: true, violations: [] });
  });

  it('근거 값이 달라지면 불일치로 드러난다 (조용히 통과하지 않음)', () => {
    const tampered = structuredClone(rec);
    const f = tampered.assessment.facts.find((x) => x.key === 'contract.fixedFee')!;
    (f.value as { value: unknown }).value = 2_900_000_000;
    const v = verifyRecordedRun(tampered, ds);
    expect(v.ok).toBe(false);
    expect(v.mismatches).toContain('facts.contract.fixedFee');
  });

  it('기록은 원문 글자 그대로 — 소스 파일의 글자를 V8 로 파싱한 값과 비트까지 같다 (번들러가 JSON 모듈의 소수를 바꾸던 결함)', () => {
    const src = readFileSync(new URL('../../src/server/ai/recorded/rec-001-contract.record.ts', import.meta.url), 'utf8');
    const raw = src.match(/String\.raw`([\s\S]*)`;\s*$/)![1]!;
    expect(RECORDED_RUN_TEXTS[0]).toBe(raw);
    expect(rec).toEqual(JSON.parse(raw));
    // 원문 글자에 그 실행의 비율 값이 그대로 있다 (1ULP 다른 표기 1.362767389450268 · -0.19778583752973583 이 아님)
    expect(raw).toContain('1.3627673894502679');
    expect(raw).toContain('-0.19778583752973586');
    const fact = (k: string) => (rec.assessment.facts.find((f) => f.key === k)!.value as { value: number }).value;
    expect(Object.is(fact('perf.INF-001.nominalRoas'), 1.3627673894502679)).toBe(true);
    expect(Object.is(fact('perf.INF-001.realRoas'), -0.19778583752973586)).toBe(true);
    // JSON 모듈로 되돌리지 않는다 — 번들 환경 확인은 scripts/check-recorded-bundle.mjs
    expect(readFileSync(new URL('../../src/server/ai/recorded/index.ts', import.meta.url), 'utf8')).not.toMatch(/from '\.\/[^']+\.json'/);
  });

  it('1ULP 만 달라도 불일치로 잡는다 — 대조에 허용 오차가 없다', () => {
    const off = structuredClone(rec);
    const f = off.assessment.facts.find((x) => x.key === 'perf.INF-001.nominalRoas')!;
    (f.value as { value: unknown }).value = 1.362767389450268;
    expect(verifyRecordedRun(off, ds).mismatches).toEqual(['facts.perf.INF-001.nominalRoas']);
  });

  it('원본을 파일로 읽든 DB(raw_rows) 모양으로 읽든 대조 결과가 같다 — unknowns 포함 불일치 없음', () => {
    const viaDb = fromTables(JSON.parse(JSON.stringify(getMasil().tables))).dataset; // DB 적재분과 같은 모양(행 값은 jsonb 문자열)
    expect(verifyRecordedRun(rec, viaDb)).toEqual({ ok: true, replayedSteps: 'SEED → 갱신 통보 접수', mismatches: [] });
  });

  it('기록 원문에 키 · 헤더 · 접속 문자열이 없다', () => {
    const text = RECORDED_RUN_TEXTS.join('\n');
    expect(text).not.toMatch(/sk-ant|x-api-key|authorization|postgres:\/\//i);
    expect(rec.kind).toBe('RECORDED_LIVE_RUN');
  });
});
