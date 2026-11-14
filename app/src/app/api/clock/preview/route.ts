/** GET /api/clock/preview?to= — 저장 없이 시점 이동 결과 미리보기 (지나갈 기한 · 전이 · 생길 작업, BE-07) */
import { handle } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET(req: Request) {
  return handle(() => getService().clockPreview(new URL(req.url).searchParams.get('to') ?? ''));
}
