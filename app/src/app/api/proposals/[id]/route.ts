/** GET /api/proposals/:id?deadline=&role=&grade=&status=&flag=&approval= — S-04 확대 기안 */
import { handle, type Params } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET(req: Request, ctx: Params<'id'>) {
  const { id } = await ctx.params;
  const q = new URL(req.url).searchParams;
  const f = Object.fromEntries(['deadline', 'role', 'grade', 'status', 'flag', 'approval'].flatMap((k) => (q.get(k) ? [[k, q.get(k)!]] : [])));
  return handle(() => getService().proposal(id, f));
}
