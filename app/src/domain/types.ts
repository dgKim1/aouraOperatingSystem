/**
 * 온톨로지 타입 — docs/ONTOLOGY.md 의 계약을 그대로 옮긴다.
 * 소유: 백엔드(aoura-backend). 바꾸면 프론트엔드 영향 → 보고.
 * 문서와 다르면 문서가 기준이다.
 */

// ───────────────────────── 0. 공통 표기 ─────────────────────────

/** 출처 라벨 6종 (ONTOLOGY 0절) */
export type SourceLabel = 'ORIGINAL' | 'AGGREGATED' | 'INTERPRETED' | 'ASSUMPTION' | 'CLAIM' | 'MOCK';

export const SOURCE_LABEL_KO: Record<SourceLabel, string> = {
  ORIGINAL: '원본',
  AGGREGATED: '집계',
  INTERPRETED: '원본근거해석',
  ASSUMPTION: '가정',
  CLAIM: '주장',
  MOCK: '모의',
};

/** 스케일: FULL = 회사 실제 규모, SAMPLE = 커머스 대표 표본, NONE = 금액 아님 */
export type Scale = 'FULL' | 'SAMPLE' | 'NONE';

export interface SourceRef {
  /** 04_원본데이터 기준 경로. 예 '02_masil/marketing/mkt_budget_plan_ms.csv' */
  file: string;
  column?: string;
  rowKey?: string;
  /** 헤더 제외 1부터 */
  row?: number;
  note?: string;
}

export interface Sourced<T> {
  value: T;
  label: SourceLabel;
  refs: SourceRef[];
  scale: Scale;
  method?: string;
  assumptionIds?: string[];
}

/** 금액 혼합 방지 브랜드 타입 (R-SCALE-01). FULL + SAMPLE 은 타입 오류. */
export type Krw<S extends 'FULL' | 'SAMPLE'> = number & { readonly __scale: S };

/** YYYY-MM-DD */
export type IsoDate = string;
/** ISO 8601 시각 문자열 (KST 오프셋 포함 권장) */
export type IsoDateTime = string;

// ───────────────────────── 역할 ─────────────────────────

export type ApproverRole = 'MARKETING_TEAM' | 'MASIL_CEO' | 'GROUP_CEO_BOARD' | 'SCM';
export type ActorRole =
  | ApproverRole
  | 'CONTRACT_OFFICER'
  | 'FINANCE'
  | 'AGENCY'
  | 'COREVIA'
  | 'AI_AGENT'
  | 'SYSTEM';
export type ActorKind = 'AI' | 'HUMAN' | 'SYSTEM' | 'MOCK';

export const ROLE_KO: Record<ActorRole, string> = {
  MARKETING_TEAM: '마케팅팀(전결)',
  MASIL_CEO: 'Masil 대표',
  GROUP_CEO_BOARD: '그룹 CEO/이사회',
  SCM: 'SCM',
  CONTRACT_OFFICER: '계약 담당',
  FINANCE: '재무팀',
  AGENCY: '에이전시',
  COREVIA: 'Corevia',
  AI_AGENT: 'AI 에이전트',
  SYSTEM: '시스템',
};

// ───────────────────────── 1-2. 마스터 · 사실 ─────────────────────────

export type InfluencerTier = '대형' | '중형' | '마이크로';
export type Country = '국내' | '일본' | '미국' | '동남아';
export type Platform = 'YouTube' | 'Instagram' | 'TikTok';
export type FeeType = '고정+성과' | '성과' | '고정' | '혼합';

export interface Influencer {
  id: string;
  name: string;
  tier: InfluencerTier;
  primaryCountry: Country;
  platform: Platform;
  feeType: FeeType;
}

export type SalesChannelKind = '대형파트너' | '마켓플레이스' | '라이브' | '자사몰';
export type ProductLine = '색조' | '기초' | '선케어' | '더마';

export interface Campaign {
  id: string;
  name: string;
  influencerId: string;
  country: Country;
  snsChannel: string;
  snsFormat: string;
  salesChannel: SalesChannelKind;
  productLine: ProductLine;
  startDate: IsoDate;
  endDate: IsoDate;
  attributionWindowDays: number;
}

export interface Channel {
  id: string;
  name: string;
  channelType: string;
  partnerCode: string | null;
  country: string;
  paymentTermsDays: number;
  effectiveDate: IsoDate;
}

export type SkuCategory = '더마' | '기초' | '색조' | '선케어' | '헤어' | '바디';

export interface Sku {
  id: string;
  name: string;
  category: SkuCategory;
  productId: string;
  sourceCompany: string;
  safetyStockWeeksMin: number;
  safetyStockWeeksMax: number;
  moq: number;
  leadTimeWeeks: number;
}

