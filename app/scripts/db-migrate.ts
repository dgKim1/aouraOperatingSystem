/** 마이그레이션 적용 — `npm run db:migrate` (DATABASE_URL 필요) */
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { closeDb, getDb } from '../src/server/db/client';

const db = getDb();
if (!db) {
  console.error('DATABASE_URL 이 없습니다');
  process.exit(1);
}
await migrate(db, { migrationsFolder: './drizzle/migrations' });
console.log('마이그레이션 적용 완료');
await closeDb();
