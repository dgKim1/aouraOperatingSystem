/** GET /api/audit?entityType=&entityId=&actorKind= — S-11 처리 이력 (최신순) */
import { handle } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const f = Object.fromEntries(['entityType', 'entityId', 'actorKind'].flatMap((k) => (q.get(k) ? [[k, q.get(k)!]] : [])));
  return handle(() => getService().audit(f));
}
