/**
 * Postgres 저장소 (Drizzle). 운영 상태(WorldState)를 엔티티 테이블에 영속화한다.
 * - write: 트랜잭션 안에서 sim_state.version 을 조건부로 올리고(낙관적 잠금 → 다르면 409 CONFLICT),
 *   바뀔 수 있는 엔티티는 upsert, 이력 · 사건은 새 행만 추가(append-only).
 * - replace: 운영 테이블만 비우고 다시 넣는다(시나리오 초기화). raw_* · assumptions 는 건드리지 않는다.
 */
import { asc, eq, getTableColumns, sql, type SQL } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { PresetId } from '@/domain/api-types';
import { DomainError } from '@/domain/errors';
import type { ActorKind, ActorRole, AuditLogEntry, DomainEvent, RuleId } from '@/domain/types';
import type { WorldState } from '@/domain/workflow';
import type { Db } from '../db/client';
import * as t from '../db/schema';
import type { StoredWorld, WorldStore } from './types';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Row = Record<string, unknown> & { id: string };

interface EntitySpec {
  table: PgTable;
  rows: (s: WorldState) => Row[];
}

const asData = (x: unknown) => x as Record<string, unknown>;

const ENTITIES: EntitySpec[] = [
  { table: t.contracts, rows: (s) => [{ id: s.contract.id, status: s.contract.status, ord: 0, data: asData(s.contract) }] },
  { table: t.expansionLines, rows: (s) => s.lines.map((l, i) => ({ id: l.id, status: l.status, ord: i, requiredRole: l.routing?.requiredRole ?? null, contractDeadline: l.contractDeadline, data: asData(l) })) },
  {
    table: t.approvalRequests,
    rows: (s) => s.approvals.map((a, i) => ({ id: a.id, status: a.status, ord: i, subjectType: a.subjectType, requiredRole: a.requiredRole, assessmentId: a.assessmentId, supersedesId: a.supersedesId, data: asData(a) })),
  },
  { table: t.approvalReplies, rows: (s) => s.replies.map((r, i) => ({ id: r.id, status: r.outcome, ord: i, requestId: r.requestId, respondentRole: r.respondentRole, data: asData(r) })) },
  { table: t.tasks, rows: (s) => s.tasks.map((x, i) => ({ id: x.id, status: x.status, ord: i, type: x.type, ownerRole: x.ownerRole, subjectId: x.subjectId, dueAt: x.dueAt, data: asData(x) })) },
  { table: t.notices, rows: (s) => s.notices.map((x, i) => ({ id: x.id, status: null, ord: i, data: asData(x) })) },
  { table: t.noticeReceipts, rows: (s) => s.receipts.map((x, i) => ({ id: x.id, status: null, ord: i, data: asData(x) })) },
  { table: t.replenishmentRequests, rows: (s) => s.replenishments.map((x, i) => ({ id: x.id, status: x.status, ord: i, requiredRole: x.requiredRole, triggerLineId: x.triggerLineId, data: asData(x) })) },
  { table: t.assessments, rows: (s) => s.assessments.map((x, i) => ({ id: x.id, status: 'CREATED', ord: i, subjectType: x.subjectType, aiMode: x.aiMode, data: asData(x) })) },
];

const OPERATIONAL: PgTable[] = [...ENTITIES.map((e) => e.table), t.events, t.auditLog, t.simState];

function auditRow(a: AuditLogEntry, ord: number) {
  return { id: a.id, ord, entityType: a.entityType, entityId: a.entityId, fromStatus: a.fromStatus, toStatus: a.toStatus, actorRole: a.actorRole, actorKind: a.actorKind, ruleIds: a.ruleIds, eventId: a.eventId, reason: a.reason, simAt: a.simAt, snapshot: a.snapshot };
}
function eventRow(e: DomainEvent, ord: number) {
  return { id: e.id, ord, type: e.type, label: e.label, simAt: e.simAt, createdBy: e.createdBy, payload: e.payload as Record<string, unknown> };
}

async function upsert(tx: Tx, table: PgTable, rows: Row[]): Promise<void> {
  if (rows.length === 0) return;
  const cols = getTableColumns(table);
  const set: Record<string, SQL> = {};
  for (const [key, col] of Object.entries(cols)) if (key !== 'id') set[key] = sql.raw(`excluded."${col.name}"`);
  await tx
    .insert(table)
    .values(rows as never)
    .onConflictDoUpdate({ target: (cols as Record<string, never>).id!, set: set as never });
}

