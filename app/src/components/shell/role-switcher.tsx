'use client';
/** 역할 전환 (시연용) — 쿠키만 바꾸고 서버에서 다시 그린다. 승인 버튼 활성 여부는 이 역할로 정해진다. */
import { useTransition } from 'react';
import { setRole } from '@/app/_actions/session';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function RoleSwitcher({ roles, current }: { roles: { id: string; label: string }[]; current: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <span id="role-label" className="text-xs text-zinc-300">
        현재 역할
      </span>
      <Select value={current} onValueChange={(v) => start(() => setRole(v))} disabled={pending}>
        <SelectTrigger size="sm" aria-labelledby="role-label" className="min-w-40 border-zinc-600 bg-zinc-800 text-white">
          <SelectValue>{roles.find((r) => r.id === current)?.label ?? current}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {roles.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {pending && <span className="text-xs text-zinc-300" role="status">전환 중…</span>}
    </div>
  );
}
