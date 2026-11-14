/** PATCH /api/tasks/:id {status, resultNote?, payload?} — 시작 · 완료 · 취소 (완료가 다른 엔티티 전이를 일으킬 수 있음) */
import { handle, readJson, type Params } from '@/server/http';
import { getService } from '@/server/runtime';

export async function PATCH(req: Request, ctx: Params<'id'>) {
  const { id } = await ctx.params;
  return handle(async () => getService().patchTask(id, await readJson(req)));
}
