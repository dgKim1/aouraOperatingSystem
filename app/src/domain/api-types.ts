/**
 * API 응답 · 요청 타입 (SCREEN_SPEC 4절의 확정판). 소유: 백엔드. 타입만 있다(실행 코드 없음).
 * 프론트엔드는 이 파일을 import 해서 fetch('/api/…') 결과를 받는다 — app/src/app/_data/types.ts 를 대체한다.
 * 모든 값은 Sourced<T> 로 출처 · 스케일을 단다 (UI-01). 금액은 Money<'FULL'|'SAMPLE'> (R-SCALE-01 / UI-02).
 */
import type { GapStatus } from './gaps';
import type { ProvenanceResult } from './provenance';
import type { Money, Num, Txt } from './sourced';
import type {
  ActorKind,
  ActorRole,
  ApprovalReply,
  ApprovalRequest,
  ApprovalStatus,
  ApproverRole,
  Assessment,
  AuditLogEntry,
  ContractDecision,
  ContractStatus,
  CounterpartyReplyInput,
  DeadlineLevel,
  DomainEvent,
  EventType,
  IsoDate,
  IsoDateTime,
  ItemDecision,
  LineFlag,
  LineStatus,
  Notice,
  NoticeReceipt,
  ReplenishmentRequest,
  ReplyOutcome,
  RoutingReason,
  RuleId,
  Sourced,
  SourceLabel,
  SourceRef,
  SubjectType,
  Task,
  TaskStatus,
  ToolCallLog,
} from './types';
import type { RoutingChange } from './workflow';

export type { Money, Num, Txt, RoutingChange, ProvenanceResult };

/** 오류 응답 — 권한 위반 422 FORBIDDEN_ROLE, 상태 전이 위반 409 INVALID_TRANSITION, 입력 오류 422 VALIDATION · INFO_MISSING, 없음 404 NOT_FOUND */
export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface UnknownValue {
  gapId: string;
  note: string;
}

// ───────── 시연 시나리오 ─────────
export type PresetId = 'SEED' | 'S1_RECEIVED' | 'S1_4' | 'S1_5' | 'S1_6' | 'S1_7' | 'S2' | 'S3_1' | 'S3_B' | 'S4';

export interface PresetInfo {
  id: PresetId;
  scenario: '①' | '②' | '③' | '④' | '-';
  title: string;
  description: string;
  /** 다음에 할 행동 안내 (S-13) */
  next: string;
}

// ───────── GET /api/healthz ─────────
/** 배포 상태 확인 — 프로세스가 요청을 받는지만 알린다(DB · 원본 · AI 미확인). 동작 확인은 MetaView */
export interface HealthView {
  status: 'ok';
}

// ───────── GET /api/meta ─────────
export interface MetaView {
  workId: 'W02';
  simNow: IsoDateTime;
  /** 키가 있고 강제 모의가 아니면 LIVE. 실제 호출이 실패하면 판단안 단위로 MOCK 대체(판단안의 aiMode · mock 확인) */
  aiMode: 'LIVE' | 'MOCK';
  model: string;
  cashForecastVersion: string;
  dataMode: 'API';
  /** 운영 상태 저장소: POSTGRES(DATABASE_URL) 또는 MEMORY(프로세스 메모리 — 재시작 시 초기화) */
  persistence: 'POSTGRES' | 'MEMORY';
  /** 원본을 읽은 곳: FILES(04_원본데이터) 또는 DB(raw_rows) */
  rawSource: 'FILES' | 'DB';
  /** 마지막으로 재생한 시연 프리셋 (사용자가 사건을 더 넣었으면 그 뒤 상태) */
  preset: PresetInfo | null;
  stateVersion: number;
}

