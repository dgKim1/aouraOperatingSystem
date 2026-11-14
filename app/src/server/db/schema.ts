/**
 * Drizzle 스키마 (axhub Postgres · 로컬 Postgres 공통). 마이그레이션은 app/drizzle/migrations (drizzle-kit generate).
 *
 * 1) 원본 적재 (읽기 전용): raw_files · raw_rows — 04_원본데이터 CSV 를 행 그대로(src_file · src_row) 넣는다.
 *    ONTOLOGY 1-1 의 raw_<파일명> 17개 테이블 대신 (파일, 행) 키 하나로 둔다 — 열 이름 · 'NONE' 문자열을 바꾸지 않고 보존하기 위해.
 * 2) 가정 데이터: assumptions (source = 'assumption') — A-01~A-34 목록 사본 (domain/registry.ts).
 * 3) 운영 테이블: 엔티티별 테이블 + 핵심 열(조회용) + data jsonb(도메인 객체 전체). 이력(audit_log) · 사건(events)은 추가만.
 *    상태 계산 · 전이는 domain/workflow 가 하고, 이 테이블은 결과를 영속화만 한다 (DD-011).
 */
import { integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

// ───────── 원본 (읽기 전용) ─────────
export const rawFiles = pgTable('raw_files', {
  file: text('file').primaryKey(),
  header: jsonb('header').$type<string[]>().notNull(),
  rowCount: integer('row_count').notNull(),
  scale: text('scale').notNull(),
  label: text('label').notNull(),
  source: text('source').notNull().default('original'),
  loadedAt: timestamp('loaded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rawRows = pgTable(
  'raw_rows',
  {
    srcFile: text('src_file').notNull(),
    /** 헤더 제외 1부터 */
    srcRow: integer('src_row').notNull(),
    values: jsonb('values').$type<Record<string, string>>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.srcFile, t.srcRow] })],
);

// ───────── 가정 ─────────
export const assumptions = pgTable('assumptions', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  reason: text('reason').notNull(),
  usedIn: text('used_in').notNull(),
  source: text('source').notNull().default('assumption'),
});

// ───────── 운영 ─────────
/** 1행: 가상 기준시각 · 재전망 · 일련번호 · 낙관적 잠금 버전 · 마지막 프리셋 */
export const simState = pgTable('sim_state', {
  id: integer('id').primaryKey(),
  simNow: text('sim_now').notNull(),
  version: integer('version').notNull(),
  preset: text('preset'),
  forecast: jsonb('forecast').notNull(),
  arDueOverrides: jsonb('ar_due_overrides').notNull(),
  seq: jsonb('seq').notNull(),
  proposal: jsonb('proposal'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

const entity = (name: string, extra: Record<string, ReturnType<typeof text>> = {}) =>
  pgTable(name, {
    id: text('id').primaryKey(),
    status: text('status'),
    ord: integer('ord').notNull(),
    ...extra,
    data: jsonb('data').notNull(),
  });

export const contracts = entity('contracts');
export const expansionLines = entity('expansion_lines', { requiredRole: text('required_role'), contractDeadline: text('contract_deadline') });
export const approvalRequests = entity('approval_requests', { subjectType: text('subject_type'), requiredRole: text('required_role'), assessmentId: text('assessment_id'), supersedesId: text('supersedes_id') });
export const approvalReplies = entity('approval_replies', { requestId: text('request_id'), respondentRole: text('respondent_role') });
export const tasks = entity('tasks', { type: text('type'), ownerRole: text('owner_role'), subjectId: text('subject_id'), dueAt: text('due_at') });
export const notices = entity('notices');
export const noticeReceipts = entity('notice_receipts');
export const replenishmentRequests = entity('replenishment_requests', { requiredRole: text('required_role'), triggerLineId: text('trigger_line_id') });
export const assessments = entity('assessments', { subjectType: text('subject_type'), aiMode: text('ai_mode') });

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  ord: integer('ord').notNull(),
  type: text('type').notNull(),
  label: text('label').notNull(),
  simAt: text('sim_at').notNull(),
  createdBy: text('created_by').notNull(),
  payload: jsonb('payload'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  ord: integer('ord').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  actorRole: text('actor_role').notNull(),
  actorKind: text('actor_kind').notNull(),
  ruleIds: jsonb('rule_ids').$type<string[]>().notNull(),
  eventId: text('event_id'),
  reason: text('reason').notNull(),
  /** 가상 기준시각 (A-21) */
  simAt: text('sim_at').notNull(),
  /** 실제 기록 시각 */
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  snapshot: jsonb('snapshot').notNull(),
});
