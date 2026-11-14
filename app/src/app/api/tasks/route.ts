/** GET /api/tasks?role=&status= — S-07 작업 */
import { handle } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return handle(() => getService().tasks({ ...(q.get('role') ? { role: q.get('role')! } : {}), ...(q.get('status') ? { status: q.get('status')! } : {}) }));
}