// ───────── 상태 변경 응답 공통 (UI-05) ─────────
export interface MutationResult {
  /** 이번 처리로 생긴 처리 이력 (상태 전이 · 작업 생성 · 권한 재판정 포함). 각 행에 표시 문구(displayText 등)가 붙는다 */
  transitions: AuditRowView[];
  createdTasks: Task[];
  createdApprovals: ApprovalRequest[];
  /** R-AUTH-06 권한 재판정 결과 (from → to, 처리 방식) */
  routingChanges: RoutingChange[];
  summary: {
    /** 엔티티 상태가 실제로 바뀐 건수 (이력 중 from ≠ to) */
    stateChanges: number;
    createdTasks: number;
    createdApprovals: number;
    routingChanges: number;
    /** 새 판단안이 필요한 대상 ID (계약 · 기안 건) */
    needsAssessment: string[];
  };
  simNow: IsoDateTime;
  stateVersion: number;
}

/** POST /api/events 요청 */
export type EventInput =
  | { type: 'RENEWAL_NOTICE_RECEIVED'; payload: { contractId: string } }
  /** 기안은 25건 전체로만 접수 (BE-20). 범위 필드(lineIds 등)를 보내면 422 VALIDATION */
  | { type: 'EXPANSION_PROPOSAL_RECEIVED'; payload: { proposalId: string } }
  | { type: 'AR_COLLECTION_DELAYED'; payload: { arId: string; newDueDate: IsoDate } }
  | { type: 'LINE_TERMS_CHANGED'; payload: { lineId: string; requestedKrw?: number; settlementDate?: IsoDate } }
  | { type: 'COUNTERPARTY_REPLY'; payload: Omit<CounterpartyReplyInput, 'label'> }
  | { type: 'APPROVAL_REPLY'; payload: ReplyBody & { requestId: string } }
  | { type: 'CLOCK_ADVANCED'; payload: { to: IsoDateTime } };

export interface EventResponse extends MutationResult {
  event: DomainEvent;
  needsAssessment: string[];
}

export interface ClockResponse extends MutationResult {
  event: DomainEvent;
}

/** POST /api/approval-requests/:id/replies 요청 (S-06) */
export interface ReplyBody {
  respondentRole: ApproverRole;
  outcome: ReplyOutcome;
  /** 기안 묶음 건별 결정 */
  itemDecisions?: { itemId: string; decision: ItemDecision; condition?: string }[];
  /** 계약 승인 결정 */
  decision?: ContractDecision;
  /** 조건부 승인 조건 — itemDecisions 에 조건이 없을 때 CONDITIONAL 건에 채운다 */
  conditions?: string;
  reason: string;
  infoRequest?: { target: ActorRole; question: string };
}

export interface ReplyResponse extends MutationResult {
  event: DomainEvent;
  reply: ApprovalReply;
  request: ApprovalRequest;
}

/** PATCH /api/tasks/:id 요청 (S-07) */
export interface TaskPatchBody {
  status: Extract<TaskStatus, 'IN_PROGRESS' | 'DONE' | 'CANCELLED'>;
  /**
   * 요청한 사람의 현재 역할 — **서버에서 필수**(없으면 422 VALIDATION). 작업의 담당 역할(ownerRole)이 아니면 422 FORBIDDEN_ROLE, 상태 불변.
   * (타입은 프론트엔드 호환을 위해 선택으로 남겨 둠)
   */
  actorRole?: ActorRole;
  resultNote?: string;
  /** SEND_NOTICE: {content?} · RESCHEDULE_CAMPAIGN: {settlementDate} · RESUBMIT: {assessmentId?, proposedDecision?} */
  payload?: Record<string, unknown>;
}

export interface TaskPatchResponse extends MutationResult {
  task: TaskView;
}

export interface ApprovalCreateResponse extends MutationResult {
  requests: ApprovalRequest[];
}

export interface AssessmentCreateResponse extends MutationResult {
  assessment: AssessmentView;
}

/** POST /api/replenishment-requests 요청 — actorRole 필수, SCM 이 아니면 422 FORBIDDEN_ROLE (SCREEN_SPEC S-09) */
export interface ReplenishmentCreateBody {
  triggerLineId: string;
  skuIds?: string[];
  actorRole: ActorRole;
}

export interface ReplenishmentCreateResponse extends MutationResult {
  replenishments: ReplenishmentRequest[];
}

export interface ScenarioResetResponse {
  preset: PresetInfo;
  simNow: IsoDateTime;
  replayedEvents: DomainEvent[];
  stateVersion: number;
}

