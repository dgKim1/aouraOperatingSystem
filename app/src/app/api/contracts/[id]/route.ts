/** GET /api/contracts/:id?terminateOn= — S-03 전속계약 상세 */
import { handle, type Params } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET(req: Request, ctx: Params<'id'>) {
  const { id } = await ctx.params;
  return handle(() => getService().contract(id, new URL(req.url).searchParams.get('terminateOn') ?? undefined));
}
