'use client';
/**
 * 시점 이동 (S-01 · FE-02). 날짜 입력 → [미리보기] GET /api/clock/preview (저장 없음) → [이동] POST /api/clock/advance → 서버 재조회.
 * 지나가는 기한 · 생길 전이 · 작업은 서버가 기한 감시를 돌린 결과를 그대로 보여준다 — 화면에서 날짜 비교로 만들지 않는다.
 * 과거로 이동은 서버가 409 CLOCK_BACKWARD 로 거부하고, 그 문구를 그대로 보여준다.
 */
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Clock, Eye } from 'lucide-react';
import type { ClockResponse } from '@/domain/api-types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fmtDateTime } from '../format';
import { callApi, useApiAction, type ApiFailure } from '../mutation/api-client';
import { ApiErrorBox, ResultPanel } from '../mutation/result-panel';

type Preview = ClockResponse & { preview: true; passingDeadlines: { kind: string; id: string; deadline: string }[] };

const KIND_KO: Record<string, string> = { CONTRACT_NOTICE: '계약 통보 기한', LINE_DEADLINE: '기안 확정기한', APPROVAL: '승인요청 원본 기한', TASK: '작업 기한' };

/**
 * 시연 문서(DEMO_SCENARIOS)의 사건 시각 — 입력 편의용 바로가기(계산값 아님). 어느 시연의 시각인지 함께 보인다(FE-14).
 * ① 7/10 14:00 회신 · 7/14 11:00 수령확인 / ② 7/14 10:00 회수 지연 · 7/15 15:00 재승인 / ③ 7/13 16:00 정보 부족 · 7/15 재상신 승인 · 7/16 10:00 통보 · 7/17 09:00 재통보 · 7/17 15:00 수령확인 / 7/18 00:00 기한 경과 / ④ 7/20 09:00
 */
const DEMO_TIMES: { t: string; tag: string }[] = [
  { t: '2026-07-10T14:00', tag: '①③' },
  { t: '2026-07-13T10:00', tag: '①' },
  { t: '2026-07-13T16:00', tag: '③' },
  { t: '2026-07-14T10:00', tag: '②' },
  { t: '2026-07-14T11:00', tag: '①③' },
  { t: '2026-07-15T10:00', tag: '③' },
  { t: '2026-07-15T15:00', tag: '②' },
  { t: '2026-07-16T10:00', tag: '③' },
  { t: '2026-07-17T09:00', tag: '③' },
  { t: '2026-07-17T15:00', tag: '③' },
  { t: '2026-07-18T00:00', tag: '①②③' },
  { t: '2026-07-20T09:00', tag: '④' },
];

const toIso = (local: string) => `${local}:00+09:00`;

export function ClockDialog({ simNow }: { simNow: string }) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<ApiFailure | null>(null);
  const [loading, startPreview] = useTransition();
  const adv = useApiAction<ClockResponse>();
  const nowLocal = simNow.slice(0, 16);

  function choose(v: string) {
    setTo(v);
    setPreview(null);
    setPreviewError(null);
    adv.reset();
  }

  function runPreview() {
    if (!to) return;
    startPreview(async () => {
      const r = await callApi<Preview>(`/api/clock/preview?to=${encodeURIComponent(toIso(to))}`, 'GET');
      if (r.ok) {
        setPreview(r.data);
        setPreviewError(null);
      } else {
        setPreview(null);
        setPreviewError(r);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) choose('');
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="h-7">
          <Clock className="size-3.5" aria-hidden /> 시점 이동
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>시점 이동</DialogTitle>
          <DialogDescription>
            가상 기준시각 {fmtDateTime(simNow)} 을 앞으로 옮기면 기한 감시가 자동 갱신 · 자동 확정 · 작업 기한 경과를 처리합니다. 먼저 미리보기로 무엇이 바뀌는지 확인하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="clock-to">이동할 시각 (KST)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input id="clock-to" type="datetime-local" className="w-56" value={to} onChange={(e) => choose(e.target.value)} />
            <Button size="sm" variant="outline" onClick={runPreview} disabled={!to || loading}>
              <Eye className="size-3.5" aria-hidden /> {loading ? '확인 중…' : '미리보기'}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <span className="text-zinc-600">시연 시각</span>
            {DEMO_TIMES.filter((d) => d.t > nowLocal).map((d) => (
              <button key={d.t} type="button" onClick={() => choose(d.t)} aria-label={`${d.t.replace('T', ' ')} (시연 ${d.tag})`} className="rounded border px-1.5 py-0.5 font-mono hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                {d.t.replace('T', ' ')} <span className="font-sans text-[10px] text-zinc-600">{d.tag}</span>
              </button>
            ))}
          </div>
        </div>

        {previewError && <ApiErrorBox error={previewError} />}

        {preview && !adv.result && (
          <div className="space-y-2 rounded-md border border-sky-300 bg-sky-50/60 p-3 text-sm" role="status" aria-live="polite">
            <p className="font-semibold">미리보기 — 아직 저장되지 않았습니다</p>
            <div>
              <h4 className="text-xs font-semibold">지나가는 기한 ({preview.passingDeadlines.length})</h4>
              {preview.passingDeadlines.length === 0 ? (
                <p className="text-xs text-zinc-600">없음</p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-xs">
                  {preview.passingDeadlines.map((d) => (
                    <li key={`${d.kind}-${d.id}`} className="flex flex-wrap gap-2">
                      <span className="w-32 text-zinc-700">{KIND_KO[d.kind] ?? d.kind}</span>
                      <span className="font-mono">{d.kind === 'LINE_DEADLINE' ? `${d.id} 마감 묶음` : d.id}</span>
                      <span className="font-mono">{d.deadline.length > 10 ? fmtDateTime(d.deadline) : d.deadline}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ResultPanel title="이동하면 생길 처리" result={preview} />
          </div>
        )}

        {adv.error && <ApiErrorBox error={adv.error} />}
        {adv.result && (
          <ResultPanel
            title={`시점 이동 완료 — ${fmtDateTime(adv.result.simNow)}`}
            result={adv.result}
            extra={
              <p className="text-xs">
                화면을 서버에서 다시 조회했습니다. <Link href="/history" className="underline">처리 이력</Link>에서 전체 증거를 볼 수 있습니다.
              </p>
            }
          />
        )}

        <p className="text-xs text-zinc-600">
          처음 상태로 돌아가려면 <Link href="/scenarios" className="underline" onClick={() => setOpen(false)}>시연 시나리오</Link>에서 초기화 후 재생합니다 (과거로 이동 불가).
        </p>

        <DialogFooter>
          {adv.result ? (
            <Button onClick={() => setOpen(false)}>닫기</Button>
          ) : (
            <Button onClick={() => adv.run('/api/clock/advance', 'POST', { to: toIso(to) })} disabled={!preview || adv.pending} title={preview ? undefined : '먼저 미리보기를 확인하세요'}>
              {adv.pending ? '이동 중…' : preview ? `${to.replace('T', ' ')} 으로 이동` : '이동 (미리보기 후)'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
