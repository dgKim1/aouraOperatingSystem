/**
 * route handler 공통 — 오류를 SCREEN_SPEC 4절 형식 {error:{code,message,details}} 와 HTTP 상태로 바꾼다.
 * DomainError: FORBIDDEN_ROLE · VALIDATION · INFO_MISSING → 422, INVALID_TRANSITION · CLOCK_BACKWARD · CONFLICT → 409, NOT_FOUND → 404.
 * 그 밖의 오류는 500 (내부 메시지 · 비밀값을 응답에 넣지 않는다).
 */
import { DomainError } from '@/domain/errors';

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

export function errorResponse(e: unknown): Response {
  if (e instanceof DomainError) return json({ error: { code: e.code, message: e.message, ...(e.details !== undefined ? { details: e.details } : {}) } }, e.httpStatus);
  console.error('[api] 처리 실패', e instanceof Error ? e.name : typeof e);
  return json({ error: { code: 'INTERNAL', message: '서버 처리 중 오류가 발생했습니다' } }, 500);
}

export async function handle(fn: () => Promise<unknown> | unknown, status = 200): Promise<Response> {
  try {
    return json(await fn(), status);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainError('VALIDATION', '요청 본문이 JSON 이 아님');
  }
}

export type Params<K extends string> = { params: Promise<Record<K, string>> };
