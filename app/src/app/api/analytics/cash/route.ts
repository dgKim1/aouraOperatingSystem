/** GET /api/analytics/cash?version=v1|current&sensitivity=true — S-10 재전망 · 공식 전망(주장) 대조 (BE-10) */
import { handle } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  return handle(() => getService().cash({ sensitivity: q.get('sensitivity') === 'true', ...(q.get('version') ? { version: q.get('version')! } : {}) }));
}
