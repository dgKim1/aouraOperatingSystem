/** POST /api/approval-requests/:id/replies — 권한자 모의 회신. requiredRole 이 아니면 422 FORBIDDEN_ROLE, 이미 처리된 요청은 409 */
import { handle, readJson, type Params } from '@/server/http';
import { getService } from '@/server/runtime';

export async function POST(req: Request, ctx: Params<'id'>) {
  const { id } = await ctx.params;
  return handle(async () => getService().reply(id, await readJson(req)), 201);
}
