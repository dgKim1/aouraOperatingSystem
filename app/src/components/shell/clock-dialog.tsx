'use client';
/**
 * 시점 이동 (S-01). 실제 이동(POST /api/clock/advance)은 2단계 API 를 기다린다 — 확인 버튼 비활성.
 * 1단계에서는 시연 프리셋(도메인 재생, 모의)으로 시점을 바꿔 상태 변화를 확인한다.
 */
import { useState, useTransition } from 'react';
import { Clock } from 'lucide-react';
import { setPreset } from '@/app/_actions/session';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface PresetOption {
  id: string;
  title: string;
  description: string;
}

export function ClockDialog({ simNow, presets, currentPreset }: { simNow: string; presets: PresetOption[]; currentPreset: string }) {
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const minLocal = simNow.slice(0, 16);

  function check(v: string) {
    setTo(v);
    // 형식 확인만 (과거 이동 금지는 서버가 409 CLOCK_BACKWARD 로 판정 — 여기서는 안내만)
    setError(v && v < minLocal ? '기준시각 이전으로는 이동할 수 없습니다 (시나리오 초기화로만 처음으로 돌아감)' : null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="h-7">
          <Clock className="size-3.5" aria-hidden /> 시점 이동
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>시점 이동</DialogTitle>
          <DialogDescription>가상 기준시각을 앞으로 옮기면 기한 감시가 자동 갱신 · 자동 확정 · 작업 기한 경과를 처리합니다.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="clock-to">이동할 시각 (KST)</Label>
          <Input id="clock-to" type="datetime-local" min={minLocal} value={to} onChange={(e) => check(e.target.value)} aria-invalid={!!error} aria-describedby="clock-help" />
          {error && (
            <p className="text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
          <p id="clock-help" className="rounded border border-dashed border-zinc-400 bg-zinc-50 p-2 text-xs text-zinc-700">
            지나가는 기한 미리보기와 실제 이동은 백엔드 API(<code>POST /api/clock/advance</code>) 연결 후 활성화됩니다 (1단계).
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">
            시연 프리셋으로 이동 <span className="rounded border border-dashed border-zinc-500 px-1 text-[11px]">모의</span>
          </p>
          <p className="text-xs text-muted-foreground">시나리오 사건을 도메인 규칙으로 재생한 상태를 봅니다. 저장되지 않습니다.</p>
          <ul className="max-h-56 space-y-1 overflow-y-auto">
            {presets.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await setPreset(p.id);
                      setOpen(false);
                    })
                  }
                  className={`w-full rounded border px-2 py-1 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${p.id === currentPreset ? 'border-blue-600 bg-blue-50' : ''}`}
                  aria-current={p.id === currentPreset ? 'true' : undefined}
                >
                  <span className="font-medium">{p.title}</span>
                  <span className="block text-xs text-muted-foreground">{p.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter>
          <Button disabled title="2단계 API 연결 후 활성">
            이동 (API 연결 전)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
