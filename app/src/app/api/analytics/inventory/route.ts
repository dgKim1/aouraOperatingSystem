/** GET /api/analytics/inventory — S-09 재고 커버 · 보충 제안 */
import { handle } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET() {
  return handle(() => getService().inventory());
}
