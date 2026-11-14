'use client';
/**
 * 상태 변경 API 호출 (클라이언트). 응답을 그대로 돌려준다 — 오류는 {status, code, message} 를 바꾸지 않고 화면에 보인다(UI-04).
 * 성공하면 router.refresh() 로 서버 컴포넌트를 다시 조회한다(UI-05). 화면에서 결과를 계산하지 않는다.
 */
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export type ApiFailure = { ok: false; status: number; code: string; message: string; details?: unknown };
export type ApiResult<T> = { ok: true; status: number; data: T } | ApiFailure;

export async function callApi<T>(path: string, method: 'GET' | 'POST' | 'PATCH', body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 0, code: 'NETWORK', message: '서버에 연결하지 못했습니다 — 다시 시도하세요' };
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (res.ok) return { ok: true, status: res.status, data: json as T };
  const err = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
  return { ok: false, status: res.status, code: err?.code ?? 'HTTP', message: err?.message ?? `요청 실패 (HTTP ${res.status})`, ...(err?.details !== undefined ? { details: err.details } : {}) };
}

/** 변경 호출 + 성공 시 서버 재조회. 마지막 결과 · 오류를 보관해 결과 패널에 넘긴다 */
export function useApiAction<T>() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<ApiFailure | null>(null);

  function run(path: string, method: 'POST' | 'PATCH', body?: unknown, onOk?: (data: T) => void) {
    setError(null);
    start(async () => {
      const r = await callApi<T>(path, method, body);
      if (r.ok) {
        setResult(r.data);
        onOk?.(r.data);
        router.refresh();
      } else {
        setResult(null);
        setError(r);
      }
    });
  }

  return { run, pending, result, error, reset: () => (setResult(null), setError(null)) };
}
