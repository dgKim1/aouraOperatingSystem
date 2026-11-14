/** 배지 범례 — 화면 하단 고정 (SCREEN_SPEC 0-1) */
import type { SourceLabel } from '@/domain/types';
import { SourceBadgeStatic } from '../badges/source-badge';
import { ScaleBadge } from '../badges/scale-badge';

const LABELS: { l: SourceLabel; d: string }[] = [
  { l: 'ORIGINAL', d: '원본 파일 그대로' },
  { l: 'AGGREGATED', d: '원본을 코드로 계산' },
  { l: 'INTERPRETED', d: '원본 문구 근거 해석' },
  { l: 'ASSUMPTION', d: '원본에 없어 정한 값' },
  { l: 'CLAIM', d: '회의록 · 전망 · 예상 GMV' },
  { l: 'MOCK', d: '모의 회신 · 사건 · AI' },
];

export function Legend() {
  return (
    <footer className="sticky bottom-0 z-20 border-t bg-white/95 px-4 py-1.5 backdrop-blur" aria-label="배지 범례">
      <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-700">
        {LABELS.map((x) => (
          <div key={x.l} className="flex items-center gap-1">
            <dt>
              <SourceBadgeStatic label={x.l} />
            </dt>
            <dd>{x.d}</dd>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <dt>
            <ScaleBadge scale="FULL" />
          </dt>
          <dd>회사 실제 규모</dd>
        </div>
        <div className="flex items-center gap-1">
          <dt>
            <ScaleBadge scale="SAMPLE" />
          </dt>
          <dd>커머스 표본 — 서로 더하거나 곱하지 않음</dd>
        </div>
      </dl>
    </footer>
  );
}
