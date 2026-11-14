/**
 * 프론트엔드 요청 7건 (LOG-017) — 테스트 먼저. api-types 는 필드 추가만 (기존 필드 유지).
 * 1 AR 목록 API · 2 보충요청 금액 Money · 3 감사 이력 표시 문구 · 4 officialComparison v1 대비 변경 · 5 diffNotes 출처 · 6 S-10 이벤트 표
 * (7 기안 접수 건 범위는 기획이 기각 — BE-20: 25건 전체만, lineIds 422)
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as reset from '@/app/api/scenarios/[id]/reset/route';
import * as receivables from '@/app/api/receivables/route';
import * as inventory from '@/app/api/analytics/inventory/route';
import * as cash from '@/app/api/analytics/cash/route';
import * as audit from '@/app/api/audit/route';
import * as events from '@/app/api/events/route';
import * as overview from '@/app/api/overview/route';
import * as proposal from '@/app/api/proposals/[id]/route';
import type { ApiError, AuditRowView, CashView, EventResponse, InventoryView, OverviewView, ProposalView, ReceivableView } from '@/domain/api-types';
import { cashFlowItems, simulateCash } from '@/domain/cash';
import { MASIL_FILES } from '@/domain/files';
import { getMasil } from '@/server/raw/masil';
import { ds } from '../helpers/scenario';
import { call, ctx, makeService, req } from '../helpers/api';

const doReset = (id: string) => call(reset.POST(req('', 'POST'), ctx({ id })));
const getCash = async (q = '') => (await call<CashView>(cash.GET(req(`/api/analytics/cash${q}`)))).body;
const postEvent = (type: string, payload: unknown) => call<EventResponse & ApiError>(events.POST(req('', 'POST', { type, payload })));
const tables = getMasil().tables;

describe('1. GET /api/receivables — 회수 지연 양식용 AR 목록', () => {
  beforeEach(() => makeService());

  it('원본 21행, 금액 · 만기 · 출처 파일/행', async () => {
    await doReset('SEED');
    const r = await call<ReceivableView[]>(receivables.GET());
    expect(r.status).toBe(200);
    expect(r.body).toHaveLength(tables.ar.rows.length);
    const m1 = r.body.find((x) => x.id === 'MAR-0001')!;
    expect(m1.amount).toMatchObject({ value: 275_408_316, label: 'ORIGINAL', scale: 'FULL' });
    expect(m1.outstanding).toMatchObject({ value: 275_408_316, label: 'ORIGINAL', scale: 'FULL' });
    expect(m1.currentDue).toMatchObject({ value: '2026-07-03', label: 'ORIGINAL' });
    expect(m1.ref).toMatchObject({ file: MASIL_FILES.ar, row: 1, rowKey: 'MAR-0001' });
    expect(m1.overridden).toBe(false);
    // 출처 행 번호 = 원본 src_row
    for (const x of r.body) expect(x.ref.row).toBe(tables.ar.rows.find((t) => t.values.ar_id === x.id)!.src_row);
  });

  it('기준일 이전 만기(연체) AR 은 재전망 제외 표시 (A-08)', async () => {
    await doReset('SEED');
    const m3 = (await call<ReceivableView[]>(receivables.GET())).body.find((x) => x.id === 'MAR-0003')!;
    expect(m3).toMatchObject({ overdue: true, inForecast: false });
    expect(m3.outstanding.value).toBe(50_863_021);
  });

  it('② 뒤 MAR-0004 현재 만기 = 2026-08-30 (모의), 원본 만기는 그대로', async () => {
    await doReset('S2');
    const m4 = (await call<ReceivableView[]>(receivables.GET())).body.find((x) => x.id === 'MAR-0004')!;
    expect(m4.overridden).toBe(true);
    expect(m4.currentDue).toMatchObject({ value: '2026-08-30', label: 'MOCK' });
    expect(m4.originalDue.label).toBe('ORIGINAL');
    expect(m4.originalDue.value).not.toBe('2026-08-30');
  });
});

describe('2. InventoryView.replenishments 금액 Money', () => {
  beforeEach(() => makeService());
  it('amount = Money<FULL>(amountKrw), unitCost · paymentDate 출처', async () => {
    await doReset('S4');
    const reps = (await call<InventoryView>(inventory.GET())).body.replenishments;
    expect(reps.map((r) => r.amount.value)).toEqual([524_160_000, 524_160_000, 436_800_000]);
    for (const r of reps) {
      expect(r.amount).toMatchObject({ value: r.amountKrw, scale: 'FULL', label: 'AGGREGATED' });
      expect(r.amount.assumptionIds).toEqual(expect.arrayContaining(['A-17', 'A-18']));
      expect(r.unitCost).toMatchObject({ value: 21_840, scale: 'FULL' });
      expect(r.paymentDate).toMatchObject({ value: '2026-08-14', label: 'ASSUMPTION', assumptionIds: ['A-19'] });
    }
  });
});

describe('3. 감사 이력 표시 문구 (displayText · fromText · toText)', () => {
  beforeEach(() => makeService());

  it('보충요청 종결 3종 문구가 이력 행에 실린다 (화면이 사유를 파싱하지 않게)', async () => {
    await doReset('S4');
    const e = await postEvent('COUNTERPARTY_REPLY', { from: 'SCM', outcome: 'INFO_PROVIDED', replenishmentNeeded: false, inboundExpectedDate: '2026-09-18', note: '불필요 (모의)' });
    const closed = e.body.transitions.filter((t) => t.entityType === 'REPLENISHMENT') as AuditRowView[];
    expect(closed.map((t) => t.displayText)).toEqual(Array(3).fill('SCM 검토: 불필요로 종결 (승인 거절 아님)'));
    const rows = (await call<AuditRowView[]>(audit.GET(req('/api/audit?entityType=REPLENISHMENT')))).body.filter((r) => r.toStatus === 'REJECTED');
    expect(rows.every((r) => r.displayText === 'SCM 검토: 불필요로 종결 (승인 거절 아님)')).toBe(true);

    await doReset('S4');
    await postEvent('COUNTERPARTY_REPLY', { from: 'SCM', outcome: 'REJECTED', note: 'Corevia F1 포화 (모의)' });
    const noSupply = (await call<AuditRowView[]>(audit.GET(req('/api/audit?entityType=REPLENISHMENT')))).body.filter((r) => r.toStatus === 'REJECTED');
    expect(noSupply.map((r) => r.displayText)).toEqual(Array(3).fill('SCM 검토: 보충 불가로 종결 (승인 거절 아님)'));
  });

  it('일반 전이 · 생성 · 상태 유지 · 재전망 행 문구', async () => {
    await doReset('S2');
    const rows = (await call<AuditRowView[]>(audit.GET(req('/api/audit')))).body;
    const c = rows.find((r) => r.entityType === 'CONTRACT' && r.toStatus === 'UNDER_REVIEW')!;
    expect(c).toMatchObject({ fromText: '유효 (검토 전)', toText: '검토 중', displayText: '유효 (검토 전) → 검토 중' });
    const created = rows.find((r) => r.entityType === 'TASK' && r.fromStatus === null)!;
    expect(created.fromText).toBeNull();
    expect(created.displayText).toMatch(/^작업 생성: /);
    const keep = rows.find((r) => r.entityType === 'EXPANSION_LINE' && r.fromStatus !== null && r.fromStatus === r.toStatus)!;
    expect(keep.displayText).toMatch(/^상태 유지: /);
    const cf = rows.find((r) => r.entityType === 'CASH_FORECAST')!;
    expect(cf.displayText).toBe('재전망 교체 CF-v1 → CF-v2');
    const asm = rows.find((r) => r.entityType === 'ASSESSMENT')!;
    expect(asm.displayText).toBe(`판단안 생성 ${asm.entityId}`);
    // 다른 화면의 이력 목록도 같은 모양
    const ov = (await call<OverviewView>(overview.GET())).body;
    expect(ov.recentAudit.every((r) => typeof r.displayText === 'string' && r.displayText.length > 0)).toBe(true);
  });
});

describe('4 · 5 · 6. S-10 자금 — v1 대비 변경 · diffNotes 출처 · 이벤트 표', () => {
  beforeEach(() => makeService());

  it('4. 시드: changedFromV1 모두 false · ② 뒤 v2 비교에서 08-24 · 08-31 만 true, v1 값 동봉', async () => {
    await doReset('SEED');
    expect((await getCash()).officialComparison.every((r) => r.changedFromV1 === false && r.v1Recalculated === null)).toBe(true);
    await doReset('S2');
    const v = await getCash();
    expect(v.officialComparison.filter((r) => r.changedFromV1).map((r) => r.week)).toEqual(['2026-08-24', '2026-08-31']);
    const w = v.officialComparison.find((r) => r.week === '2026-08-24')!;
    expect(w.v1Recalculated!.value).not.toBe(w.recalculated.value);
    expect(w.v1Recalculated).toMatchObject({ label: 'AGGREGATED', scale: 'FULL' });
    // v1 기준 대조는 변경 표시 없음
    expect((await getCash('?version=v1')).officialComparison.every((r) => !r.changedFromV1)).toBe(true);
  });

  it('5. diffNotesSourced — 출처 라벨 · refs 를 단 문구 (주장 · 집계 · 원본근거해석 · 원본)', async () => {
    await doReset('SEED');
    const v = await getCash();
    expect(v.diffNotes.length).toBeGreaterThan(0); // 기존 필드 유지
    const labels = v.diffNotesSourced.map((n) => n.label);
    expect(labels).toEqual(['CLAIM', 'AGGREGATED', 'INTERPRETED', 'ORIGINAL']);
    for (const n of v.diffNotesSourced) expect(n.refs.length).toBeGreaterThan(0);
    expect(v.diffNotesSourced[2]!.value).toContain('원인 미확인');
  });

  it('6. cashEvents — 날짜 · 항목 · 금액 · 출처 파일/행, 포함분으로 일별 종가가 재현된다', async () => {
    await doReset('SEED');
    const v = await getCash();
    const ev = v.cashEvents;
    // AR 21 + AP 24 + PO 14 원본 행이 모두 표에 있다 (제외분은 사유와 함께)
    expect(ev).toHaveLength(tables.ar.rows.length + tables.ap.rows.length + tables.purchaseOrders.rows.length);
    const m1 = ev.find((e) => e.id === 'MAR-0001')!;
    expect(m1).toMatchObject({ kind: 'AR_INFLOW', direction: 'IN', date: '2026-07-03', included: true, label: 'ORIGINAL' });
    expect(m1.ref).toMatchObject({ file: MASIL_FILES.ar, row: 1, rowKey: 'MAR-0001' });
    const po = ev.filter((e) => e.kind === 'PO_PAYMENT');
    expect(po).toHaveLength(14);
    expect(po.reduce((a, e) => a + e.amount.value, 0)).toBe(3_749_760_000);
    expect(new Set(po.map((e) => e.date))).toEqual(new Set(['2026-07-21']));
    const apLinked = ev.filter((e) => e.kind === 'AP_OUTFLOW' && !e.included && e.excludedReason?.includes('발주 대금'));
    expect(apLinked.length).toBeGreaterThan(0);
    expect(ev.find((e) => e.id === 'MAR-0003')).toMatchObject({ included: false, date: null, assumptionIds: ['A-08'] });
    // 재현: 기초 잔액 + 포함분 누적 = 일별 종가
    const byDate = new Map<string, number>();
    for (const e of ev) if (e.included) byDate.set(e.date!, (byDate.get(e.date!) ?? 0) + (e.direction === 'IN' ? e.amount.value : -e.amount.value));
    let bal = v.current.opening.value;
    for (const d of v.current.daily) {
      bal += byDate.get(d.date) ?? 0;
      expect(d.closingKrw).toBe(bal);
    }
  });

  it('6. ② 뒤 MAR-0004 행은 모의 날짜(8/30 일요일 → 8/31 영업일), 라벨 MOCK', async () => {
    await doReset('S2');
    const m4 = (await getCash()).cashEvents.find((e) => e.id === 'MAR-0004')!;
    expect(m4).toMatchObject({ date: '2026-08-31', label: 'MOCK', included: true });
    expect(m4.assumptionIds).toEqual(expect.arrayContaining(['A-09']));
  });

  it('도메인 cashFlowItems 는 simulateCash 와 같은 입력 (재현 단위 테스트)', () => {
    const items = cashFlowItems(ds, { arDueOverrides: { 'MAR-0004': '2026-08-30' } });
    const run = simulateCash(ds, { id: 'x', arDueOverrides: { 'MAR-0004': '2026-08-30' } });
    const byDate = new Map<string, number>();
    for (const i of items) if (i.excluded === null) byDate.set(i.date!, (byDate.get(i.date!) ?? 0) + i.amountKrw);
    let bal = run.opening;
    for (const d of run.daily) {
      bal += byDate.get(d.date) ?? 0;
      expect(d.closingKrw).toBe(bal);
    }
    expect(items.find((i) => i.id === 'MAR-0004')).toMatchObject({ overrideDate: '2026-08-30', date: '2026-08-31' });
  });
});

describe('BE-20 기안 접수는 25건 전체로만 — 범위 선택 없음 (ONTOLOGY 9-2 ① 기각, R-AUTH-01)', () => {
  beforeEach(() => makeService());

  it('payload 에 lineIds 가 있으면 422 VALIDATION, 상태 불변', async () => {
    await doReset('SEED');
    const r = await postEvent('EXPANSION_PROPOSAL_RECEIVED', { proposalId: 'PROP-2026-07', lineIds: ['PLAN-001'] });
    expect([r.status, r.body.error.code]).toEqual([422, 'VALIDATION']);
    expect(r.body.error.message).toContain('25건 전체');
    expect((await call<OverviewView>(overview.GET())).body.received).toBe(false);
  });

  it('{proposalId} → 25건 접수, 두 번째는 409', async () => {
    await doReset('SEED');
    const a = await postEvent('EXPANSION_PROPOSAL_RECEIVED', { proposalId: 'PROP-2026-07' });
    expect(a.status).toBe(201);
    const lines = (await call<ProposalView>(proposal.GET(req('/api/proposals/PROP-2026-07'), ctx({ id: 'PROP-2026-07' })))).body.lines;
    expect(lines).toHaveLength(25);
    expect((await postEvent('EXPANSION_PROPOSAL_RECEIVED', { proposalId: 'PROP-2026-07' })).status).toBe(409);
  });
});
