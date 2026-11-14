/** POST /api/clock/advance {to} — 시점 이동(기한 감시 실행). 과거 시각이면 409 CLOCK_BACKWARD (BE-07) */
import { handle, readJson } from '@/server/http';
import { getService } from '@/server/runtime';

export async function POST(req: Request) {
  return handle(async () => {
    const b = (await readJson(req)) as { to?: string };
    return getService().advanceClock(b.to ?? '');
  });
}
