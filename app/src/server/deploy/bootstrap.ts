/**
 * 배포 시작 단계 (BE-14) — 서버를 띄우기 전에 한 번 실행한다. 실패하면 호출한 쪽이 0 이 아닌 코드로 끝낸다.
 *   1) 마이그레이션 적용 (Drizzle 이 적용 이력을 기록하므로 여러 번 실행해도 안전)
 *   2) 운영 상태가 비어 있으면 원본으로 만든 초기 상태를 SEED 로 저장, 이미 있으면 그대로 둔다
 *      (재시작 · 재배포가 진행 중인 시연 상태 · 처리 이력을 지우지 않는다)
 * 접속은 세션 단위 주소(DIRECT_DATABASE_URL)로 한다 — 연결 1개를 잡고 advisory lock 으로 동시 시작(복제본 여러 개)을 줄 세운다.
 * 트랜잭션 단위 중계기(DATABASE_URL)에서는 세션 잠금이 유지되지 않는다(axhub 데이터베이스 문서) — 그 주소로 대신 실행할 때는 잠금 없이 돈다
 * (동시에 시작하면 늦은 쪽의 시드 저장이 기본 키 충돌로 실패하고, 다시 시작하면 '기존 유지'로 통과한다).
 * 원본 CSV 를 DB(raw_rows)에 적재하지 않는다 — 런타임은 RAW_DATA_DIR 의 파일을 직접 읽는다(rawSource: FILES).
 * 접속 문자열은 인자로만 받고 출력하지 않는다.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { MasilDataset } from '@/domain/dataset';
import * as wf from '@/domain/workflow';
import * as schema from '../db/schema';
import { PgStore } from '../store/pg';
import type { WorldStore } from '../store/types';

export interface SeedResult {
  /** true = 이번 실행이 SEED 로 초기화함, false = 기존 상태 유지 */
  seeded: boolean;
  version: number;
}

/** 운영 상태가 비어 있을 때만 SEED 로 초기화한다. 상태가 있으면 원본도 읽지 않는다 */
export async function ensureSeed(store: WorldStore, dataset: () => MasilDataset): Promise<SeedResult> {
  const got = await store.read();
  if (got) return { seeded: false, version: got.version };
  const version = await store.replace(wf.initialState(dataset()), 'SEED');
  return { seeded: true, version };
}

/** 이 앱 전용 잠금 번호 (임의 고정값 — 같은 DB 안에서 시작 단계끼리만 겹치면 된다) */
const BOOTSTRAP_LOCK = 20261114;

export interface BootstrapOptions {
  url: string;
  migrationsFolder: string;
  dataset: () => MasilDataset;
  /**
   * 세션 잠금으로 동시 시작을 줄 세울지. url 이 세션 단위 주소(DIRECT_DATABASE_URL · 로컬 Postgres)일 때만 true 로 준다.
   * 트랜잭션 단위 중계기 주소에 세션 잠금을 걸면 잠금이 중계기의 서버 연결에 남을 수 있어 쓰지 않는다.
   */
  sessionLock: boolean;
}

export async function bootstrap(opts: BootstrapOptions): Promise<SeedResult> {
  // max 1: 잠금 · 마이그레이션 · 시드가 모두 같은 세션에서 돈다
  const pool = new Pool({ connectionString: opts.url, max: 1 });
  try {
    if (opts.sessionLock) await pool.query('select pg_advisory_lock($1)', [BOOTSTRAP_LOCK]);
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: opts.migrationsFolder });
    return await ensureSeed(new PgStore(db), opts.dataset);
  } finally {
    // 세션이 끝나면 잠금도 풀린다
    await pool.end();
  }
}
