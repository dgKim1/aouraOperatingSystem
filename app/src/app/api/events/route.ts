/** POST /api/events {type, payload} — S-02 사건 입력 (접수 · 조건 변경 · 외부 회신 · 회신 · 시점 이동) */
import { handle, readJson } from '@/server/http';
import { getService } from '@/server/runtime';

export async function POST(req: Request) {
  return handle(async () => getService().postEvent(await readJson(req)), 201);
}