export interface InventorySnapshot {
  skuId: string;
  snapshotDate: IsoDate;
  onHandQty: number;
  inTransitQty: number;
  stockCoverWeeksReported: number;
}

export interface WeeklySales {
  week: IsoDate;
  skuId: string;
  soldQty: number;
}

export interface PurchaseOrder {
  id: string;
  skuId: string;
  supplierId: string;
  orderDate: IsoDate;
  orderQty: number;
  moq: number;
  leadTimeWeeks: number;
  amountKrw: Krw<'FULL'>;
  paymentDueDate: IsoDate;
}

export interface ArItem {
  id: string;
  channelId: string;
  invoiceDate: IsoDate;
  dueDate: IsoDate;
  amountKrw: Krw<'FULL'>;
  outstandingKrw: Krw<'FULL'>;
  agingDays: number;
}

export interface ApItem {
  id: string;
  supplierId: string;
  /** 'NONE' 은 null */
  poId: string | null;
  invoiceDate: IsoDate;
  paymentDueDate: IsoDate;
  amountKrw: Krw<'FULL'>;
  agingDays: number;
}

export interface CashDaily {
  date: IsoDate;
  openingBalance: Krw<'FULL'>;
  inflowKrw: Krw<'FULL'>;
  outflowKrw: Krw<'FULL'>;
  closingBalance: Krw<'FULL'>;
  covenantMinKrw: Krw<'FULL'>;
  breachFlag: boolean;
}

/** 재무팀 공식 전망 — CLAIM */
export interface OfficialForecastWeek {
  forecastDate: IsoDate;
  week: IsoDate;
  projectedInflowKrw: Krw<'FULL'>;
  projectedOutflowKrw: Krw<'FULL'>;
  projectedClosingKrw: Krw<'FULL'>;
}

// 커머스 표본 (SAMPLE)
export interface Order {
  id: string;
  orderDate: IsoDate;
  customerRef: string;
  channelId: string;
  country: string;
  skuId: string;
  campaignId: string;
  gmvKrw: Krw<'SAMPLE'>;
  couponDiscountKrw: Krw<'SAMPLE'>;
}

export interface ReturnRow {
  id: string;
  orderId: string;
  refundCompletedDate: IsoDate;
  originalOrderDate: IsoDate;
  refundAmountKrw: Krw<'SAMPLE'>;
  reason: string;
}

export type AdMedia = '인플루언서' | '퍼포먼스' | '오프라인';

export interface AdSpend {
  id: string;
  campaignId: string;
  spendDate: IsoDate;
  media: AdMedia;
  platform: string;
  snsFormat: string;
  adCostKrw: Krw<'SAMPLE'>;
  /** 'NONE' 은 null */
  influencerFeeKrw: Krw<'SAMPLE'> | null;
}

/** SKU × 채널 고정 원가 — 단위 비용(스케일 무관) */
export interface CostMaster {
  skuId: string;
  channelId: string;
  productCostKrw: number;
  channelFeePct: number;
  shippingCostKrw: number;
  returnLogisticsCostKrw: number;
}

// ───────────────────────── 계약 · 기안 ─────────────────────────

export type ContractStatus =
  | 'ACTIVE'
  | 'UNDER_REVIEW'
  | 'PENDING_APPROVAL'
  | 'REVIEW_BEFORE_DEADLINE'
  | 'RENEWED_APPROVED'
  | 'NOTICE_PENDING'
  | 'NOTICE_SENT'
  | 'NOTICE_ACKNOWLEDGED'
  | 'NEGOTIATING'
  | 'TERMINATING'
  | 'NOTICE_UNCONFIRMED'
  | 'AUTO_RENEWED';

export type ContractDecision = 'RENEW_SAME' | 'RENEGOTIATE' | 'TERMINATE';

export interface ExclusiveContract {
  id: string;
  influencerId: string;
  contractType: 'ANNUAL_EXCLUSIVE';
  fixedFeeAnnualKrw: Krw<'FULL'>;
  /** 성과 피 조건 — 원본에 없음(G-02) */
  performanceFeeTerms: string | null;
  currentTermEnd: IsoDate;
  noticeDeadline: IsoDate;
  autoRenewalTermMonths: number;
  earlyTerminationPenaltyRate: number;
  /** 고정 피 지급 일정 — 원본에 없음(G-09) */
  feePaymentSchedule: null;
  status: ContractStatus;
  decision: ContractDecision | null;
}

