/** POST /api/replenishment-requests {triggerLineId, skuIds?} — 보충요청 초안 + SCM 검토 · 정보 요청 작업 */
import { handle, readJson } from '@/server/http';
import { getService } from '@/server/runtime';

export async function POST(req: Request) {
  return handle(async () => getService().createReplenishment(await readJson(req)), 201);
}
