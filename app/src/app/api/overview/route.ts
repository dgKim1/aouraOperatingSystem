/** GET /api/overview — S-01 운영 현황 (타임라인 · 하회 구간 · 결정 대기 · 경고 · 계약 · 작업 · 최근 이력) */
import { handle } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET() {
  return handle(() => getService().overview());
}
