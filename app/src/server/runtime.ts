/**
 * 서비스 싱글턴 조립 — 환경변수만 읽는다(값은 출력하지 않음).
 *   DATABASE_URL 있음 → PgStore, 없음 → MemoryStore (meta.persistence 로 표시)
 *   ANTHROPIC_API_KEY 있음 · AOURA_AI_MODE≠mock → 실시간 판단안, 아니면 모의 (meta.aiMode)
 *   원본: RAW_DATA_DIR 또는 ../01_참가자_배포용/04_원본데이터 파일, 없으면 DB raw_rows
 */
import 'server-only';
import type { MasilFileKey } from '@/domain/files';
import { aiConfigured, liveClientFromEnv } from './ai/client';
import { createAssessor } from './ai/assessor';
import { getDb } from './db/client';
import { loadRawFromDb } from './db/raw';
import { fromTables, getMasil, hasMasil, setMasil, type LoadedMasil } from './raw/masil';
import { rawAvailable } from './raw/loader';
import { AouraService, type DatasetSource } from './service';
import { MemoryStore } from './store/memory';
import { PgStore } from './store/pg';

let source: 'FILES' | 'DB' = 'FILES';

async function loadData(): Promise<DatasetSource> {
  if (!hasMasil()) {
    if (rawAvailable()) {
      getMasil();
      source = 'FILES';
    } else {
      const db = getDb();
      const tables = db ? await loadRawFromDb(db) : null;
      if (!tables) throw new Error('원본 데이터를 찾을 수 없음 — RAW_DATA_DIR 를 지정하거나 DB 에 원본을 적재하세요 (npm run db:load-raw)');
      setMasil(fromTables(tables));
      source = 'DB';
    }
  }
  const m: LoadedMasil = getMasil();
  const rowCounts = Object.fromEntries(Object.entries(m.tables).map(([k, v]) => [k, v.rows.length])) as Record<MasilFileKey, number>;
  return { dataset: m.dataset, rowCounts, source };
}

let svc: AouraService | null = null;

export function getService(): AouraService {
  if (!svc) {
    const db = getDb();
    svc = new AouraService({
      store: db ? new PgStore(db) : new MemoryStore(),
      data: loadData,
      assessor: createAssessor(liveClientFromEnv(), { effort: 'medium' }),
      aiMode: aiConfigured() ? 'LIVE' : 'MOCK',
    });
  }
  return svc;
}

/** 테스트 전용 — 메모리 저장소 · 모의 클라이언트로 만든 서비스를 route 에 끼운다 */
export function setServiceForTests(s: AouraService | null): void {
  svc = s;
}
