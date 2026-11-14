/**
 * 컨테이너 시작 단계 실행 파일 (BE-14) — 마이그레이션 → 비어 있으면 SEED. start.sh 가 서버 기동 전에 부른다.
 * 이미지에서는 esbuild 로 묶은 단일 파일(bootstrap.cjs)로 실행한다(`npm run build:deploy`) — 런타임 이미지에 tsx · devDependencies 를 넣지 않는다.
 * 로컬 확인: `DIRECT_DATABASE_URL=… npx tsx scripts/deploy/bootstrap.ts` (app/ 에서)
 *
 * 환경변수 (값은 출력하지 않는다):
 *   DIRECT_DATABASE_URL — 세션 단위 주소(마이그레이션 · 잠금용). 없으면 DATABASE_URL 로 대신하되 세션 잠금은 걸지 않는다
 *   MIGRATIONS_DIR      — 마이그레이션 폴더 (기본: 실행 위치의 drizzle/migrations)
 *   RAW_DATA_DIR        — 원본 CSV 폴더 (시드를 만들 때만 읽는다)
 * 실패하면 원인 종류만 남기고 종료 코드 1 — 오류 메시지 본문은 접속 정보를 담을 수 있어 출력하지 않는다.
 */
import path from 'node:path';
import { bootstrap } from '../../src/server/deploy/bootstrap';
import { rawAvailable } from '../../src/server/raw/loader';
import { getMasil } from '../../src/server/raw/masil';

async function main(): Promise<number> {
  const direct = process.env.DIRECT_DATABASE_URL;
  const url = direct || process.env.DATABASE_URL;
  if (!url) {
    console.error('[bootstrap] DIRECT_DATABASE_URL · DATABASE_URL 이 없습니다');
    return 1;
  }
  if (!rawAvailable()) {
    console.error('[bootstrap] 원본 CSV 를 찾을 수 없습니다 (RAW_DATA_DIR 확인)');
    return 1;
  }
  const migrationsFolder = process.env.MIGRATIONS_DIR || path.join(process.cwd(), 'drizzle', 'migrations');
  const t0 = Date.now();
  try {
    const r = await bootstrap({ url, migrationsFolder, dataset: () => getMasil().dataset, sessionLock: !!direct });
    console.log(`[bootstrap] 마이그레이션 적용 확인 · 운영 상태 ${r.seeded ? 'SEED 로 초기화' : '기존 유지'} (stateVersion ${r.version}, ${Date.now() - t0}ms)`);
    return 0;
  } catch (e) {
    const code = typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'string' ? e.code : '-';
    console.error(`[bootstrap] 실패 — 종류 ${e instanceof Error ? e.name : typeof e}, 코드 ${code}`);
    return 1;
  }
}

main().then((code) => process.exit(code));
