/** 공통 상단 — W02 업무 번호(UI-09) · 가상 기준시각 · 시점 이동 · AI 모드(UI-06) · 역할 전환 */
import { Info } from 'lucide-react';
import type { MetaView } from '@/domain/api-types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { fmtDateTime } from '../format';
import { ClockDialog } from './clock-dialog';
import { RoleSwitcher } from './role-switcher';

export function AppHeader({ meta, roles, roleId }: { meta: MetaView; roles: { id: string; label: string }[]; roleId: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-700 bg-zinc-900 text-white">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="rounded bg-white px-1.5 py-0.5 text-sm font-bold text-zinc-900" aria-label="업무 번호 W02">
            {meta.workId}
          </span>
          <h1 className="text-base font-semibold">인플루언서 계약과 캠페인 집행</h1>
          <span className="text-xs text-zinc-400">Masil · 마케팅 · Aoura 운영 시스템</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-300">가상 기준시각</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 font-mono text-sm tabular-nums focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
                {fmtDateTime(meta.simNow)}
                <Info className="size-3.5 text-zinc-400" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent>시연용 가상 시각입니다 — 실제 오늘 날짜와 다릅니다. 기한 판정은 이 시각 기준 (가정 A-21).</TooltipContent>
          </Tooltip>
          <span className="inline-flex h-5 items-center rounded border border-orange-300 bg-orange-50 px-1.5 text-[11px] font-medium text-orange-800">가정 A-21</span>
          <ClockDialog simNow={meta.simNow} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-300">AI</span>
          {meta.aiMode === 'MOCK' ? (
            <span className="inline-flex h-6 items-center rounded border border-dashed border-white px-2 text-xs font-semibold" title="AI 키 없음 또는 강제 모의 — 판단안 문장은 모의. 실시간 호출이 실패한 판단안도 판단안 화면에 모의로 표시">
              AI: 모의
            </span>
          ) : (
            <span className="inline-flex h-6 items-center rounded bg-emerald-600 px-2 text-xs font-semibold">AI: 실시간 · {meta.model}</span>
          )}
        </div>
        <div className="ml-auto">
          <RoleSwitcher roles={roles} current={roleId} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-700 bg-zinc-800 px-4 py-1 text-xs text-zinc-200" role="note">
        <span>
          운영 상태 저장소 <strong>{meta.persistence === 'POSTGRES' ? 'PostgreSQL' : '메모리 (재시작 시 초기화)'}</strong> · 원본 <strong>{meta.rawSource === 'DB' ? 'DB 적재본' : '원본 파일'}</strong> · 상태 버전 {meta.stateVersion}
        </span>
        <span>
          시연 지점 <strong>{meta.preset ? meta.preset.title : '—'}</strong>
          {meta.preset && <span className="text-zinc-400"> (이후 입력한 사건 포함)</span>}
        </span>
        <span>재전망 {meta.cashForecastVersion}</span>
      </div>
    </header>
  );
}
