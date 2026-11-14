'use client';
import { useTransition } from 'react';
import { setPreset } from '../_actions/session';
import { Button } from '@/components/ui/button';

export function PresetButton({ id, current }: { id: string; current: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant={current ? 'default' : 'outline'} disabled={pending || current} onClick={() => start(() => setPreset(id))} aria-pressed={current}>
      {current ? '현재 상태' : pending ? '이동 중…' : '이 지점으로 (모의)'}
    </Button>
  );
}
