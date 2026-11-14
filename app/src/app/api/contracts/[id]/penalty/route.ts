/** GET /api/contracts/:id/penalty?terminateOn=YYYY-MM-DD — R-PEN-01 위약금 (갱신 상태가 아니면 0, applies=false) */
import { handle, type Params } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET(req: Request, ctx: Params<'id'>) {
  const { id } = await ctx.params;
  return handle(() => getService().penalty(id, new URL(req.url).searchParams.get('terminateOn')));
}
