/** 기획 8-4 BE-11 · BE-12 · BE-13 · BE-16 — 테스트 먼저 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as reset from '@/app/api/scenarios/[id]/reset/route';
import * as check from '@/app/api/scenarios/[id]/check/route';
import * as events from '@/app/api/events/route';
import * as registry from '@/app/api/data-registry/route';
import * as inventory from '@/app/api/analytics/inventory/route';
import * as replies from '@/app/api/approval-requests/[id]/replies/route';
import * as clockPreview from '@/app/api/clock/preview/route';
import * as clockAdvance from '@/app/api/clock/advance/route';
import * as tasksList from '@/app/api/tasks/route';
import type { EventResponse, InventoryView, RegistryView, ScenarioCheckView, TaskView } from '@/domain/api-types';
import { MOCK_REPLIES } from '@/domain/mockReplies';
import * as wf from '@/domain/workflow';
import { at, ds, tasksOf, toS1_5 } from '../helpers/scenario';
import { call, ctx, makeService, req } from '../helpers/api';

const doReset = (id: string) => call(reset.POST(req('', 'POST'), ctx({ id })));
const gaps = async () => (await call<RegistryView>(registry.GET())).body.gaps;
const gap = (g: RegistryView['gaps'], id: string) => g.find((x) => x.id === id)!;
const reply = (payload: unknown) => call<EventResponse>(events.POST(req('', 'POST', { type: 'COUNTERPARTY_REPLY', payload })));

describe('BE-11 · BE-19 가정 목록 A-01~A-36', () => {
  beforeEach(() => makeService());
  it('data-registry 가정 36개, A-32 ~ A-36 포함', async () => {
    const r = await call<RegistryView>(registry.GET());
    expect(r.body.assumptions.map((a) => a.id)).toEqual(Array.from({ length: 36 }, (_, i) => `A-${String(i + 1).padStart(2, '0')}`));
  });
});

describe('BE-12 공백 상태 OPEN | FILLED_BY_MOCK — 원본 공백을 해소로 돌려주지 않는다', () => {
  beforeEach(() => makeService());

  it('시드: G-02 · G-03 · G-08 모두 OPEN, 어떤 공백도 open:false 아님', async () => {
    await doReset('SEED');
    const g = await gaps();
    expect(['G-02', 'G-03', 'G-08'].map((id) => gap(g, id).status)).toEqual(['OPEN', 'OPEN', 'OPEN']);
    expect(g.every((x) => x.open === true)).toBe(true);
  });

  it('① S1-6 뒤 G-03 = FILLED_BY_MOCK (원본 공백 그대로)', async () => {
    await doReset('S1_6');
    const g = await gaps();
    expect(gap(g, 'G-03')).toMatchObject({ status: 'FILLED_BY_MOCK', open: true });
    expect(gap(g, 'G-03').statusText).toContain('모의 회신으로 보완 — 원본 공백은 그대로');
    expect(gap(g, 'G-02').status).toBe('OPEN');
  });

  it('에이전시 정보 제공 뒤 G-02 = FILLED_BY_MOCK, SCM 회신 뒤 G-08 = FILLED_BY_MOCK', async () => {
    await doReset('S3_1');
    await reply({ from: 'AGENCY', outcome: 'INFO_PROVIDED', note: 'GMV 연동 분기 정산 (모의)' });
    expect(gap(await gaps(), 'G-02').status).toBe('FILLED_BY_MOCK');
    await doReset('S4');
    expect(gap(await gaps(), 'G-08').status).toBe('OPEN');
    await reply({ from: 'SCM', outcome: 'INFO_PROVIDED', replenishmentNeeded: false, inboundExpectedDate: '2026-09-18', note: '불필요 (모의)' });
    const g = await gaps();
    expect(gap(g, 'G-08').status).toBe('FILLED_BY_MOCK');
    expect(g.every((x) => x.open === true)).toBe(true);
  });
});

describe('BE-13 보충요청 종결 문구 statusText', () => {
  beforeEach(() => makeService());
  const texts = async () => (await call<InventoryView>(inventory.GET())).body.replenishments.map((r) => r.statusText);

  it('④-a SCM 불필요 → "SCM 검토: 불필요로 종결 (승인 거절 아님)"', async () => {
    await doReset('S4');
    expect(new Set(await texts()).size).toBe(1);
    await reply({ from: 'SCM', outcome: 'INFO_PROVIDED', replenishmentNeeded: false, note: '불필요 (모의)' });
    expect(new Set(await texts())).toEqual(new Set(['SCM 검토: 불필요로 종결 (승인 거절 아님)']));
  });

  it('SCM 거절 → "SCM 검토: 보충 불가로 종결 (승인 거절 아님)"', async () => {
    await doReset('S4');
    await reply({ from: 'SCM', outcome: 'REJECTED', note: '보충 불가 (모의)' });
    expect(new Set(await texts())).toEqual(new Set(['SCM 검토: 보충 불가로 종결 (승인 거절 아님)']));
  });

  it('④-b 권한자 거절 → "승인 거절"', async () => {
    await doReset('S4');
    const e = await reply({ from: 'SCM', outcome: 'INFO_PROVIDED', replenishmentNeeded: true, note: '필요 (모의)' });
    await call(replies.POST(req('', 'POST', { respondentRole: 'GROUP_CEO_BOARD', outcome: 'REJECTED', reason: '하회 구간 (모의)' }), ctx({ id: e.body.createdApprovals[0]!.id })));
    expect(new Set(await texts())).toEqual(new Set(['승인 거절']));
  });
});

describe('BE-16 ① 정상 흐름에 승인조건 문서화 · 그룹 보고 완료', () => {
  beforeEach(() => makeService());

  it('S1_6 에서 7/18 미리보기: 지나가는 기한 2건 · 전이 5건(기안 건만), 이동 뒤 OVERDUE 0', async () => {
    await doReset('S1_6');
    const to = '2026-07-18T00:00:00+09:00';
    const p = await call<{ passingDeadlines: unknown[]; transitions: { entityType: string }[] }>(clockPreview.GET(req(`/api/clock/preview?to=${encodeURIComponent(to)}`)));
    expect(p.body.passingDeadlines).toHaveLength(2);
    expect(p.body.transitions).toHaveLength(5);
    expect(p.body.transitions.every((t) => t.entityType === 'EXPANSION_LINE')).toBe(true);
    await call(clockAdvance.POST(req('', 'POST', { to })));
    const ts = await call<TaskView[]>(tasksList.GET(req('/api/tasks?status=OVERDUE')));
    expect(ts.body).toEqual([]);
  });

  it('S1_7 점검에 "OVERDUE 작업 0" 포함 · 전부 통과, S4 에도 OVERDUE 없음', async () => {
    await doReset('S1_7');
    const c = await call<ScenarioCheckView>(check.GET(req(''), ctx({ id: 'S1_7' })));
    expect(c.body.criteria.find((x) => x.text.includes('OVERDUE'))).toMatchObject({ passed: true });
    expect(c.body.passed).toBe(c.body.total);
    await doReset('S4');
    expect((await call<TaskView[]>(tasksList.GET(req('/api/tasks?status=OVERDUE')))).body).toEqual([]);
  });

  it('두 작업을 완료하지 않고 7/18 로 가면 둘 다 OVERDUE (기한 감시는 그대로)', () => {
    let s = toS1_5();
    s = wf.completeTask(wf.advanceClock(s, at('2026-07-13', '10:00')).state, ds, tasksOf(s, 'SEND_NOTICE')[0]!.id, {}).state;
    s = wf.counterpartyReply(wf.advanceClock(s, at('2026-07-14', '11:00')).state, ds, MOCK_REPLIES.S1_6_AGENCY_RECEIPT).state;
    s = wf.advanceClock(s, '2026-07-18T00:00:00+09:00').state;
    expect(s.tasks.filter((t) => t.status === 'OVERDUE').map((t) => t.type).sort()).toEqual(['DOCUMENT_CONDITIONS', 'REPORT_TO_GROUP']);
  });
});
