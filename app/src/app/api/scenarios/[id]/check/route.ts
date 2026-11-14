/** GET /api/scenarios/:id/check — 프리셋 기대 결과와 현재 상태 비교 */
import { handle, type Params } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET(_req: Request, ctx: Params<'id'>) {
  const { id } = await ctx.params;
  return handle(() => getService().scenarioCheck(id));
}
