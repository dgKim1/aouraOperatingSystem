/**
 * 화면용 응답 타입 — SCREEN_SPEC 4절 API 제안의 응답 모양을 따른다.
 * 2단계에서 백엔드가 API 응답 타입을 확정하면(types.ts 또는 별도 api 타입) 그쪽으로 옮기고 이 파일은 지운다.
 * 모든 값은 Sourced<T> 로 출처 · 스케일을 단다 (UI-01).
 */
import type {
  ActorRole,
  ApprovalRequest,
  ApprovalStatus,
  ApproverRole,
  AuditLogEntry,
  ContractDecision,
  ContractStatus,
  DeadlineLevel,
  IsoDate,
  IsoDateTime,
  LineFlag,
  LineStatus,
  Notice,
  NoticeReceipt,
  RoutingReason,
  RuleId,
  Sourced,
  SourceLabel,
  SourceRef,
  Task,
} from '@/domain/types';
import type { PresetInfo } from './world';

/** 금액 — 스케일을 타입에 묶는다. FULL 과 SAMPLE 은 서로 다른 타입 (R-SCALE-01 / UI-02) */
export type Money<S extends 'FULL' | 'SAMPLE' = 'FULL' | 'SAMPLE'> = Sourced<number> & { scale: S };
/** 금액이 아닌 수치 (비율 · 주 · 개수) */
export type Num = Sourced<number> & { scale: 'NONE' };
export type Txt = Sourced<string>;

export interface UnknownValue {
  gapId: string;
  note: string;
}

// ───────── 메타 (GET /api/meta) ─────────
export interface MetaView {
  workId: 'W02';
  simNow: IsoDateTime;
  aiMode: 'LIVE' | 'MOCK';
  model: string;
  cashForecastVersion: string;
  /** 1단계: 데이터는 도메인 함수 재생(미리보기). 2단계 API 연결 후 'API' */
  dataMode: 'PREVIEW' | 'API';
  preset: PresetInfo;
}

// ───────── 경고 (0-3) ─────────
export type AlertKind = 'AUTHORITY' | 'DEADLINE' | 'AUTO_RENEWAL' | 'CONTRACT_LINK' | 'INVENTORY' | 'CP_NEGATIVE' | 'NOTICE_UNCONFIRMED';
export type Severity = 'DANGER' | 'WARNING' | 'INFO';

export interface AlertView {
  id: string;
  kind: AlertKind;
  severity: Severity;
  title: string;
  detail: string;
  /** 다음 행동 — 누구에게 무엇을 */
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

// ───────── 운영 현황 (GET /api/overview) ─────────
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
  label: SourceLabel;
  href?: string;
}

export interface CovenantWindowView {
  forecastId: string;
  start: IsoDate;
  end: IsoDate;
  businessDays: number;
  current: boolean;
  source: Sourced<string>;
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
}

export interface ContractSummary {
  id: string;
  influencerName: string;
  status: ContractStatus;
  statusText: string;
  fixedFee: Money<'FULL'>;
  performanceFee: UnknownValue;
  noticeDeadline: Txt;
  daysLeft: number;
  level: DeadlineLevel;
  receiptConfirmed: boolean;
  receiptText: string;
  autoRenewed: boolean;
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
  recentAudit: AuditLogEntry[];
  received: boolean;
}

// ───────── 전속계약 (GET /api/contracts/:id) ─────────
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
  /** includeReference 일 때만 */
  cpRefDef14?: Money<'SAMPLE'>;
  realRoasRefDef14?: Num | null;
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
  audit: AuditLogEntry[];
  approvals: ApprovalRequest[];
  consequences: { renewed: boolean; renewalStart: IsoDate; renewalEnd: IsoDate; committed: Money<'FULL'> | null };
  penaltyPreview: { terminateOn: IsoDate; remainingMonths: number; amount: Money<'FULL'> } | null;
  openGaps: string[];
  assessmentId: string | null;
}

// ───────── 확대 기안 (GET /api/proposals/:id) ─────────
export interface CostStep {
  key: string;
  name: string;
  amount: Money<'SAMPLE'>;
  /** 이 단계가 빼는 금액인가 */
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

// ───────── 승인 (GET /api/approval-requests) ─────────
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
  subjectText: string;
  subjectHref: string;
  items: ApprovalItemView[];
  daysLeft: number;
  level: DeadlineLevel;
  assessmentId: string | null;
  supersededBy: string | null;
  alerts: AlertView[];
  replies: { id: string; respondentRole: ApproverRole; outcome: string; reason: string; simAt: IsoDateTime; label: 'MOCK' }[];
  audit: AuditLogEntry[];
  contractDecisionAllowed: ContractDecision[] | null;
}

// ───────── 작업 ─────────
export interface TaskView extends Task {
  typeText: string;
  subjectHref: string;
}

// ───────── 데이터 출처 (GET /api/data-registry) ─────────
export interface RegistryView {
  sources: { file: string; rows: number; scale: string; label: SourceLabel; usedIn: string }[];
  assumptions: { id: string; text: string; reason: string; usedIn: string }[];
  gaps: { id: string; text: string; link: string; handling: string; open: boolean }[];
  claims: { text: string; ref: SourceRef }[];
  mocks: { key: string; outcome: string; label: 'MOCK' }[];
  inconsistencies: { topic: string; handling: string }[];
}
