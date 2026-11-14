/**
 * 쓰기 API 역할 검사 (CLAUDE.md 규칙 10 — 권한 경계를 넘는 처리는 서버가 막는다). 테스트 먼저.
 * - PATCH /api/tasks/:id : 작업의 담당 역할(ownerRole)만 시작 · 완료 · 취소 (ONTOLOGY 1-3 Task · 3-1 「누가 바꾸나」, SCREEN_SPEC S-07 「담당 역할」)
 * - POST /api/replenishment-requests : SCM 역할만 (SCREEN_SPEC S-09 「[보충 요청 만들기](SCM 역할)」)
 * 거부는 422 FORBIDDEN_ROLE 이고 아무 상태도 저장하지 않는다 (stateVersion 불변).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as reset from '@/app/api/scenarios/[id]/reset/route';
import * as meta from '@/app/api/meta/route';
import * as tasksList from '@/app/api/tasks/route';
import * as task from '@/app/api/tasks/[id]/route';
import * as events from '@/app/api/events/route';
import * as replenish from '@/app/api/replenishment-requests/route';
import * as overview from '@/app/api/overview/route';
import * as inventory from '@/app/api/analytics/inventory/route';
import * as audit from '@/app/api/audit/route';
import * as check from '@/app/api/scenarios/[id]/check/route';
import type { ApiError, AuditRowView, InventoryView, MetaView, OverviewView, ReplenishmentCreateResponse, ScenarioCheckView, TaskPatchResponse, TaskView } from '@/domain/api-types';
import { assertTaskActor, assertReplenishmentDrafter } from '@/domain/permissions';
import * as wf from '@/domain/workflow';
import { ds, tasksOf, toS1_5 } from '../helpers/scenario';
import { call, ctx, makeService, req } from '../helpers/api';

const doReset = (id: string) => call(reset.POST(req('', 'POST'), ctx({ id })));
const version = async () => (await call<MetaView>(meta.GET())).body.stateVersion;
const taskList = async (q = '') => (await call<TaskView[]>(tasksList.GET(req(`/api/tasks${q}`)))).body;
const patch = (id: string, body: unknown) => call<TaskPatchResponse & ApiError>(task.PATCH(req('', 'PATCH', body), ctx({ id })));

describe('도메인 — 작업 담당 역할 검사 (순수 함수)', () => {
  it('assertTaskActor: 담당 역할이면 통과, 아니면 FORBIDDEN_ROLE 422', () => {
    const t = tasksOf(toS1_5(), 'SEND_NOTICE')[0]!;
    expect(() => assertTaskActor(t, 'CONTRACT_OFFICER')).not.toThrow();
    expect(() => assertTaskActor(t, 'MARKETING_TEAM')).toThrow(expect.objectContaining({ code: 'FORBIDDEN_ROLE', httpStatus: 422 }));
    expect(() => assertTaskActor(t, 'MARKETING_TEAM')).toThrow(/이 작업은 계약 담당만 처리할 수 있습니다/);
  });

  it('startTask · cancelTask · completeTask(actorRole 지정) 모두 같은 검사', () => {
    const s = toS1_5();
    const t = tasksOf(s, 'SEND_NOTICE')[0]!;
    expect(() => wf.startTask(s, t.id, 'AGENCY')).toThrow(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
    expect(() => wf.cancelTask(s, t.id, { actorRole: 'SCM', reason: '중복' })).toThrow(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
    expect(() => wf.completeTask(s, ds, t.id, { actorRole: 'MASIL_CEO' })).toThrow(expect.objectContaining({ code: 'FORBIDDEN_ROLE' }));
    const ok = wf.completeTask(s, ds, t.id, { actorRole: 'CONTRACT_OFFICER' });
    expect(ok.transitions.find((x) => x.entityType === 'TASK')).toMatchObject({ toStatus: 'DONE', actorRole: 'CONTRACT_OFFICER' });
  });

  it('assertReplenishmentDrafter: SCM 만', () => {
    expect(() => assertReplenishmentDrafter('SCM')).not.toThrow();
    for (const r of ['MARKETING_TEAM', 'MASIL_CEO', 'GROUP_CEO_BOARD', 'CONTRACT_OFFICER', 'AGENCY'] as const) {
      expect(() => assertReplenishmentDrafter(r)).toThrow(expect.objectContaining({ code: 'FORBIDDEN_ROLE', httpStatus: 422 }));
    }
  });
});

describe('PATCH /api/tasks/:id — 담당 역할이 아니면 422 FORBIDDEN_ROLE, 상태 불변', () => {
  beforeEach(() => makeService());

  it('① S1_5: 통보 발송(계약 담당) 작업을 마케팅팀이 완료 → 422, 작업 · 계약 · 버전 그대로', async () => {
    await doReset('S1_5');
    const send = (await taskList('?role=CONTRACT_OFFICER')).find((t) => t.type === 'SEND_NOTICE')!;
    const v0 = await version();
    const r = await patch(send.id, { status: 'DONE', actorRole: 'MARKETING_TEAM', resultNote: '대신 완료' });
    expect([r.status, r.body.error.code]).toEqual([422, 'FORBIDDEN_ROLE']);
    expect(r.body.error.message).toContain('계약 담당');
    expect(await version()).toBe(v0);
    expect((await taskList()).find((t) => t.id === send.id)!.status).toBe('OPEN');
    expect((await call<OverviewView>(overview.GET())).body.contract.status).toBe('NOTICE_PENDING');
  });

  it('시작 · 취소도 담당 역할만', async () => {
    await doReset('S1_5');
    const send = (await taskList()).find((t) => t.type === 'SEND_NOTICE')!;
    const v0 = await version();
    const a = await patch(send.id, { status: 'IN_PROGRESS', actorRole: 'AGENCY' });
    const b = await patch(send.id, { status: 'CANCELLED', actorRole: 'SCM', resultNote: '중복' });
    expect([a.status, a.body.error.code, b.status, b.body.error.code]).toEqual([422, 'FORBIDDEN_ROLE', 422, 'FORBIDDEN_ROLE']);
    expect(await version()).toBe(v0);
  });

  it('actorRole 이 없으면 422 VALIDATION — 담당 역할로 간주하지 않는다', async () => {
    await doReset('S1_5');
    const send = (await taskList()).find((t) => t.type === 'SEND_NOTICE')!;
    const v0 = await version();
    const r = await patch(send.id, { status: 'DONE' });
    expect([r.status, r.body.error.code]).toEqual([422, 'VALIDATION']);
    expect(r.body.error.details).toMatchObject({ field: 'actorRole' });
    expect(await version()).toBe(v0);
  });

  it('담당 역할이면 통과 — 계약 NOTICE_SENT, 이력 행위자 = 계약 담당', async () => {
    await doReset('S1_5');
    const send = (await taskList()).find((t) => t.type === 'SEND_NOTICE')!;
    const r = await patch(send.id, { status: 'DONE', actorRole: 'CONTRACT_OFFICER', resultNote: '통보 발송 (모의)' });
    expect(r.status).toBe(200);
    expect(r.body.transitions.find((t) => t.entityType === 'TASK')).toMatchObject({ toStatus: 'DONE', actorRole: 'CONTRACT_OFFICER' });
    expect(r.body.transitions.find((t) => t.entityType === 'CONTRACT')).toMatchObject({ toStatus: 'NOTICE_SENT' });
  });

  it('그룹 보고(Masil 대표 담당)를 그룹 CEO/이사회가 완료할 수 없다 — 권한자라도 담당이 아니면 거부', async () => {
    await doReset('S1_5');
    const rep = (await taskList()).find((t) => t.type === 'REPORT_TO_GROUP')!;
    expect(rep.ownerRole).toBe('MASIL_CEO');
    const r = await patch(rep.id, { status: 'DONE', actorRole: 'GROUP_CEO_BOARD' });
    expect([r.status, r.body.error.code]).toEqual([422, 'FORBIDDEN_ROLE']);
    expect((await patch(rep.id, { status: 'DONE', actorRole: 'MASIL_CEO' })).status).toBe(200);
  });

  it('없는 작업은 404 (역할 검사보다 먼저)', async () => {
    await doReset('S1_5');
    const r = await patch('TSK-999', { status: 'DONE', actorRole: 'CONTRACT_OFFICER' });
    expect(r.status).toBe(404);
  });
});

describe('BE-18 SCM 보충 검토 작업은 PATCH 로 완료 불가 — SCM 보충 검토 회신으로만 닫힘', () => {
  beforeEach(() => makeService());

  it('S4: SCM 이 REPLENISHMENT_REVIEW · SCM INFO_REQUEST 를 PATCH DONE → 409, 초안 DRAFT · 작업 그대로', async () => {
    await doReset('S4');
    const scm = (await taskList('?role=SCM')).filter((t) => t.status === 'OPEN');
    expect(scm.map((t) => t.type).sort()).toEqual(['INFO_REQUEST', 'REPLENISHMENT_REVIEW']);
    const v0 = await version();
    for (const t of scm) {
      const r = await patch(t.id, { status: 'DONE', actorRole: 'SCM', resultNote: '완료 처리' });
      expect([r.status, r.body.error.code]).toEqual([409, 'INVALID_TRANSITION']);
      expect(r.body.error.message).toContain('SCM 보충 검토 회신으로 닫습니다');
    }
    expect(await version()).toBe(v0);
    expect((await call<InventoryView>(inventory.GET())).body.replenishments.every((r) => r.status === 'DRAFT')).toBe(true);
    expect((await taskList('?role=SCM')).filter((t) => t.status === 'OPEN')).toHaveLength(2);
  });

  it('시작 · 취소(사유)는 SCM 이 PATCH 로 할 수 있고, SCM 회신으로는 지금처럼 닫힌다', async () => {
    await doReset('S4');
    const [a, b] = (await taskList('?role=SCM')).filter((t) => t.status === 'OPEN');
    expect((await patch(a!.id, { status: 'IN_PROGRESS', actorRole: 'SCM' })).status).toBe(200);
    expect((await patch(b!.id, { status: 'CANCELLED', actorRole: 'SCM', resultNote: '중복 작업' })).status).toBe(200);
    await doReset('S4');
    await call(events.POST(req('', 'POST', { type: 'COUNTERPARTY_REPLY', payload: { from: 'SCM', outcome: 'INFO_PROVIDED', replenishmentNeeded: false, inboundExpectedDate: '2026-09-18', note: '불필요 (모의)' } })));
    expect((await taskList('?role=SCM')).every((t) => t.status === 'DONE')).toBe(true);
  });

  it('도메인: 담당 SCM 이어도 completeTask 는 409 (프리셋 경로 포함)', () => {
    let s = toS1_5();
    s = wf.advanceClock(s, '2026-07-20T09:00:00+09:00').state;
    s = wf.draftReplenishment(s, ds, { triggerLineId: 'PLAN-011' }).state;
    const t = s.tasks.find((x) => x.type === 'REPLENISHMENT_REVIEW')!;
    expect(() => wf.completeTask(s, ds, t.id, {})).toThrow(expect.objectContaining({ code: 'INVALID_TRANSITION', httpStatus: 409 }));
  });
});

describe('BE-17 프리셋 재생 영향 없음 — 모든 프리셋 점검 결과가 변경 전(커밋 f2ba215)과 같다', () => {
  beforeEach(() => makeService());
  /** f2ba215 에서 같은 점검을 돌린 결과 (기준 id:통과 여부). SEED 등은 원래 ① 항목 일부만 통과 */
  const BASELINE: Record<string, string> = {
    SEED: 'AC-1-02:1,AC-1-02b:0,AC-1-06:0,AC-1-08:0,AC-1-09:0,AC-1-10:1,AC-1-10b:1',
    S1_RECEIVED: 'AC-1-02:1,AC-1-02b:1,AC-1-06:0,AC-1-08:0,AC-1-09:0,AC-1-10:1,AC-1-10b:1',
    S1_4: 'AC-1-02:1,AC-1-02b:1,AC-1-06:1,AC-1-08:0,AC-1-09:0,AC-1-10:1,AC-1-10b:1',
    S1_5: 'AC-1-02:1,AC-1-02b:1,AC-1-06:1,AC-1-08:1,AC-1-09:0,AC-1-10:1,AC-1-10b:1',
    S1_6: 'AC-1-02:1,AC-1-02b:1,AC-1-06:1,AC-1-08:1,AC-1-09:1,AC-1-10:1,AC-1-10b:1',
    S1_7: 'AC-1-02:1,AC-1-02b:1,AC-1-06:1,AC-1-08:1,AC-1-09:1,AC-1-10:1,AC-1-10b:1',
    S2: 'AC-2-01:1,AC-2-02:1,AC-2-03:1',
    S3_1: 'AC-3-01:1,AC-3-01b:1',
    S3_B: 'AC-3-01:1,AC-3-01b:1,AC-3-06:1',
    S4: 'AC-4-02:1,AC-4-03:1,AC-4-04:1,AC-4-06a:1,AC-4-05:1', // BE-24: 판단안 v1 항목 추가 (나머지 9개 프리셋 불변)
  };
  it('10개 프리셋 점검 항목별 결과 동일', async () => {
    for (const [id, expected] of Object.entries(BASELINE)) {
      await doReset(id);
      const c = await call<ScenarioCheckView>(check.GET(req(''), ctx({ id })));
      expect([id, c.body.criteria.map((x) => `${x.id}:${x.passed ? 1 : 0}`).join(',')]).toEqual([id, expected]);
    }
  });
});

