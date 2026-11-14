/**
 * GET /api/healthz — 배포 상태 확인 (axhub.yaml runtime.health_path).
 * 상태 확인 요청은 로그인 정보 없이 오고 3초 안에 200 을 받아야 한다(axhub 배포 준비 1-3).
 * 그래서 DB · 원본 · 서비스 · AI 를 부르지 않고, 환경 정보(접속 주소 · 키 · 모드)도 싣지 않는다.
 * DB 까지 포함한 동작 확인은 GET /api/meta 로 한다.
 */
import type { HealthView } from '@/domain/api-types';

export const dynamic = 'force-dynamic';

export function GET(): Response {
  const body: HealthView = { status: 'ok' };
  return Response.json(body, { headers: { 'cache-control': 'no-store' } });
}
