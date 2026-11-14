/**
 * 화면 데이터 경계 (2단계). 서버 컴포넌트(page.tsx · layout.tsx)는 이 파일의 함수만 호출한다.
 *
 * 조회는 백엔드 서비스(getService(), @/server/runtime)를 직접 부른다 — `/api/*` route 가 부르는 것과 같은 메서드라
 * 응답 모양(@/domain/api-types)이 같다. 자기 서버로 HTTP 를 한 번 더 돌지 않으므로 기준 URL · 쿠키 전달이 필요 없다.
 * 쓰기(회신 · 작업 · 사건 · 시점 이동 · 판단안 · 상신 · 보충요청 · 프리셋 초기화)는 클라이언트에서 `fetch('/api/…')` 로 한다
 * (components/mutation/api-client.ts) — 422 · 409 · 404 상태와 문구를 그대로 받기 위해서다(UI-04).
 *
 * 여기서는 계산하지 않는다. 응답을 그대로 넘기고, 없는 ID(404)는 null 로 바꿔 notFound() 를 쓸 수 있게 한다.
 */
import 'server-only';
import { cookies } from 'next/headers';
import type {
  ApprovalView,
  AssessmentView,
  AuditFilters,
  AuditRowView,
  CashView,
  ContractView,
  InfluencersView,
  InventoryView,
  MetaView,
  OverviewView,
  PresetInfo,
  ProposalFilters,
  ProposalView,
  ReceivableView,
  RegistryView,
  ScenarioCheckView,
  TaskView,
} from '@/domain/api-types';
import { DomainError } from '@/domain/errors';
import type { ActorRole } from '@/domain/types';
import { getService } from '@/server/runtime';

export type { ProposalFilters };

// ───────────────────────── 시연 세션 (역할) ─────────────────────────

export const ROLE_COOKIE = 'aoura-role';

export interface DemoRole {
  id: ActorRole;
  actorRole: ActorRole;
  label: string;
  /** 외부 상대(모의) 역할 — 회신은 MOCK 으로 기록된다 */
  mock: boolean;
}

/** SCREEN_SPEC 0-1 역할 전환 목록 — SCM 은 역할 하나(보충 검토 회신 · SCM 권한 승인 모두, FE-01) */
export const DEMO_ROLES: DemoRole[] = [
  { id: 'MARKETING_TEAM', actorRole: 'MARKETING_TEAM', label: '마케팅팀', mock: false },
  { id: 'MASIL_CEO', actorRole: 'MASIL_CEO', label: 'Masil 대표', mock: false },
  { id: 'GROUP_CEO_BOARD', actorRole: 'GROUP_CEO_BOARD', label: '그룹 CEO/이사회', mock: false },
  { id: 'SCM', actorRole: 'SCM', label: 'SCM', mock: false },
  { id: 'CONTRACT_OFFICER', actorRole: 'CONTRACT_OFFICER', label: '계약 담당', mock: false },
  { id: 'AGENCY', actorRole: 'AGENCY', label: '에이전시(모의)', mock: true },
];

export async function getSession(): Promise<{ role: DemoRole }> {
  const c = await cookies();
  const roleId = c.get(ROLE_COOKIE)?.value;
  // 1단계의 'SCM_REPLY' 쿠키는 SCM 하나로 합친다 (FE-01)
  const id = roleId === 'SCM_REPLY' ? 'SCM' : roleId;
  const role = DEMO_ROLES.find((r) => r.id === id) ?? DEMO_ROLES[0]!;
  return { role };
}

// ───────────────────────── 조회 (서비스 직접 호출) ─────────────────────────

/** 404(NOT_FOUND)만 null 로 바꾼다. 그 밖의 오류는 error.tsx 가 받는다 (숫자를 캐시로 대신 보여주지 않음) */
async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof DomainError && e.code === 'NOT_FOUND') return null;
    throw e;
  }
}

/** GET /api/meta */
export function getMeta(): Promise<MetaView> {
  return getService().meta();
}

/** GET /api/overview */
export function getOverview(): Promise<OverviewView> {
  return getService().overview();
}

/** GET /api/contracts/:id?terminateOn= */
export function getContract(id: string, terminateOn?: string): Promise<ContractView | null> {
  return orNull(getService().contract(id, terminateOn));
}

/** GET /api/proposals/:id?deadline&role&grade&status&flag&approval */
export function getProposal(id: string, f: ProposalFilters = {}): Promise<ProposalView | null> {
  return orNull(getService().proposal(id, f));
}

/** GET /api/assessments/:id */
export function getAssessment(id: string): Promise<AssessmentView | null> {
  return orNull(getService().assessment(id));
}

/** GET /api/assessments?subjectId= */
export function getAssessments(subjectId?: string): Promise<AssessmentView[]> {
  return getService().assessments(subjectId ? { subjectId } : {});
}

/** GET /api/approval-requests?role=&status= */
export function getApprovals(f: { role?: string; status?: string } = {}): Promise<ApprovalView[]> {
  return getService().approvals(f);
}

/** GET /api/approval-requests/:id */
export function getApproval(id: string): Promise<ApprovalView | null> {
  return orNull(getService().approval(id));
}

/** GET /api/tasks?role=&status= */
export function getTasks(f: { role?: string; status?: string } = {}): Promise<TaskView[]> {
  return getService().tasks(f);
}

/** GET /api/audit?entityType&entityId&actorKind — 행마다 표시 문구(fromText · toText · displayText) */
export function getAudit(f: AuditFilters = {}): Promise<AuditRowView[]> {
  return getService().audit(f);
}

/** GET /api/receivables — S-02 회수 지연 양식의 AR 선택 목록 */
export function getReceivables(): Promise<ReceivableView[]> {
  return getService().receivables();
}

/** GET /api/analytics/influencers?includeReference= */
export function getInfluencerRows(includeReference: boolean): Promise<InfluencersView> {
  return getService().influencers(includeReference);
}

/** GET /api/analytics/inventory */
export function getInventory(): Promise<InventoryView> {
  return getService().inventory();
}

/** GET /api/analytics/cash?version=v1|current&sensitivity= */
export function getCash(opts: { version?: 'v1' | 'current'; sensitivity?: boolean } = {}): Promise<CashView> {
  return getService().cash(opts);
}

/** GET /api/data-registry */
export function getRegistry(): Promise<RegistryView> {
  return getService().registry();
}

/** GET /api/scenarios */
export function getPresets(): PresetInfo[] {
  return getService().scenarios();
}

/** GET /api/scenarios/:id/check */
export function getScenarioCheck(id: string): Promise<ScenarioCheckView | null> {
  return orNull(getService().scenarioCheck(id));
}
