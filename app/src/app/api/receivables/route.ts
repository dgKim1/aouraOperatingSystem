/** GET /api/receivables — 회수 지연 양식(S-02)용 AR 목록: ID · 원본/현재 만기 · 금액 · 미회수 · 재전망 포함 여부 · 출처 파일/행 */
import { handle } from '@/server/http';
import { getService } from '@/server/runtime';

export async function GET() {
  return handle(() => getService().receivables());
}
