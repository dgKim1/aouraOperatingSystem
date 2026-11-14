'use client';
/**
 * 결과 보관함 — 행동한 행이 서버 재조회 뒤 사라지는 경우(예: 완료된 작업이 「열린 작업」 표에서 빠짐)에도
 * 결과 패널(UI-05)이 남도록, 마지막 결과를 화면 위쪽에 고정해 보여준다. 같은 화면(경로)에서만 보인다.
 *
 * 같은 탭에서 문서가 새로 로드돼도(새로고침 · 전체 이동) 마지막 결과가 남도록 sessionStorage 에도 둔다.
 * 새로 로드해 되살린 결과는 서버의 현재 상태 버전이 그 결과의 상태 버전과 같을 때만 보인다 —
 * 그 뒤 다른 쓰기 · 초기화가 있었다면 지난 결과이므로 보이지 않고 지운다(받은 값만 비교, 화면 계산 없음).
 */
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { MutationResult } from '@/domain/api-types';
import { ResultPanel } from './result-panel';

type Entry = { id: number; title: string; result: MutationResult; path: string; restored?: boolean };
const KEY = 'aoura:last-result';
let current: Entry | null = null;
let seq = 0;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function save(e: Entry | null) {
  try {
    if (e) window.sessionStorage.setItem(KEY, JSON.stringify({ title: e.title, result: e.result, path: e.path }));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // 저장소를 못 쓰는 환경(비공개 모드 · 용량 초과) — 메모리 보관만으로 동작한다
  }
}

function load(): Entry | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Entry> | null;
    if (!v || typeof v.title !== 'string' || typeof v.path !== 'string') return null;
    const r = v.result;
    if (!r || typeof r.stateVersion !== 'number' || !r.summary || !Array.isArray(r.transitions)) return null;
    return { id: ++seq, title: v.title, result: r, path: v.path, restored: true };
  } catch {
    return null;
  }
}

function clear() {
  current = null;
  save(null);
  emit();
}

export function publishResult(title: string, result: MutationResult) {
  if (typeof window === 'undefined') return;
  loaded = true;
  current = { id: ++seq, title, result, path: window.location.pathname };
  save(current);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): Entry | null {
  if (!loaded) {
    loaded = true;
    current = load();
  }
  return current;
}

export function ResultDock({ stateVersion }: { stateVersion: number }) {
  const entry = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const path = usePathname();
  // 되살린 결과인데 그 뒤 상태가 더 바뀌었으면(다른 쓰기 · 초기화) 지난 결과다
  const stale = !!entry?.restored && entry.result.stateVersion !== stateVersion;
  useEffect(() => {
    if (stale) clear();
  }, [stale]);
  // 방금 한 행동의 결과가 화면 밖(긴 화면 아래쪽에서 행동)이면 보이는 곳으로 옮긴다. 되살린 결과는 옮기지 않는다
  const box = useRef<HTMLDivElement>(null);
  const shown = !!entry && !stale && entry.path === path;
  const freshId = shown && !entry.restored ? entry.id : 0;
  useEffect(() => {
    if (freshId) box.current?.scrollIntoView({ block: 'nearest' });
  }, [freshId]);
  if (!entry || !shown) return null;
  return (
    <div ref={box} className="mb-4 scroll-mt-28">
      <ResultPanel key={entry.id} title={entry.title} result={entry.result} onClose={clear} />
    </div>
  );
}
