/** 이력 · 결과 패널에서 대상 ID → 화면 경로 (표시용 연결만, 판정 없음) */
export function entityHref(type: string, id: string): string | null {
  switch (type) {
    case 'CONTRACT':
      return `/contracts/${id}`;
    case 'APPROVAL_REQUEST':
      return `/approvals/${id}`;
    case 'EXPANSION_LINE':
      return `/proposals/PROP-2026-07?q=${id}#line-${id}`;
    case 'TASK':
      return `/tasks#task-${id}`;
    case 'ASSESSMENT':
      return `/assessments/${id}`;
    case 'REPLENISHMENT':
      return `/analysis/inventory#rep-${id}`;
    case 'CASH_FORECAST':
      return '/analysis/cash';
    default:
      return null;
  }
}

export const ENTITY_KO: Record<string, string> = {
  CONTRACT: '전속계약',
  EXPANSION_LINE: '기안 건',
  APPROVAL_REQUEST: '승인요청',
  TASK: '작업',
  REPLENISHMENT: '보충요청',
  CASH_FORECAST: '자금 재전망',
  ASSESSMENT: '판단안',
};
