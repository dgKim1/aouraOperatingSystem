'use client';
/**
 * 결과 보관함 — 행동한 행이 서버 재조회 뒤 사라지는 경우(예: 완료된 작업이 「열린 작업」 표에서 빠짐)에도
 * 결과 패널(UI-05)이 남도록, 마지막 결과를 화면 위쪽에 고정해 보여준다. 같은 화면(경로)에서만 보인다.
 */
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import type { MutationResult } from '@/domain/api-types';
import { ResultPanel } from './result-panel';

type Entry = { id: number; title: string; result: MutationResult; path: string };
let current: Entry | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function publishResult(title: string, result: MutationResult) {
  current = { id: ++seq, title, result, path: typeof window === 'undefined' ? '' : window.location.pathname };
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function ResultDock() {
  const entry = useSyncExternalStore(subscribe, () => current, () => null);
  const path = usePathname();
  if (!entry || entry.path !== path) return null;
  return (
    <div className="mb-4">
      <ResultPanel
        key={entry.id}
        title={entry.title}
        result={entry.result}
        onClose={() => {
          current = null;
          emit();
        }}
      />
    </div>
  );
}
