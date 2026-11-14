/**
 * 배포 시작 단계(마이그레이션 → 시드) 통합 테스트 — TEST_DATABASE_URL 이 있을 때만 실행.
 * 빈 DB 에서 시작해도 되고 이미 마이그레이션된 DB 여도 된다(멱등). 운영 상태를 바꾸므로 전용 테스트 DB 만 쓴다.
 */
import { describe, expect, it } from 'vitest';
import { bootstrap } from '@/server/deploy/bootstrap';
import { getMasil } from '@/server/raw/masil';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('bootstrap (실제 Postgres)', () => {
  const run = () => bootstrap({ url: url!, migrationsFolder: './drizzle/migrations', dataset: () => getMasil().dataset, sessionLock: true });

  it('두 번 실행해도 안전하다 — 마이그레이션 재적용 없음, 두 번째는 상태 유지', async () => {
    const a = await run();
    const b = await run();
    expect(b.seeded).toBe(false);
    expect(b.version).toBe(a.version);
  });

  it('동시에 두 개가 시작해도(복제본 2개) 둘 다 성공하고 초기화는 많아야 한 번', async () => {
    const [a, b] = await Promise.all([run(), run()]);
    expect(a.version).toBe(b.version);
    expect([a.seeded, b.seeded].filter(Boolean).length).toBeLessThanOrEqual(1);
  });
});
