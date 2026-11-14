/** GET /api/analytics/influencers?includeReference=true|false — S-08 (공식값 A05, 참고값은 includeReference 일 때만) */
import { handle } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET(req: Request) {
  return handle(() => getService().influencers(new URL(req.url).searchParams.get('includeReference') === 'true'));
}
