/** GET /api/assessments/recorded — 기록된 실제 Claude 실행(RECORDED) 재생. AI 를 호출하지 않고 운영 상태도 읽거나 바꾸지 않는다 */
import { handle } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET() {
  return handle(() => getService().recordedRuns());
}
