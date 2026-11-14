/**
 * 쓰기 행동의 역할 검사 (순수 함수) — CLAUDE.md 규칙 10 「권한 경계를 넘는 결정은 자동 확정하지 않는다」를 서버에서 강제한다.
 * 화면이 버튼을 막는 것과 별개로, API 를 직접 불러도 같은 규칙으로 거부한다. 거부는 422 FORBIDDEN_ROLE 이고 상태를 바꾸지 않는다.
 *
 * 기획 확정 표(ONTOLOGY 1-3 「쓰기 행위별 허용 역할」, A-35)의 서버 검사 대상만 여기서 막는다. 그 밖의 쓰기는 검사하지 않는다(A-36):
 *  - 작업 시작 · 완료 · 취소 = 작업의 담당 역할(ownerRole)만, 상위 권한자라도 담당이 아니면 불가(위임 규정 없음) — A-35, BE-17
 *  - 보충요청 초안 만들기 = SCM 만 — A-35, SCREEN_SPEC S-09
 *  - SCM 보충 검토 작업(REPLENISHMENT_REVIEW · SCM INFO_REQUEST)은 PATCH 완료 불가, SCM 보충 검토 회신으로만 닫음 — A-35, BE-18 (workflow.completeTask)
 *  - AI · 시스템은 사람 행동의 행위자가 될 수 없다 — ONTOLOGY 3-1 「AI 는 어떤 전이도 직접 일으키지 않는다」
 * 승인 회신의 역할 검사(R-AUTH-05)는 workflow.replyToApproval 에 있다(requiredRole · 건의 현재 권한자 두 겹, DD-013).
 */
import { DomainError } from './errors';
import { TASK_TYPE_KO } from './labels';
import { ROLE_KO, type ActorRole, type Task } from './types';

/** 사람(또는 사람이 입력하는 모의 상대)만 행동의 주체가 된다 */
const NON_HUMAN: readonly ActorRole[] = ['AI_AGENT', 'SYSTEM'];

export function assertTaskActor(task: Pick<Task, 'id' | 'type' | 'ownerRole'>, actorRole: ActorRole): void {
  if (NON_HUMAN.includes(actorRole)) {
    throw new DomainError('FORBIDDEN_ROLE', `권한 없음: ${ROLE_KO[actorRole]}은(는) 작업 상태를 바꿀 수 없습니다 (사람 담당 역할만)`, { taskId: task.id, ownerRole: task.ownerRole, actorRole });
  }
  if (task.ownerRole !== actorRole) {
    throw new DomainError(
      'FORBIDDEN_ROLE',
      `권한 없음: 이 작업은 ${ROLE_KO[task.ownerRole]}만 처리할 수 있습니다 (요청 역할 ${ROLE_KO[actorRole]} · 작업 ${task.id} ${TASK_TYPE_KO[task.type]}, A-35)`,
      { taskId: task.id, ownerRole: task.ownerRole, actorRole },
    );
  }
}

/** 보충요청 초안은 SCM 이 만든다 (SCREEN_SPEC S-09). 초안은 현금 약정이 아니지만 SCM 검토 · 승인 절차의 시작점이다 */
export function assertReplenishmentDrafter(actorRole: ActorRole): void {
  if (actorRole !== 'SCM') {
    throw new DomainError('FORBIDDEN_ROLE', `권한 없음: 보충 요청은 SCM 역할만 만들 수 있습니다 (현재 ${ROLE_KO[actorRole]})`, { requiredRole: 'SCM', actorRole });
  }
}