export interface ScenarioCheckView {
  preset: PresetInfo;
  criteria: { id: string; text: string; passed: boolean; actual: unknown; expected: unknown }[];
  passed: number;
  total: number;
}

// ───────── 경고 (SCREEN_SPEC 0-3) ─────────
export type AlertKind = 'AUTHORITY' | 'DEADLINE' | 'AUTO_RENEWAL' | 'CONTRACT_LINK' | 'INVENTORY' | 'CP_NEGATIVE' | 'NOTICE_UNCONFIRMED';
export type Severity = 'DANGER' | 'WARNING' | 'INFO';

export interface AlertView {
  id: string;
  kind: AlertKind;
  severity: Severity;
  title: string;
  detail: string;
  nextAction: { text: string; href?: string; role?: ActorRole };
  ruleIds: RuleId[];
  label: SourceLabel;
  /** 권한자 변경 시 이전 권한자 (취소선 표시) */
  previousRole?: ApproverRole | null;
  subjectIds: string[];
}

/** 참고 플래그 — 경고 아님. 경고 목록에 넣지 않는다 (UI-10) */
export interface ReferenceFlagView {
  subjectId: string;
  text: string;
}

// ───────── GET /api/overview ─────────
export type TimelineKind = 'CONTRACT_NOTICE' | 'LINE_DEADLINE' | 'CONTRACT_END' | 'PO_PAYMENT' | 'PO_ARRIVAL';
export type MarkerState = 'OPEN' | 'APPROVED' | 'REJECTED' | 'AUTO' | 'DONE' | 'INFO';

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  date: IsoDate;
  endDate?: IsoDate;
  title: string;
  state: MarkerState;
  stateText: string;
  level?: DeadlineLevel;
  daysLeft?: number;
  count?: Num;
  amount?: Money;
  /** 기한 묶음의 기안 총액 대비 비중 (LINE_DEADLINE) */
  share?: Num;
  label: SourceLabel;
  href?: string;
}

export interface CovenantWindowView {
  forecastId: string;
  start: IsoDate;
  end: IsoDate;
  businessDays: number;
  current: boolean;
  source: Txt;
}

export interface PendingApprovalCard {
  id: string;
  requiredRole: ApproverRole;
  subjectText: string;
  subjectHref: string;
  hardDeadline: IsoDate;
  internalDueAt: IsoDateTime;
  daysLeft: number;
  level: DeadlineLevel;
  recommendation: string;
  status: ApprovalStatus;
  assessmentId: string | null;
}

export interface ContractSummary {
  id: string;
  influencerName: string;
  status: ContractStatus;
  statusText: string;
  fixedFee: Money<'FULL'>;
  performanceFee: UnknownValue | Txt;
  noticeDeadline: Txt;
  daysLeft: number;
  level: DeadlineLevel;
  receiptConfirmed: boolean;
  receiptText: string;
  autoRenewed: boolean;
  /** 기한 경과 시 자동 갱신으로 갈 수 있는 상태 + D-7 이내 (빨강 배너 조건, SCREEN_SPEC 0-3) */
  autoRenewalRisk: boolean;
}

export interface TaskCounts {
  open: number;
  overdue: number;
  byRole: { role: ActorRole; open: number; overdue: number }[];
}

export interface OverviewView {
  timeline: TimelineItem[];
  covenantWindows: CovenantWindowView[];
  pendingApprovals: PendingApprovalCard[];
  alerts: AlertView[];
  referenceFlags: ReferenceFlagView[];
  contract: ContractSummary;
  taskCounts: TaskCounts;
  recentAudit: AuditRowView[];
  received: boolean;
  /** 기발주 대금 합계 (FULL) — 하회 구간 시작 원인 */
  poPaymentTotal: Money<'FULL'>;
}

// ───────── GET /api/contracts/:id ─────────
export interface ContractTermRow {
  key: string;
  name: string;
  value: Txt | Money<'FULL'> | Num | UnknownValue;
}

export interface LinkedLineView {
  id: string;
  campaignId: string;
  requested: Money<'SAMPLE'>;
  contractDeadline: IsoDate;
  status: LineStatus;
  statusText: string;
}

