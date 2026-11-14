/** GET /api/data-registry — S-12 원본 · 가정 · 공백 · 주장 · 모의 · 불일치 */
import { handle } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET() {
  return handle(() => getService().registry());
}
