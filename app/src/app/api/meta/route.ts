/** GET /api/meta — 헤더: 업무 W02 · 가상 기준시각 · AI 모드 · 재전망 버전 · 저장소 */
import { handle } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET() {
  return handle(() => getService().meta());
}