export interface InfluencerPerfRow {
  influencerId: string;
  name: string;
  adSpendShare: Num;
  adSpendRank: number;
  requestShare: Num;
  requestRank: number;
  gmv: Money<'SAMPLE'>;
  spend: Money<'SAMPLE'>;
  cp: Money<'SAMPLE'>;
  cpRank: number;
  nominalRoas: Num | null;
  realRoas: Num | null;
  realRoasRank: number;
  returnRate: Num | null;
  refSignDiffers: boolean;
  /** includeReference 일 때만 (참고값 — 판단에 쓰지 않음) */
  cpRefDef14?: Money<'SAMPLE'>;
  realRoasRefDef14?: Num | null;
}

export interface AssessmentSummary {
  id: string;
  version: number;
  aiMode: 'LIVE' | 'MOCK';
  mock: boolean;
  createdAt: IsoDateTime;
  recommendation: { alternativeId: string; title: string | null; rationale: string };
}

export interface ContractView {
  contract: ContractSummary;
  terms: ContractTermRow[];
  routing: { requiredRole: ApproverRole; reasons: RoutingReason[]; annualAmount: Money<'FULL'>; lowerBound: boolean };
  deadlines: { kind: string; date: IsoDate; label: SourceLabel; assumptionIds?: string[]; daysLeft: number; level: DeadlineLevel }[];
  linkedLines: LinkedLineView[];
  performance: InfluencerPerfRow | null;
  notices: Notice[];
  receipts: NoticeReceipt[];
  audit: AuditRowView[];
  approvals: ApprovalRequest[];
  consequences: { renewed: boolean; renewalStart: IsoDate; renewalEnd: IsoDate; committed: Money<'FULL'> | null };
  penaltyPreview: { terminateOn: IsoDate; remainingMonths: number; amount: Money<'FULL'> } | null;
  openGaps: string[];
  /** 최신 판단안 ID (없으면 null) */
  assessmentId: string | null;
  latestAssessment: AssessmentSummary | null;
  assessments: AssessmentSummary[];
  /** [승인 요청 만들기] 가능 여부 — 판단안이 있고 계약이 UNDER_REVIEW */
  canRequestApproval: boolean;
}

/** GET /api/contracts/:id/penalty */
export interface PenaltyView {
  terminateOn: IsoDate;
  renewalStart: IsoDate;
  renewalEnd: IsoDate;
  remainingMonths: number;
  /** 갱신(자동 · 승인) 상태가 아니면 0 — 위약금은 갱신 후 중도 해지에만 */
  applies: boolean;
  amount: Money<'FULL'>;
}

// ───────── GET /api/proposals/:id ─────────
export interface CostStep {
  key: string;
  name: string;
  amount: Money<'SAMPLE'>;
  sign: '+' | '−' | '=';
}

export interface LineInventorySku {
  skuId: string;
  name: string;
  share: Num;
  coverWeeks: Num | null;
  minWeeks: number;
  belowMin: boolean;
  stockoutDate: IsoDate | null;
  arrivalIfOrderedNow: IsoDate;
  stockoutBeforeSettlement: boolean;
}

export interface LineView {
  id: string;
  campaignId: string;
  campaignName: string;
  influencerId: string;
  influencerName: string;
  productLine: string;
  requested: Money<'SAMPLE'>;
  /** CLAIM — 주장 영역에서만 */
  expectedGmv: Money<'SAMPLE'>;
  settlementDate: IsoDate;
  contractDeadline: IsoDate;
  decisionNeededBy: IsoDate;
  daysLeft: number;
  level: DeadlineLevel;
  routing: { requiredRole: ApproverRole; alsoReportTo: ApproverRole[]; reasons: RoutingReason[]; previousRole: ApproverRole | null; changeReason: string | null } | null;
  grade: 'CP_POSITIVE' | 'CP_NEGATIVE' | null;
  cp: Money<'SAMPLE'> | null;
  /** 참고값 — 기본 숨김 (UI-10) */
  cpRefDef14: Money<'SAMPLE'> | null;
  costSteps: CostStep[];
  refCostSteps: CostStep[];
  minCover: Num | null;
  inventory: LineInventorySku[];
  flags: LineFlag[];
  status: LineStatus;
  statusText: string;
  approvalRequestId: string | null;
  recommendation: { decision: string; reasons: string[]; ruleIds: RuleId[]; condition?: string } | null;
  inCovenantWindow: { window: { start: IsoDate; end: IsoDate } } | null;
  hasPostDeadlineReport: boolean;
  supplyOutlook: 'UNKNOWN' | 'INBOUND_CONFIRMED' | 'NO_SUPPLY';
  inboundExpectedDate: IsoDate | null;
}

