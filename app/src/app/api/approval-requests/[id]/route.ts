/** GET /api/approval-requests/:id — S-06 승인 요청 상세 */
import { handle, type Params } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET(_req: Request, ctx: Params<'id'>) {
  const { id } = await ctx.params;
  return handle(() => getService().approval(id));
}
