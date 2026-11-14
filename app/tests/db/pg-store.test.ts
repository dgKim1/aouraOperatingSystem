/**
 * Postgres 저장소 통합 테스트 — TEST_DATABASE_URL 이 있을 때만 실행 (기본 npm run check 는 DB 없이 건너뜀).
 * 실행: TEST_DATABASE_URL=postgres://localhost:5432/aoura_dev npx vitest run tests/db  (마이그레이션 · 원본 적재 선행)
 */
import { afterAll, describe, expect, it } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/server/db/schema';
import { loadRawFromDb } from '@/server/db/raw';
import { fromTables, getMasil } from '@/server/raw/masil';
import { PgStore } from '@/server/store/pg';
import { buildPreset } from '@/server/scenarios';
import * as wf from '@/domain/workflow';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('PgStore (실제 Postgres)', () => {
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });
  const store = new PgStore(db);
  const ds = getMasil().dataset;
  afterAll(() => pool.end());

  it('DB 의 원본(raw_rows)으로 만든 데이터셋 = 파일에서 읽은 데이터셋 (출처 src_file · src_row 보존)', async () => {
    const tables = await loadRawFromDb(db);
    expect(tables).not.toBeNull();
    expect(fromTables(tables!).dataset).toEqual(ds);
    expect(tables!.orders.rows[0]).toMatchObject({ src_file: '02_masil/marketing/mkt_orders_ms.csv', src_row: 1 });
  });

  it('프리셋 저장 → 읽기 왕복 = 같은 상태, 쓰기는 버전 + 1, 낡은 버전은 409', async () => {
    const s = buildPreset('S2', ds);
    const v = await store.replace(s, 'S2');
    const got = await store.read();
    expect(got!.state).toEqual(s);
    const next = wf.advanceClock(s, '2026-07-15T09:00:00+09:00').state;
    const v2 = await store.write(next, { expectedVersion: v, prev: s });
    expect(v2).toBe(v + 1);
    expect((await store.read())!.state).toEqual(next);
    await expect(store.write(next, { expectedVersion: v, prev: s })).rejects.toMatchObject({ code: 'CONFLICT', httpStatus: 409 });
  });
});