export interface DeadlineGroup {
  deadline: IsoDate;
  count: number;
  total: Money<'SAMPLE'>;
  share: Num;
}

export interface ProposalView {
  received: boolean;
  proposal: { id: string; total: Money<'SAMPLE'>; lineCount: Num; expectedGmvTotal: Money<'SAMPLE'> } | null;
  summary: {
    authorityText: string;
    authorityReasons: RoutingReason[];
    over10mCount: Num;
    groups: DeadlineGroup[];
    gradeCounts: { positive: number; negative: number; refDiffers: number };
  } | null;
  lines: LineView[];
  covenantWindow: CovenantWindowView | null;
}

export interface ProposalFilters {
  deadline?: string;
  role?: string;
  grade?: string;
  status?: string;
  flag?: string;
  approval?: string;
}

// ───────── 판단안 ─────────
export interface AssessmentView extends Assessment {
  /** aiMode === 'MOCK' (키 없음 · 호출 실패 · 거절 · 숫자 출처 위반 대체) */
  mock: boolean;
  toolCalls: ToolCallLog[];
  warnings: string[];
  fallbackReason: string | null;
  /** 숫자 출처 검증 결과 (AC-1-05) — 저장된 판단안은 항상 ok */
  provenance: ProvenanceResult;
  /** 이 판단안을 근거로 한 승인요청 */
  approvalRequestIds: string[];
}

/**
 * 기록된 실제 Claude 실행 (GET /api/assessments/recorded) — 시연에서 AI 를 다시 호출하지 않고 보여주는 재생.
 * 화면은 `실시간` · `모의` 가 아닌 별도 표지(예 `기록`)와 label 문구를 그대로 보인다. 운영 판단안(AssessmentView)과 섞지 않는다.
 */
export interface RecordedAssessmentView extends Omit<AssessmentView, 'aiMode'> {
  /** LIVE 가 아니다 — 그 실행은 실제 호출이었지만 지금 보이는 것은 기록의 재생 */
  aiMode: 'RECORDED';
}
export interface RecordedRunView {
  /** 기록 ID (REC-nnn) */
  id: string;
  aiMode: 'RECORDED';
  /** 정직한 표시 문구 — "실제 Claude 실행 기록(YYYY-MM-DD HH:MM, 모델) — 재생, 지금 호출하지 않음" */
  label: string;
  /** 항상 false — 이 응답을 만들 때 AI 를 호출하지 않았다 */
  calledNow: false;
  /** 항상 false — 운영 상태(판단안 목록 · 승인함 · 처리 이력)에 들어 있지 않다 */
  inOperationalState: false;
  /** 실제 호출 시작 · 종료 (UTC ISO) */
  executedAt: string;
  finishedAt: string;
  /** 실제 호출 시작 시각 KST 'YYYY-MM-DD HH:MM' */
  executedAtKst: string;
  /** 판단안 요청 1건의 실제 소요 시간(ms) = finishedAt − executedAt (도구 호출 왕복 포함) */
  durationMs: number;
  /** 도구 호출별 한 줄 요약 (호출 순서대로) — 상세 입력 · 출력은 assessment.toolCalls */
  toolCallSummaries: { name: string; actor: 'AI' | 'SYSTEM'; summary: string }[];
  model: string;
  /** 그 실행에서 AI 가 받은 것 — 시스템 지시 · 사용자 요청 · 도구 정의 (키 · 헤더 없음) */
  request: { sdk: string; thinking: string; effort: string; maxTokens: number; system: string; user: string; tools: { name: string; strict: boolean; description: string }[] };
  /** 그 실행의 입력 상태 — 재생한 사건 순서 · 가상 기준시각 · 저장소 */
  scenario: { steps: string[]; simNow: IsoDateTime; persistence: string; rawSource: string; invokedVia: string };
  /** 그 실행이 만든 판단안 전체 (문장 · 권고 · facts · ruleResults · toolCalls 입력/출력 · stopReason · aiTrace · provenance) */
  assessment: RecordedAssessmentView;
  /** 그 실행에서 실제로 이어진 승인요청과 처리 이력 (사본 — 지금 운영 상태가 아님) */
  followUp: { approvalRequests: ApprovalRequest[]; audit: AuditRowView[] };
  /** 기록의 근거가 지금 도메인 계산(같은 입력)과 일치하는가. ok 가 false 면 화면에 불일치 경고를 보인다 */
  basisCheck: { ok: boolean; replayedSteps: string; mismatches: string[] };
}
export interface RecordedRunsResponse {
  runs: RecordedRunView[];
}

