/** POST /api/approval-requests {assessmentId} — 판단안 → 승인요청(권한자별 묶음, 권한자는 규칙 엔진). GET ?role=&status= — 승인함 */
import { handle, readJson } from '@/server/http';
import { getService } from '@/server/runtime';

export async function POST(req: Request) {
  return handle(async () => getService().createApprovalRequests(await readJson(req)), 201);
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return handle(() => getService().approvals({ ...(q.get('role') ? { role: q.get('role')! } : {}), ...(q.get('status') ? { status: q.get('status')! } : {}) }));
}
