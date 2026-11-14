/** API 테스트 도우미 — 실제 DB · 실제 Claude 없이 route handler 를 직접 부른다 (메모리 저장소 + 모의/가짜 판단안) */
import { getMasil } from '@/server/raw/masil';
import { createAssessor, mockAssessor, type Assessor } from '@/server/ai/assessor';
import type { MessagesClient } from '@/server/ai/client';
import { AouraService } from '@/server/service';
import { MemoryStore } from '@/server/store/memory';
import { setServiceForTests } from '@/server/runtime';
import type { MasilFileKey } from '@/domain/files';

export function makeService(opts: { assessor?: Assessor; client?: MessagesClient } = {}): AouraService {
  const m = getMasil();
  const rowCounts = Object.fromEntries(Object.entries(m.tables).map(([k, v]) => [k, v.rows.length])) as Record<MasilFileKey, number>;
  const svc = new AouraService({
    store: new MemoryStore(),
    data: async () => ({ dataset: m.dataset, rowCounts, source: 'FILES' }),
    assessor: opts.assessor ?? (opts.client ? createAssessor(opts.client) : mockAssessor),
    aiMode: opts.client ? 'LIVE' : 'MOCK',
  });
  setServiceForTests(svc);
  return svc;
}

export const ctx = <K extends string>(p: Record<K, string>) => ({ params: Promise.resolve(p) });
export const req = (url: string, method = 'GET', body?: unknown) =>
  new Request(`http://local${url}`, { method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) });
export async function call<T = unknown>(res: Promise<Response> | Response): Promise<{ status: number; body: T }> {
  const r = await res;
  return { status: r.status, body: (await r.json()) as T };
}