export interface AssessmentCreateBody {
  subjectType: SubjectType;
  subjectIds: string[];
}

// ───────── 승인요청 ─────────
export interface ApprovalItemView {
  itemId: string;
  title: string;
  href: string;
  proposedDecision: string;
  proposedText: string;
  requested?: Money<'SAMPLE'>;
  grade?: 'CP_POSITIVE' | 'CP_NEGATIVE' | null;
  flags?: LineFlag[];
  status?: string;
}

export interface ApprovalView {
  request: ApprovalRequest;
  statusText: string;
  subjectText: string;
  subjectHref: string;
  items: ApprovalItemView[];
  daysLeft: number;
  level: DeadlineLevel;
  assessmentId: string | null;
  /**
   * 권고안의 출처 (BE-22). ASSESSMENT = 근거 판단안(규칙) 권고 그대로 · SUBMITTER = 상신자(계약 담당)가 판단안 권고와 다른 결정을 지정.
   * SUBMITTER 이면 화면에 "상신자 지정 — 판단안 권고와 다름" 을 보인다 (FE-16). 지정 사실은 요청 생성 이력 사유에도 남는다
   */
  proposedSource: 'ASSESSMENT' | 'SUBMITTER';
  /** 근거 판단안의 권고 결정 문구 (계약 요청만. 판단안이 없거나 권고 없음이면 null) — proposed 와 나란히 보여 차이를 드러낸다 */
  assessmentDecisionText: string | null;
  supersededBy: string | null;
  alerts: AlertView[];
  replies: { id: string; respondentRole: ApproverRole; outcome: string; reason: string; simAt: IsoDateTime; label: 'MOCK' }[];
  audit: AuditRowView[];
  contractDecisionAllowed: ContractDecision[] | null;
}

// ───────── 작업 ─────────
export interface TaskView extends Task {
  typeText: string;
  statusText: string;
  subjectHref: string;
}

// ───────── 분석 ─────────
export interface InfluencersView {
  rows: InfluencerPerfRow[];
  totals: { gmv: Money<'SAMPLE'>; spend: Money<'SAMPLE'>; cp: Money<'SAMPLE'>; realRoas: Num | null; nominalRoas: Num | null };
  remaining: { total: Money<'SAMPLE'>; shares: Record<string, Num> } | null;
  assumptions: string[];
}

export interface InventoryRowView {
  skuId: string;
  name: string;
  category: string;
  product: string;
  cover: Num | null;
  reported: Num;
  avg: Num;
  onHand: Num;
  inTransit: Num;
  minWeeks: number;
  maxWeeks: number;
  leadTimeWeeks: number;
  moq: number;
  belowMin: boolean;
  stockoutDate: IsoDate | null;
  pos: { id: string; qty: number; arrival: IsoDate }[];
  lines: string[];
}

export interface ReplenishmentSuggestionView {
  lineId: string;
  paymentDate: Txt;
  routing: { requiredRole: ApproverRole; reasons: RoutingReason[] };
  items: { skuId: string; target: Num; suggested: Num; finalQty: Num; unitCost: Money<'FULL'>; amount: Money<'FULL'> }[];
}

