/**
 * 원본 CSV → DB raw_files · raw_rows (+ assumptions) 적재 — `npm run db:load-raw` (DATABASE_URL 필요).
 * 원본 파일은 읽기만 한다. 다시 실행하면 같은 파일의 행을 지우고 다시 넣는다(멱등).
 */
import { closeDb, getDb } from '../src/server/db/client';
import { saveRawToDb } from '../src/server/db/raw';
import { rawRoot } from '../src/server/raw/loader';
import { loadMasil } from '../src/server/raw/masil';

const db = getDb();
if (!db) {
  console.error('DATABASE_URL 이 없습니다');
  process.exit(1);
}
const { tables } = loadMasil();
const r = await saveRawToDb(db, tables);
console.log(`원본 적재 완료: ${r.files}개 파일 · ${r.rows}행 (출처 ${rawRoot()})`);
await closeDb();