export class PgStore implements WorldStore {
  readonly kind = 'POSTGRES' as const;
  constructor(private readonly db: Db) {}

  async read(): Promise<StoredWorld | null> {
    const db = this.db;
    const [meta] = await db.select().from(t.simState).where(eq(t.simState.id, 1));
    if (!meta) return null;
    const data = async <T>(table: typeof t.contracts) => (await db.select().from(table).orderBy(asc(table.ord))).map((r) => r.data as T);
    const [contract] = await data<WorldState['contract']>(t.contracts);
    if (!contract) return null;
    const audit = (await db.select().from(t.auditLog).orderBy(asc(t.auditLog.ord))).map(
      (a): AuditLogEntry => ({
        id: a.id,
        entityType: a.entityType,
        entityId: a.entityId,
        fromStatus: a.fromStatus,
        toStatus: a.toStatus,
        actorRole: a.actorRole as ActorRole,
        actorKind: a.actorKind as ActorKind,
        ruleIds: a.ruleIds as RuleId[],
        eventId: a.eventId,
        reason: a.reason,
        simAt: a.simAt,
        createdAt: a.simAt,
        snapshot: a.snapshot as Record<string, unknown>,
      }),
    );
    const events = (await db.select().from(t.events).orderBy(asc(t.events.ord))).map(
      (e): DomainEvent => ({ id: e.id, type: e.type as DomainEvent['type'], payload: e.payload, label: e.label as DomainEvent['label'], simAt: e.simAt, createdAt: e.simAt, createdBy: e.createdBy as ActorRole }),
    );
    const state: WorldState = {
      simNow: meta.simNow,
      contract,
      proposal: (meta.proposal as WorldState['proposal']) ?? null,
      lines: await data(t.expansionLines as never),
      approvals: await data(t.approvalRequests as never),
      replies: await data(t.approvalReplies as never),
      tasks: await data(t.tasks as never),
      notices: await data(t.notices),
      receipts: await data(t.noticeReceipts),
      replenishments: await data(t.replenishmentRequests as never),
      assessments: await data(t.assessments as never),
      audit,
      events,
      forecast: meta.forecast as WorldState['forecast'],
      arDueOverrides: meta.arDueOverrides as WorldState['arDueOverrides'],
      seq: meta.seq as WorldState['seq'],
    };
    return { state, version: meta.version, preset: (meta.preset as PresetId | null) ?? null };
  }

  private async putAll(tx: Tx, s: WorldState, prev: WorldState | null): Promise<void> {
    for (const e of ENTITIES) await upsert(tx, e.table, e.rows(s));
    const a0 = prev?.audit.length ?? 0;
    const newAudit = s.audit.slice(a0).map((a, i) => auditRow(a, a0 + i));
    if (newAudit.length) await tx.insert(t.auditLog).values(newAudit);
    const e0 = prev?.events.length ?? 0;
    const newEvents = s.events.slice(e0).map((e, i) => eventRow(e, e0 + i));
    if (newEvents.length) await tx.insert(t.events).values(newEvents);
  }

  async write(next: WorldState, opts: { expectedVersion: number; prev: WorldState }): Promise<number> {
    return this.db.transaction(async (tx) => {
      const updated = await tx
        .update(t.simState)
        .set({ simNow: next.simNow, version: sql`${t.simState.version} + 1`, forecast: next.forecast, arDueOverrides: next.arDueOverrides, seq: next.seq, proposal: next.proposal, updatedAt: new Date() })
        .where(sql`${t.simState.id} = 1 and ${t.simState.version} = ${opts.expectedVersion}`)
        .returning({ version: t.simState.version });
      if (updated.length === 0) throw new DomainError('CONFLICT', '다른 처리가 먼저 상태를 바꿨습니다 — 다시 조회 후 시도하세요', { expectedVersion: opts.expectedVersion });
      await this.putAll(tx, next, opts.prev);
      return updated[0]!.version;
    });
  }

  async replace(state: WorldState, preset: PresetId | null): Promise<number> {
    return this.db.transaction(async (tx) => {
      const [old] = await tx.select({ version: t.simState.version }).from(t.simState).where(eq(t.simState.id, 1));
      for (const table of OPERATIONAL) await tx.delete(table);
      const version = (old?.version ?? 0) + 1;
      await tx.insert(t.simState).values({ id: 1, simNow: state.simNow, version, preset, forecast: state.forecast, arDueOverrides: state.arDueOverrides, seq: state.seq, proposal: state.proposal });
      await this.putAll(tx, state, null);
      return version;
    });
  }
}
