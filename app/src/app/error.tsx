'use client';
/** 오류 — 숫자를 캐시로 대신 보여주지 않는다 (S-01 오류 규칙). 재시도만 제공 */
import { Button } from '@/components/ui/button';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-6 text-sm" role="alert">
      <p className="font-semibold text-red-900">데이터를 불러오지 못했습니다</p>
      <p className="mt-1 text-red-800">{error.message}</p>
      <p className="mt-1 text-xs text-zinc-700">이전 값을 대신 보여주지 않습니다. 다시 시도하세요.</p>
      <Button size="sm" className="mt-3" onClick={reset}>재시도</Button>
    </div>
  );
}
