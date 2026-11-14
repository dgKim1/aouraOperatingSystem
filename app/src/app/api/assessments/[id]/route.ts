/** GET /api/assessments/:id — S-05 판단안 (+ 도구 호출 · 숫자 출처 검증 결과) */
import { handle, type Params } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET(_req: Request, ctx: Params<'id'>) {
  const { id } = await ctx.params;
  return handle(() => getService().assessment(id));
}
