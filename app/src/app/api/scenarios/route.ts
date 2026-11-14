/** GET /api/scenarios — S-13 시연 프리셋 목록 */
import { handle } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET() {
  return handle(() => getService().scenarios());
}
