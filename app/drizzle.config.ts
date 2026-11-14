/** drizzle-kit 설정 — 스키마 src/server/db/schema.ts, 마이그레이션 drizzle/migrations. 접속은 DATABASE_URL (값은 커밋하지 않음) */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle/migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
