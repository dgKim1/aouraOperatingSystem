/** Postgres 연결 — 환경변수 DATABASE_URL 로만 (값은 코드 · 로그에 쓰지 않는다). 없으면 null → 메모리 저장소 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

let pool: Pool | null = null;
let db: Db | null = null;

export function databaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getDb(): Db | null {
  if (!process.env.DATABASE_URL) return null;
  if (!db) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    db = drizzle(pool, { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = null;
  db = null;
}