export interface ReplenishmentRowView extends ReplenishmentRequest {
  statusText: string;
  /** 보충 발주 금액 = finalQty × 기발주 단가 (AGGREGATED · FULL, A-17 · A-18) */
  amount: Money<'FULL'>;
  /** 기발주 단가 = amount_krw / order_qty (AGGREGATED · FULL) */
  unitCost: Money<'FULL'>;
  /** 예상 지급일 = 초안 생성일 + 25일 (ASSUMPTION, A-19) */
  paymentDate: Txt;
}

export interface InventoryView {
  rows: InventoryRowView[];
  suggestions: ReplenishmentSuggestionView[];
  /**
   * statusText 추가 (BE-13): 승인 거절 · SCM '불필요'로 종결 · SCM '보충 불가'로 종결 구분.
   * amount · unitCost · paymentDate (2026-11-14 추가): amountKrw · unitCostKrw · expectedPaymentDate 를 출처 · 스케일과 함께 (화면은 이것을 쓴다)
   */
  replenishments: ReplenishmentRowView[];
  simDate: IsoDate;
}

export interface CashRunView {
  id: string;
  windows: { start: IsoDate; end: IsoDate }[];
  businessDays: number;
  min: Money<'FULL'>;
  minDate: IsoDate;
  daily: { date: IsoDate; closingKrw: number }[];
  assumptionIds: string[];
}

export interface OfficialComparisonRowView {
  week: IsoDate;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  /** CLAIM — 재무팀 공식 전망 */
  official: Money<'FULL'>;
  /** AGGREGATED (A-08 · A-09 · A-32) */
  recalculated: Money<'FULL'>;
  /** 재전망 − 공식 (AGGREGATED) */
  diff: Money<'FULL'>;
  belowThreshold: boolean;
  belowDays: number;
  /** 최초 재전망(v1) 대비 이 행의 재전망 값 · 하회 영업일 수가 달라졌는가 — 화면 「② 이후 변경」. v1 기준 대조면 항상 false */
  changedFromV1: boolean;
  /** 달라졌을 때 v1 의 같은 주 재전망 값 (AGGREGATED), 아니면 null */
  v1Recalculated: Money<'FULL'> | null;
  /** 달라졌을 때 v1 의 하회 영업일 수, 아니면 null */
  v1BelowDays: number | null;
}

/** S-10 이벤트 표 1행 — 재전망 입력(AR 회수 · AP 지급 · 발주 대금). 제외 행도 사유와 함께 둔다 */
export interface CashEventRowView {
  id: string;
  kind: 'AR_INFLOW' | 'AP_OUTFLOW' | 'PO_PAYMENT';
  /** 표시 문구 (예 "AR MAR-0001 회수 · CH-02") */
  item: string;
  direction: 'IN' | 'OUT';
  /** 금액 (양수, 방향은 direction). AR 은 outstanding_krw */
  amount: Money<'FULL'>;
  /** 원본 만기 · 지급일 */
  sourceDate: IsoDate;
  /** 재전망에 놓인 영업일 (제외면 null) */
  date: IsoDate | null;
  included: boolean;
  excludedReason: string | null;
  /** 원본 파일 · 행 (row = 헤더 제외 1부터) · 행 키 */
  ref: SourceRef;
  /** ORIGINAL, 조건 변경(회수 지연)으로 날짜가 바뀐 행은 MOCK */
  label: SourceLabel;
  assumptionIds: string[];
}

