/** POST /api/scenarios/:id/reset — 운영 상태 초기화 후 프리셋 시작 지점까지 재생 (원본 적재 테이블은 그대로) */
import { handle, type Params } from '@/server/http';
import { getService } from '@/server/runtime';

export async function POST(_req: Request, ctx: Params<'id'>) {
  const { id } = await ctx.params;
  return handle(() => getService().resetScenario(id));
}