export interface ExpansionProposal {
  id: string;
  submittedBy: 'MARKETING_TEAM';
  totalRequestedKrw: Krw<'SAMPLE'>;
  lineCount: number;
  /** CLAIM — 승인 근거 불가 */
  expectedGmvTotalKrw: Krw<'SAMPLE'>;
}

export type LineStatus =
  | 'RECEIVED'
  | 'VALIDATED'
  | 'INFO_MISSING'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'CONDITIONALLY_APPROVED'
  | 'REJECTED'
  | 'ON_HOLD'
  | 'REAPPROVAL_REQUIRED'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'AUTO_CONFIRMED';

export type LineFlag =
  | 'OVER_10M'
  | 'IN_COVENANT_WINDOW'
  | 'SETTLEMENT_BEFORE_DEADLINE'
  | 'CONTRACT_PENDING'
  | 'CP_NEGATIVE'
  | 'CP_POSITIVE'
  | 'CP_REF_SIGN_DIFFERS'
  | 'INVENTORY_BELOW_MIN'
  | 'STOCKOUT_BEFORE_SETTLEMENT';

export type RuleId =
  | 'R-AUTH-01'
  | 'R-AUTH-02'
  | 'R-AUTH-03'
  | 'R-AUTH-04'
  | 'R-AUTH-05'
  | 'R-AUTH-06'
  | 'R-DL-01'
  | 'R-DL-02'
  | 'R-DL-03'
  | 'R-DL-04'
  | 'R-DL-05'
  | 'R-DL-06'
  | 'R-CP-01'
  | 'R-CP-02'
  | 'R-CP-03'
  | 'R-CP-04'
  | 'R-CP-05'
  | 'R-CP-06'
  | 'R-INV-01'
  | 'R-INV-02'
  | 'R-INV-03'
  | 'R-INV-04'
  | 'R-CASH-01'
  | 'R-CASH-02'
  | 'R-CASH-03'
  | 'R-CASH-04'
  | 'R-EXT-01'
  | 'R-PEN-01'
  | 'R-CON-01'
  | 'R-SCALE-01'
  | 'R-CLAIM-01';

export interface RoutingReason {
  ruleId: RuleId;
  text: string;
  label: SourceLabel;
}

export interface Routing {
  requiredRole: ApproverRole;
  alsoReportTo: ApproverRole[];
  reasons: RoutingReason[];
  /** 라우팅 계산에 쓴 재전망 ID (R-AUTH-06 사유 기록용) */
  forecastRunId?: string;
}

export interface ExpansionLine {
  id: string;
  proposalId: string;
  campaignId: string;
  influencerId: string;
  requestedKrw: Krw<'SAMPLE'>;
  /** CLAIM */
  expectedGmvKrw: Krw<'SAMPLE'>;
  settlementDate: IsoDate;
  contractDeadline: IsoDate;
  status: LineStatus;
  routing: Routing | null;
  flags: LineFlag[];
  /** 승인을 준 역할(회신자). 권한 재판정(R-AUTH-06)에서 사용 */
  approvedByRole?: ApproverRole | null;
  /** 현재 걸려 있는 승인요청 */
  approvalRequestId?: string | null;
  /** 공급 전망 (④ SCM 회신 결과) — R-INV-03 권고에 반영 */
  supplyOutlook?: SupplyOutlook;
  /** SCM 이 확인한 입고 예정일 (MOCK 회신) */
  inboundExpectedDate?: IsoDate | null;
}

export type SupplyOutlook = 'UNKNOWN' | 'INBOUND_CONFIRMED' | 'NO_SUPPLY';

// ───────────────────────── 성과 (R-CP) ─────────────────────────

export interface CampaignPerformance {
  key: string;
  orderCount: number;
  returnOrderCount: number;
  gmv: number;
  couponDiscount: number;
  returnRefund: number;
  netRevenue: number;
  cogs: number;
  channelFee: number;
  fulfillmentCost: number;
  returnLogisticsCost: number;
  marketingSpend: number;
  /** 공식값 — A05 5절 단일 차감 (R-CP-01) */
  cp: number;
  /** 참고값 — calculation_definitions 1.4 문자 그대로(쿠폰 · 환불 이중 차감) (R-CP-02). 판단에 쓰지 않음 */
  cpRefDef14: number;
  nominalRoas: number | null;
  realRoas: number | null;
  realRoasRefDef14: number | null;
  /** 금액 기준 반품률 (1.7) */
  returnRate: number | null;
  scale: 'SAMPLE';
}

export type CpGrade = 'CP_NEGATIVE' | 'CP_POSITIVE';

// ───────────────────────── 자금 (R-CASH) ─────────────────────────