export interface CashView {
  current: CashRunView & { opening: Money<'FULL'> };
  v1: CashRunView;
  /** 민감도 (연체 AR 제외 · 연체 AP 7/1 지급, A-08) — sensitivity=true 일 때 */
  sensitivity: CashRunView | null;
  /** 신규 보충 발주 등 추가 유출 시나리오 — 원본 전망분과 분리 (R-CASH-04) */
  extraOutflow: (CashRunView & { outflows: { id: string; date: IsoDate; amount: Money<'FULL'> }[] }) | null;
  covenant: Money<'FULL'>;
  poPayment: Money<'FULL'>;
  overrides: { ar: string; date: IsoDate; label: 'MOCK' }[];
  official: { week: IsoDate; closing: Money<'FULL'> }[];
  /** BE-10 공식 전망(주장) 대 재전망 주간 대조 — 선택한 버전(compareVersion) 기준 13행. 판단 입력 아님 */
  compareVersion: string;
  officialComparison: OfficialComparisonRowView[];
  largestGap: { week: IsoDate; diff: Money<'FULL'>; notes: Txt[] } | null;
  diffNotes: string[];
  /** diffNotes 와 같은 내용을 출처 라벨 · refs 와 함께 (공식 전망 CLAIM · 재전망 AGGREGATED · 원인 추정 INTERPRETED · 표본 제외 ORIGINAL) */
  diffNotesSourced: Txt[];
  /** S-10 이벤트 표 — 현재 재전망(current)의 입력 행. 포함분을 날짜별로 더하면 current.daily 종가가 재현된다 */
  cashEvents: CashEventRowView[];
  linesInWindow: { id: string; settlementDate: IsoDate; role: ApproverRole | null; status: string }[];
}

// ───────── 처리 이력 · 데이터 출처 ─────────

/** 처리 이력 1행 + 표시 문구 (2026-11-14 추가). 화면은 사유 문자열을 파싱하지 않고 이 문구를 쓴다 */
export interface AuditRowView extends AuditLogEntry {
  /** 이전 상태 한국어 (생성 행은 null) */
  fromText: string | null;
  toText: string;
  /**
   * 한 줄 문구. 보충요청 종결은 "SCM 검토: 불필요로 종결 (승인 거절 아님)" · "SCM 검토: 보충 불가로 종결 (승인 거절 아님)" · "승인 거절",
   * 생성은 "작업 생성: …" · "판단안 생성 ASM-…", 상태 유지는 "상태 유지: …", 재전망은 "재전망 교체 CF-v1 → CF-v2", 그 밖은 "{이전} → {이후}"
   */
  displayText: string;
}

/** GET /api/receivables — 회수 지연 양식(S-02)용 AR 목록 (fin_ar_aging_ms, FULL) */
export interface ReceivableView {
  id: string;
  channelId: string;
  invoiceDate: IsoDate;
  /** 원본 만기 (ORIGINAL) */
  originalDue: Txt;
  /** 현재 만기 — 회수 지연 사건이 있으면 그 날짜(MOCK), 없으면 원본 */
  currentDue: Txt;
  overridden: boolean;
  /** 청구 금액 amount_krw (ORIGINAL) */
  amount: Money<'FULL'>;
  /** 미회수 금액 outstanding_krw (ORIGINAL) — 재전망 유입에 쓰는 값 */
  outstanding: Money<'FULL'>;
  agingDays: number;
  /** 원본 만기가 기준일(7/1) 이전 — 재전망 기본 제외 (A-08) */
  overdue: boolean;
  /** 현재 재전망 유입에 들어가는가 */
  inForecast: boolean;
  ref: SourceRef;
}
export interface AuditFilters {
  entityType?: string;
  entityId?: string;
  actorKind?: ActorKind;
}

export type { GapStatus };

export interface RegistryView {
  sources: { file: string; rows: number; scale: string; label: SourceLabel; usedIn: string }[];
  assumptions: { id: string; text: string; reason: string; usedIn: string }[];
  /**
   * open: 원본 공백은 모의 회신으로 닫히지 않으므로 항상 true (BE-12).
   * status: OPEN(미확인) | FILLED_BY_MOCK(모의 회신으로 보완 — 원본 공백은 그대로), statusText 는 표시 문구.
   */
  gaps: { id: string; text: string; link: string; handling: string; open: boolean; status: GapStatus; statusText: string }[];
  claims: { text: string; ref: SourceRef }[];
  mocks: { key: string; outcome: string; label: 'MOCK' }[];
  inconsistencies: { topic: string; handling: string }[];
}

/** 이벤트 유형 목록 (S-02 양식) */
export type ApiEventType = EventType;
export type { Sourced };