describe('POST /api/replenishment-requests — SCM 역할만 (S-09)', () => {
  beforeEach(() => makeService());

  /** S4 의 초안을 SCM '불필요' 회신으로 닫아 새 초안을 만들 수 있는 상태로 */
  async function closedDrafts() {
    await doReset('S4');
    await call(events.POST(req('', 'POST', { type: 'COUNTERPARTY_REPLY', payload: { from: 'SCM', outcome: 'INFO_PROVIDED', replenishmentNeeded: false, inboundExpectedDate: '2026-09-18', note: '불필요 (모의)' } })));
  }
  const reps = async () => (await call<InventoryView>(inventory.GET())).body.replenishments;

  it('마케팅팀 → 422 FORBIDDEN_ROLE, 보충요청 수 · 버전 그대로', async () => {
    await closedDrafts();
    const n0 = (await reps()).length;
    const v0 = await version();
    const r = await call<ApiError>(replenish.POST(req('', 'POST', { triggerLineId: 'PLAN-011', actorRole: 'MARKETING_TEAM' })));
    expect([r.status, r.body.error.code]).toEqual([422, 'FORBIDDEN_ROLE']);
    expect(r.body.error.message).toContain('SCM');
    expect((await reps()).length).toBe(n0);
    expect(await version()).toBe(v0);
  });

  it('actorRole 없으면 422 VALIDATION', async () => {
    await closedDrafts();
    const r = await call<ApiError>(replenish.POST(req('', 'POST', { triggerLineId: 'PLAN-011' })));
    expect([r.status, r.body.error.code]).toEqual([422, 'VALIDATION']);
  });

  it('SCM → 201, 초안 3건', async () => {
    await closedDrafts();
    const r = await call<ReplenishmentCreateResponse>(replenish.POST(req('', 'POST', { triggerLineId: 'PLAN-011', actorRole: 'SCM' })));
    expect(r.status).toBe(201);
    expect(r.body.replenishments.map((x) => x.skuId)).toEqual(['SKU-1001', 'SKU-1002', 'SKU-1004']);
    const rows = (await call<AuditRowView[]>(audit.GET(req('/api/audit?entityType=REPLENISHMENT')))).body.filter((a) => a.fromStatus === null);
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});