export interface DateWindow {
  start: IsoDate;
  end: IsoDate;
}

export interface CashForecastRun {
  id: string;
  asOf: IsoDate;
  inputsVersion: string[];
  assumptionIds: string[];
  daily: { date: IsoDate; closingKrw: number }[];
  minClosing: { date: IsoDate; krw: number };
  breachWindows: DateWindow[];
  createdAt: IsoDateTime;
}

// ───────────────────────── 1-3. 운영 엔티티 ─────────────────────────

export type EventType =
  | 'RENEWAL_NOTICE_RECEIVED'
  | 'EXPANSION_PROPOSAL_RECEIVED'
  | 'AR_COLLECTION_DELAYED'
  | 'LINE_TERMS_CHANGED'
  | 'APPROVAL_REPLY'
  | 'COUNTERPARTY_REPLY'
  | 'CLOCK_ADVANCED';

export interface DomainEvent {
  id: string;
  type: EventType;
  payload: unknown;
  label: 'ORIGINAL' | 'MOCK';
  simAt: IsoDateTime;
  createdAt: IsoDateTime;
  createdBy: ActorRole;
}

export type SubjectType = 'CONTRACT' | 'EXPANSION_LINES' | 'REPLENISHMENT';

export interface Alternative {
  id: string;
  title: string;
  decision: string;
  effects: Sourced<unknown>[];
  risks: string[];
  requiresRole: ApproverRole;
}

/** 판단안의 사실 1건 — 도구(도메인 계산)가 돌려준 값만. key 는 안정 식별자(예 'line.PLAN-004.cp'), name 은 화면 표시명 */
export interface AssessmentFact {
  key: string;
  name: string;
  value: Sourced<unknown>;
}

export interface AssessmentRuleResult {
  ruleId: RuleId;
  result: unknown;
  inputs: unknown;
  /** 어느 대상(계약 · 기안 건 · 보충요청)에 대한 결과인가 */
  subjectId?: string;
}

/** 판단안을 만들 때 호출한 도구 기록 (S-05 「도구 호출 목록」) */
export interface ToolCallLog {
  name: string;
  input: unknown;
  output: unknown;
  /** AI = 모델이 호출 · SYSTEM = 모의 모드에서 코드가 같은 도구를 직접 실행 */
  actor: 'AI' | 'SYSTEM';
}

export interface Assessment {
  id: string;
  subjectType: SubjectType;
  subjectIds: string[];
  triggerEventId: string | null;
  facts: AssessmentFact[];
  ruleResults: AssessmentRuleResult[];
  alternatives: Alternative[];
  recommendation: { alternativeId: string; rationale: string };
  perspectives: { marketing: string; finance: string; contract: string; scm: string };
  claimsCited: { text: string; ref: SourceRef }[];
  unknowns: { gapId: string; impact: string }[];
  aiMode: 'LIVE' | 'MOCK';
  model: string;
  version: number;
  createdAt: IsoDateTime;
  /** 규칙 기반 권고 결정 (승인요청 proposed 로 쓰인다 — AI 가 정하지 않음, DD-016) */
  proposedDecisions?: { itemId: string; decision: string; condition?: string }[];
  toolCalls?: ToolCallLog[];
  /** 실시간 호출 실패 · 거절 · 숫자 출처 위반으로 모의로 대체된 이유 */
  fallbackReason?: string | null;
  /** 모델 응답 stop_reason (모의면 null) */
  stopReason?: string | null;
  warnings?: string[];
}

export type ApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'APPROVED_WITH_CONDITIONS'
  | 'REJECTED'
  | 'INFO_REQUESTED'
  | 'SUPERSEDED'
  | 'EXPIRED';

export interface ApprovalRequest {
  id: string;
  subjectType: SubjectType;
  subjectIds: string[];
  requiredRole: ApproverRole;
  alsoReportTo: ApproverRole[];
  routingReasons: RoutingReason[];
  assessmentId: string | null;
  proposed: { itemId: string; decision: string }[];
  internalDueAt: IsoDateTime;
  hardDeadline: IsoDate;
  status: ApprovalStatus;
  version: number;
  supersedesId: string | null;
}

export type ReplyOutcome = 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED' | 'INFO_REQUESTED';
export type ItemDecision = 'APPROVE' | 'REJECT' | 'HOLD' | 'CONDITIONAL';

export interface ApprovalReply {
  id: string;
  requestId: string;
  respondentRole: ApproverRole;
  outcome: ReplyOutcome;
  itemDecisions: { itemId: string; decision: ItemDecision; condition?: string }[];
  /** 계약 회신일 때의 결정 */
  decision?: ContractDecision;
  reason: string;
  /** 정보 요청이 필요한 반려 · 정보요청 회신 — INFO_REQUEST 작업을 만든다 */
  infoRequest?: { target: ActorRole; question: string };
  simAt: IsoDateTime;
  label: 'MOCK';
}

