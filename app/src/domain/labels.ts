/**
 * enum → 한국어 문구 (판정 로직 없음). API 응답의 statusText · typeText 에 쓴다.
 * components/labels.ts(프론트엔드 소유)와 같은 내용 — 프론트엔드가 이 파일로 옮기면 하나로 합친다.
 */
import type { ReplenishmentRequest, ApprovalStatus, ContractDecision, ContractStatus, ItemDecision, LineFlag, LineStatus, TaskStatus, TaskType } from '@/domain/types';

export const CONTRACT_STATUS_KO: Record<ContractStatus, string> = {
  ACTIVE: '유효 (검토 전)',
  UNDER_REVIEW: '검토 중',
  PENDING_APPROVAL: '승인 대기',
  REVIEW_BEFORE_DEADLINE: '반려 · 기한 전 재검토',
  RENEWED_APPROVED: '승인 갱신',
  NOTICE_PENDING: '통보 대기',
  NOTICE_SENT: '통보 발송 (수령 미확인)',
  NOTICE_ACKNOWLEDGED: '수령 확인',
  NEGOTIATING: '조건변경 협상 중',
  TERMINATING: '만료 후 종료 예정',
  NOTICE_UNCONFIRMED: '통보 효력 미확인',
  AUTO_RENEWED: '자동 갱신됨 (권한 미경유 체결)',
};

export const LINE_STATUS_KO: Record<LineStatus, string> = {
  RECEIVED: '접수',
  VALIDATED: '확인 완료',
  INFO_MISSING: '정보 누락',
  PENDING_APPROVAL: '승인 대기',
  APPROVED: '승인',
  CONDITIONALLY_APPROVED: '조건부 승인',
  REJECTED: '부결',
  ON_HOLD: '보류',
  REAPPROVAL_REQUIRED: '재승인 필요',
  CONFIRMED: '확정',
  CANCELLED: '취소',
  AUTO_CONFIRMED: '자동 확정 (철회 불가)',
};

export const APPROVAL_STATUS_KO: Record<ApprovalStatus, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  APPROVED_WITH_CONDITIONS: '조건부 승인',
  REJECTED: '반려',
  INFO_REQUESTED: '정보 요청',
  SUPERSEDED: '대체됨',
  EXPIRED: '만료',
};

export const TASK_TYPE_KO: Record<TaskType, string> = {
  SEND_NOTICE: '통보 발송',
  CONFIRM_RECEIPT: '수령확인',
  RENOTIFY: '재통보',
  DOCUMENT_CONDITIONS: '승인조건 문서화',
  REVIEW_BEFORE_DEADLINE: '기한 전 재검토',
  RESUBMIT: '재상신',
  INFO_REQUEST: '정보 요청',
  REPORT_TO_GROUP: '그룹 보고',
  RESCHEDULE_CAMPAIGN: '집행일 조정',
  REPLENISHMENT_REVIEW: '재고 보충 검토',
  INCIDENT_AUTO_RENEWAL: '자동 갱신 사고 대응',
  ESCALATE_NOTICE_UNCONFIRMED: '통보 수령 미확인 에스컬레이션',
  POST_DEADLINE_REPORT: '기한 경과 사후 보고',
};

export const TASK_STATUS_KO: Record<TaskStatus, string> = {
  OPEN: '열림',
  IN_PROGRESS: '진행 중',
  DONE: '완료',
  CANCELLED: '취소',
  OVERDUE: '기한 경과',
};

export const DECISION_KO: Record<ContractDecision | ItemDecision, string> = {
  RENEW_SAME: '동일 조건 갱신',
  RENEGOTIATE: '조건변경 통보',
  TERMINATE: '해지 통보',
  APPROVE: '승인',
  REJECT: '부결',
  HOLD: '보류',
  CONDITIONAL: '조건부 승인',
};

export function decisionText(d: string): string {
  return (DECISION_KO as Record<string, string>)[d] ?? d;
}

export const FLAG_KO: Record<LineFlag, string> = {
  OVER_10M: '건별 1천만 초과',
  IN_COVENANT_WINDOW: 'covenant 하회 구간 집행',
  SETTLEMENT_BEFORE_DEADLINE: '집행일 < 확정기한',
  CONTRACT_PENDING: '전속계약 미결정',
  CP_NEGATIVE: '실질 공헌이익 음수',
  CP_POSITIVE: '실질 공헌이익 양수',
  CP_REF_SIGN_DIFFERS: '참고: 1.4 값 부호 다름',
  INVENTORY_BELOW_MIN: '주력 SKU 안전재고 미달',
  STOCKOUT_BEFORE_SETTLEMENT: '집행일 전 품절 예상',
};

/** 위험 신호 플래그 (빨강 · 주황 칩) */
export const FLAG_TONE: Record<LineFlag, 'danger' | 'warning' | 'info' | 'reference' | 'positive'> = {
  OVER_10M: 'info',
  IN_COVENANT_WINDOW: 'warning',
  SETTLEMENT_BEFORE_DEADLINE: 'warning',
  CONTRACT_PENDING: 'warning',
  CP_NEGATIVE: 'danger',
  CP_POSITIVE: 'positive',
  CP_REF_SIGN_DIFFERS: 'reference',
  INVENTORY_BELOW_MIN: 'danger',
  STOCKOUT_BEFORE_SETTLEMENT: 'danger',
};

/** 보충요청 상태 문구 (BE-13) — 종결 경로를 구분해 화면이 사유 문자열을 파싱하지 않게 한다 */
export function replenishmentStatusText(r: Pick<ReplenishmentRequest, 'status' | 'closedBy'>): string {
  if (r.status === 'REJECTED') {
    if (r.closedBy === 'SCM_NOT_NEEDED') return 'SCM 검토: 불필요로 종결 (승인 거절 아님)';
    if (r.closedBy === 'SCM_NO_SUPPLY') return 'SCM 검토: 보충 불가로 종결 (승인 거절 아님)';
    return '승인 거절';
  }
  return { DRAFT: '초안 (SCM 검토 대기)', SUBMITTED: '상신 (승인 대기)', APPROVED: '승인', INFO_REQUESTED: '정보 요청' }[r.status];
}
