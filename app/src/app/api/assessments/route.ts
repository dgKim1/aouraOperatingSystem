/** POST /api/assessments {subjectType, subjectIds} — 판단안 만들기 (AI 실시간 또는 모의). GET ?subjectId= — 목록 */
import { handle, readJson } from '@/server/http';
import { getService } from '@/server/runtime';

export async function POST(req: Request) {
  return handle(async () => getService().createAssessment(await readJson(req)), 201);
}

export async function GET(req: Request) {
  const subjectId = new URL(req.url).searchParams.get('subjectId') ?? undefined;
  return handle(() => getService().assessments(subjectId ? { subjectId } : {}));
}