export type TaskType =
  | 'SEND_NOTICE'
  | 'CONFIRM_RECEIPT'
  | 'RENOTIFY'
  | 'DOCUMENT_CONDITIONS'
  | 'REVIEW_BEFORE_DEADLINE'
  | 'RESUBMIT'
  | 'INFO_REQUEST'
  | 'REPORT_TO_GROUP'
  | 'RESCHEDULE_CAMPAIGN'
  | 'REPLENISHMENT_REVIEW'
  | 'INCIDENT_AUTO_RENEWAL'
  /** 통보 수령 미확인 에스컬레이션 (확장 E1, BE-01) — 자동 갱신 사고와 구분 */
  | 'ESCALATE_NOTICE_UNCONFIRMED'
  | 'POST_DEADLINE_REPORT';

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'OVERDUE';

export interface Task {
  id: string;
  type: TaskType;
  subjectType: string;
  subjectId: string;
  ownerRole: ActorRole;
  dueAt: IsoDateTime;
  status: TaskStatus;
  createdByEventId: string | null;
  resultNote?: string;
  /** 작업 지시 (예: 승인 조건 "집행일 2026-08-31 이후로 조정") */
  instruction?: string;
}

/** S-02 외부 회신 결과 4종: 수령확인 · 정보 제공 · 정보 부족 · 거절 */
export type CounterpartyOutcome = 'RECEIPT_CONFIRMED' | 'INFO_PROVIDED' | 'INSUFFICIENT' | 'REJECTED';
export type CounterpartyRole = 'AGENCY' | 'SCM' | 'COREVIA';

/**
 * 외부 모의 회신 (S-02 「외부 회신」 양식). 에이전시 · SCM · Corevia 공통.
 * - AGENCY: 수령확인 → 계약 NOTICE_ACKNOWLEDGED, 정보 제공 · 정보 부족 · 거절 → 계약 정보 요청 작업 종료
 * - SCM: 정보 제공 + replenishmentNeeded(false: 추가 발주 불필요 / true: 필요) → 보충요청 처리, 정보 부족 → 초안 유지, 거절 → 보충 불가
 * - COREVIA: 정보 제공(입고 예정일) · 정보 부족 · 거절 → SCM 정보 요청 작업 종료
 */
export interface CounterpartyReplyInput {
  from: CounterpartyRole;
  outcome: CounterpartyOutcome;
  note: string;
  /** SCM · Corevia 가 확인한 입고 예정일 */
  inboundExpectedDate?: IsoDate;
  /** SCM 정보 제공 시: 추가 발주 필요 여부 */
  replenishmentNeeded?: boolean;
  label: 'MOCK';
}

export interface Notice {
  id: string;
  contractId: string;
  decision: ContractDecision;
  sentAt: IsoDateTime;
  channel: 'EMAIL' | 'DOCUMENT';
  label: 'MOCK';
}

export interface NoticeReceipt {
  id: string;
  noticeId: string;
  receivedAt: IsoDateTime;
  evidence: string;
  label: 'MOCK';
}

export type ReplenishmentStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED';

export interface ReplenishmentRequest {
  id: string;
  skuId: string;
  triggerLineId: string | null;
  avg4wDemand: number;
  coverWeeks: number;
  targetQty: number;
  suggestedQty: number;
  finalQty: number;
  unitCostKrw: number;
  amountKrw: Krw<'FULL'>;
  neededBy: IsoDate;
  expectedPaymentDate: IsoDate;
  requiredRole: ApproverRole;
  status: ReplenishmentStatus;
  openQuestions: string[];
  /** 종결 경로 (REJECTED 일 때): SCM 검토 '불필요'(A-30) · SCM '보충 불가'(A-34) · 권한자 승인 거절 */
  closedBy?: 'SCM_NOT_NEEDED' | 'SCM_NO_SUPPLY' | 'APPROVER' | null;
}

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  fromStatus: string | null;
  toStatus: string;
  actorRole: ActorRole;
  actorKind: ActorKind;
  ruleIds: RuleId[];
  eventId: string | null;
  reason: string;
  simAt: IsoDateTime;
  createdAt: IsoDateTime;
  snapshot: Record<string, unknown>;
}

/** 기한 경고 단계 (R-DL-03, A-25) */
export type DeadlineLevel = 'INFO' | 'WARNING' | 'DANGER' | 'PASSED';
