# 설계 결정 (Design Decisions)

> 기록: 개발 기록 담당(`aoura-recorder`). 형식과 규칙은 [README.md](README.md).
> 같은 결정이 바뀌면 이 항목을 고치지 않고 새 ID 를 만들며, 이전 항목 상태를 "대체됨 → DD-xxx" 로 바꾼다.
> 근거 문서가 이 기록과 다르면 근거 문서가 기준이다(CLAUDE.md "문서와 코드가 다르면 문서가 기준").

---

## DD-001 Next.js 풀스택 한 저장소
- 날짜 · 영역 · 상태: 2026-11-12 · 구조 · 채택
- 맥락: 승인 요청 · 상태 변경 · 처리 이력이 실제로 돌아야 한다(PROBLEM 완료 조건 1). 정적 사이트로는 불가능하므로 서버와 DB 가 필요했다.
- 결정: **Next.js (App Router) + TypeScript** 한 저장소 · 한 서비스로 화면과 API 를 함께 만든다. DB 는 axhub 앱 전용 Postgres + Drizzle, 화면은 Tailwind + shadcn/ui + Recharts, 검증은 Vitest + `tsc --noEmit` + ESLint.
- 이유: 화면과 API 가 같은 온톨로지 타입(`app/src/domain/types.ts`)을 공유해 역할이 나뉘어도 계약이 어긋나지 않는다. axhub 공식 템플릿 경로(Next.js) · Node 22 Dockerfile 로 배포가 단순하다. — [TECH_STACK 1절 · 2-1](../TECH_STACK.md), 커밋 `e7f58ab`
- 버린 대안: Next.js + FastAPI 분리 — 데이터 분석은 편하지만 compose 배포 · 서비스 두 개 · 타입 중복이 생겨 기각.
- 영향: `app/` 전체 구조([TECH_STACK 4절](../TECH_STACK.md)), 공유 타입 `app/src/domain/types.ts`(백엔드 소유).

## DD-002 계산은 코드, 해석은 AI
- 날짜 · 영역 · 상태: 2026-11-12 · 구조(규칙 · AI 경계) · 채택
- 맥락: 과제는 "원본의 생산능력 · 계약 · 승인 제약을 가정으로 없애면 안 된다", "유리한 회신만 만드는 것으로 검증을 대신할 수 없다"고 요구한다. AI 가 숫자를 만들면 이 요구를 보장할 수 없다.
- 결정: 승인 권한 구간(1천만 · 1억 · 10억), 미통보 = 체결, 기한 경과 = 자동 확정, covenant 우선, 실질 공헌이익, 재고 커버는 **결정적 TypeScript 순수 함수**(`app/src/domain/`)로 계산하고 단위 테스트로 고정한다. AI 는 접수 문서 해석 · 도구로 근거 조회 · 판단안/대안 작성 · 주장/사실 구분 · 통보문 초안만 맡는다. AI 출력의 숫자는 도구가 돌려준 값만 쓴다. 최종 결정은 사람(권한자, 모의 회신), 상태 변경은 도구(코드).
- 이유: [CLAUDE.md](../../CLAUDE.md) 절대 규칙 7 · 9 · 10, [TECH_STACK 2-2](../TECH_STACK.md), [PROBLEM.md](../PROBLEM.md). 커밋 `e7f58ab`
- 버린 대안: AI 가 계산까지 하는 방식 — 숫자 검증 · 재현이 불가능해 기각(문서에 대안으로 명시되진 않음 · 원칙에서 도출).
- 영향: `app/src/domain/` 규칙 엔진 · 상태 머신, 규칙 ID(R-AUTH-* · R-DL-* · R-CP-* · R-INV-* · R-CASH-*)를 테스트 이름에 그대로 쓴다([ONTOLOGY 4절](../ONTOLOGY.md)).

## DD-003 런타임 AI는 단일 에이전트 + tool use (multi-agent 아님)
- 날짜 · 영역 · 상태: 2026-11-12 · AI · 채택
- 맥락: 업무 흐름(BPMN W02: 접수 → 취합 → 조건 확인 → 승인 분기 → 통보 → 기록)이 이미 정해져 있고, 오판 비용이 크다(연 28억 자동 갱신).
- 결정: 흐름 · 상태 · 권한은 **상태 머신 코드가 통제**하고, 각 단계의 해석만 **단일 에이전트**가 도구 호출로 수행한다. `@anthropic-ai/sdk`, 모델 `claude-opus-5-5`, thinking `adaptive`, 도구 스키마 `strict: true`, `stop_reason`(`refusal` 포함) 확인. 키가 없거나 호출 실패 시 **모의(mock) 모드**로 동작하고 화면에 `모의` 표시. 마케팅 · 재무 · 계약 관점은 판단안 안의 관점별 근거 항목으로 보여준다.
- 이유: 한 에이전트 + 결정적 규칙 + 사람 승인이 여러 에이전트 합의 구조보다 검증 · 설명이 쉽다. 과제는 multi-agent 를 강제하지 않고 구조 선택의 이유를 요구한다. — [TECH_STACK 2-3 · 2-4](../TECH_STACK.md), 커밋 `e7f58ab`
- 버린 대안: 관점별 multi-agent(마케팅 · 재무 · 계약 에이전트 합의). 확장 여지로 "검토 에이전트"(근거 누락 · 주장 혼동 점검)를 2단계에 추가할 수 있게 남김.
- 영향: `app/src/server/` AI 에이전트 · 도구(백엔드 2단계), 헤더 · 판단안 `모의` 배지(SCREEN_SPEC UI-06).

## DD-004 배포를 axhub docker 방식으로 전환
- 날짜 · 영역 · 상태: 2026-11-12 · 배포 · 채택
- 맥락: 서버 · DB 가 필요한 앱(DD-001)이므로 기존 static 배포로는 돌릴 수 없다.
- 결정: axhub lounge · self-hosted 저장소 push · **docker** 방식. 2026-11-12 사용자 승인으로 전환(되돌릴 수 없음). `axhub.yaml` 은 Next.js 골격과 함께 `deploy_method: docker` · `root: app` · `database: engine: postgres` 로 바꾸고, 그 전에는 push 하지 않는다. `axhub up` 은 쓰지 않는다.
- 이유: [TECH_STACK 1절 · 5절](../TECH_STACK.md), [DEPLOY 1절](../DEPLOY.md), [CLAUDE.md](../../CLAUDE.md) 절대 규칙 4. 커밋 `9d15b6f`
- 버린 대안: static 유지(서버 불가), `axhub up` 업로드 배포(규칙상 금지).
- 영향: `axhub.yaml`(아직 static — 후속), `app/next.config.ts` 의 `output: 'standalone'`(LOG-001 참조), `ANTHROPIC_API_KEY` 는 secret · runtime 으로 등록(커밋 `d1d17ce`, 값은 기록하지 않음).

## DD-005 개발 하네스 — 역할 에이전트 · 피드백 루프 · 소유 영역 분리
- 날짜 · 영역 · 상태: 2026-11-12(기록 역할은 2026-11-13 추가, DD-010) · 하네스 · 채택
- 맥락: 여러 역할이 한 저장소를 동시에 고치므로 책임 경계와 "완료"의 기준이 필요했다.
- 결정:
  - 공통 규칙은 루트 `CLAUDE.md`, 기준 문서는 `docs/`.
  - 역할 에이전트 4개(`~/.claude/agents/`): 기획 `aoura-planner`(`docs/`, devlog 제외) · 백엔드 `aoura-backend`(`app/src/domain/` `app/src/server/` `app/drizzle/` `app/scripts/` `app/src/app/api/`) · 프론트엔드 `aoura-frontend`(`app/src/app/` api 제외, `app/src/components/`) · 기록 `aoura-recorder`(`docs/devlog/`).
  - 남의 영역은 직접 고치지 않고 무엇을 왜 바꿔야 하는지 보고한다. 공유 타입 `types.ts` 는 백엔드 소유.
  - 피드백 루프 `npm run check`(= typecheck + lint + test). 통과 못 하면 완료가 아니다.
- 이유: [TECH_STACK 3절](../TECH_STACK.md), [CLAUDE.md](../../CLAUDE.md) "역할과 소유 영역" · "완료 기준". 커밋 `e7f58ab`
- 버린 대안: 단일 세션이 모든 영역을 직접 수정 — 소유 경계 · 검수가 흐려져 채택하지 않음 **(추정: 문서에 대안이 명시되지 않음)**.
- 영향: `app/package.json` 의 `check` 스크립트(LOG-001), 각 에이전트 보고 → 기록 흐름([README 3절](README.md)).

## DD-006 실질 공헌이익 공식값 = A05 5절 단일 차감 (1.4 문자 그대로는 참고값)
- 날짜 · 영역 · 상태: 2026-11-13 · 계산 규칙 · 채택
- 맥락: `00_common/calculation_definitions.md` 1.4 를 문자 그대로 쓰면 Net Revenue 에서 이미 뺀 반품환불과 "쿠폰 반영 후" GMV 의 쿠폰을 다시 뺀다(이중 차감). A05 5절은 "동일 주문에 대해 쿠폰과 환불을 다시 차감하지 않습니다"라고 한다. 2026-11-12 이 충돌을 확인했다.
- 결정 (2026-11-13 사용자 결정):
  - **공식값 R-CP-01** = Net Revenue − COGS − Marketing Spend − Channel Fee − Fulfillment − Return Logistics (각 비용 1회 차감).
  - **참고값 R-CP-02** = 1.4 문자 그대로(이중 차감). 비교용으로만 계산 · 표시하고 판단 · 권고 · 순위에 쓰지 않는다.
  - **권고 등급 R-CP-05** 는 공식 cp 의 **부호만** 본다(cp ≤ 0 → `CP_NEGATIVE`, cp > 0 → `CP_POSITIVE`). 참고값과 부호가 다르면 `CP_REF_SIGN_DIFFERS` 참고 칩만 단다(등급 불변). 해당: INF-003 · INF-007, PLAN-006 · 008 · 010 · 011 · 012.
- 이유: A05 1절(이번 지침이 원본 폴더의 이전 안내에 우선) · A01 4절 · A01 8절("데이터 해석과 원본 별첨의 충돌은 A05 데이터 이용 기준을 따른다") [원본근거해석]. — [W02_TASK 3-4](../W02_TASK.md), [ONTOLOGY 4-3](../ONTOLOGY.md), 커밋 `602a5c2`
- 버린 대안: 1.4 문자 그대로를 공식값으로 쓰기(이중 차감, A05 와 충돌) · 회의록(재무팀) 산식 — [주장]이며 COGS 가 빠져 있음.
- 영향: 도메인 함수 R-CP-01~06 과 골든 값([DEMO_SCENARIOS 부록 A](../DEMO_SCENARIOS.md)), 화면 UI-10(공식값만 주 값, 참고값은 접힘 · 보조 열), `types.ts` 의 `CpGrade`. 비용 가정 A-01~A-04 가 바뀌면 골든 값도 바뀐다.

## DD-007 시연 범위 = ①~④ 전부 필수
- 날짜 · 영역 · 상태: 2026-11-13 · 범위 · 채택
- 맥락: 완료 조건 2(세 가지 상황) 외에 확장(E1 · E2)과 부서 영향(D1 · D2)을 어디까지 시연할지 정해야 했다.
- 결정 (2026-11-13 사용자 결정): ① 정상 · ② 조건 변경 · ③ 정보 부족 + 거절(A · B 분기 모두) · ④ 확장 · 부서 영향(PLAN-011 재고 게이트)을 **모두 필수**로 시연한다. 권장 순서 ①→②→③(A·B)→④.
- 이유: 완료 조건 5개를 상황별로 빠짐없이 덮기 위해 — [DEMO_SCENARIOS 0절 · 0-1](../DEMO_SCENARIOS.md), [PROBLEM.md 4절](../PROBLEM.md). ④는 ②의 재전망 결과를 그대로 쓴다.
- 버린 대안: ①~③만 필수, ④는 선택 — 이전 문서 표현("시연 3상황")에서 확대됨.
- 영향: 시나리오 테스트 4개(+ ③ 분기 2개), `/scenarios` 프리셋 4개(SCREEN_SPEC S-13), 골든 값 부록 A.

## DD-008 백엔드 1단계 = 골격 · 타입 · 원본 로더 · 도메인 순수 함수 · 골든 값 테스트 (테스트 먼저)
- 날짜 · 영역 · 상태: 2026-11-13 · 백엔드 진행 순서 · 채택
- 맥락: DB · API · AI · 화면이 모두 계산 결과에 의존한다. 무엇부터 만들지 정해야 했다.
- 결정: 1단계는 Next.js 골격 · 공유 타입(`types.ts`) · 원본 CSV 읽기 전용 로더 · 도메인 순수 함수 · 골든 값 테스트. **테스트를 먼저 쓰고 실패를 확인한 뒤 구현**한다. DB(Drizzle) · API · AI 에이전트는 2단계.
- 이유: 계산 규칙을 테스트로 먼저 고정해야 화면과 AI 가 그 값만 쓸 수 있다 — [CLAUDE.md](../../CLAUDE.md) 절대 규칙 9, 골든 값 [DEMO_SCENARIOS 부록 A](../DEMO_SCENARIOS.md). 출처: 메인 세션 지시(문서화된 절 없음).
- 버린 대안: DB 스키마 · API 부터 만들기 — 계산 규칙이 고정되기 전에 계약이 굳어 재작업 위험 **(추정)**.
- 영향: `app/src/domain/` · `app/src/server/raw/` · `app/tests/unit/` · `app/tests/scenarios/`. 진행 상황은 [2026-11-13 LOG-001](2026-11-13.md).

## DD-009 프론트엔드 시작 시점 = 백엔드 골격과 types.ts 완료 뒤
- 날짜 · 영역 · 상태: 2026-11-13 · 하네스(작업 순서) · 채택
- 맥락: 프론트엔드와 백엔드가 같은 `app/` 을 동시에 만들면 설정 파일과 공유 타입이 충돌한다.
- 결정: 프론트엔드는 백엔드 골격(`package.json` · Tailwind 설정 등)과 `types.ts` 가 끝난 뒤 시작한다. 그 전까지(그리고 API 가 생기기 전까지) 화면은 [SCREEN_SPEC 4절](../SCREEN_SPEC.md) 형태의 모의 데이터를 쓴다.
- 이유: `package.json` · Tailwind 설정 충돌 방지, 공유 타입을 추측하지 않기 위해(공유 타입은 백엔드 소유 — [CLAUDE.md](../../CLAUDE.md) "역할과 소유 영역"). 출처: 메인 세션 지시.
- 버린 대안: 프론트엔드 동시 시작 — 설정 · 타입 충돌로 기각.
- 영향: 프론트엔드 첫 작업은 `types.ts` 기준 모의 데이터 + SCREEN_SPEC 화면. 모의 데이터는 화면에 `모의` 표시 필요.

## DD-010 개발 기록 에이전트 도입
- 날짜 · 영역 · 상태: 2026-11-13 · 하네스 · 채택
- 맥락: 제출 설명서와 심사에서 "무엇을 왜 이렇게 만들었는가"를 따라갈 수 있어야 한다. 백엔드 · 프론트엔드 보고는 세션이 끝나면 흩어진다.
- 결정: 기록 에이전트 `aoura-recorder` 를 추가한다. 정의 파일은 `~/.claude/agents/aoura-recorder.md`(프로젝트 `.claude/` 는 수정 금지라서), 기록 위치는 `docs/devlog/`(작업 기록 LOG · 설계 결정 DD). 코드 · 다른 문서는 읽기만 한다. 기획의 소유 영역에서 `docs/devlog/` 를 뺐다.
- 이유: [CLAUDE.md](../../CLAUDE.md) 절대 규칙 1(`.claude/` 수정 금지), [TECH_STACK 3절](../TECH_STACK.md)(역할 분담 · 개발 기록 행). 해당 문서 변경은 작업 트리에 미커밋 상태로 있음(2026-11-13 05:23 기준).
- 버린 대안: 각 에이전트가 직접 기록 · 커밋 메시지로만 기록 — 의도 · 대안 · 검증이 한곳에 모이지 않음 **(추정)**.
- 영향: `docs/devlog/` 3종 파일, 갱신 절차 [README 3절](README.md).

## DD-011 상태 모델 = 순수 리듀서 (WorldState, 입력) → 결과
- 날짜 · 영역 · 상태: 2026-11-13 · 상태 전이 · 채택
- 맥락: 시연 프리셋 4개(DD-007)를 언제든 같은 결과로 다시 만들어야 하고, 실패한 처리가 상태를 반쯤 바꿔 놓으면 안 된다.
- 결정: 업무 함수는 `(WorldState, 입력) → {state, transitions, createdTasks, createdApprovals, routingChanges, event}` 형태의 순수 리듀서다. 입력 상태는 `structuredClone` 으로 복사해 바꾸지 않는다. 프리셋 = 초기화 → 이벤트 재생. DB(2단계)는 결과의 **영속화만** 맡는다(DB → WorldState → workflow → 트랜잭션 저장).
- 이유: 프리셋 재생의 결정성([DEMO_SCENARIOS 1절](../DEMO_SCENARIOS.md)), 실패 시 상태 불변(AC-1-07). DD-002 · DD-008 과 같은 방향(계산 · 전이를 DB 없이 테스트). 출처: 에이전트 보고.
- 버린 대안: 클래스 · 가변 객체 상태 — 재생 · 롤백이 어려워 기각.
- 영향: `app/src/domain/workflow.ts`, `app/tests/scenarios/`, 2단계 services 계층 · `load-raw.ts`(시나리오 초기화 = 운영 테이블 비우고 이벤트 재생).

## DD-012 모든 상태 전이는 Tx 헬퍼 한 곳에서 — 전이표 확인 + audit 일원화
- 날짜 · 영역 · 상태: 2026-11-13 · 상태 전이 · 이력 · 채택
- 맥락: 상태 변경마다 "누가 · 어떤 규칙으로 · 왜" 남아야 하고(완료 조건 1 · 처리 이력), 허용되지 않은 전이는 막아야 한다.
- 결정: 모든 전이는 Tx 헬퍼 한 곳을 거친다. 헬퍼는 전이표(`CONTRACT/LINE/REPLENISHMENT_TRANSITIONS`)를 assert 하고(위반 시 409 `INVALID_TRANSITION`), audit 행(`actorRole` · `actorKind` · `ruleIds` · `eventId` · `reason` · `snapshot`)을 반드시 남긴다. audit `createdAt` 도 `simNow` 를 쓴다(결정성). 실제 시각은 2단계 DB 에서 남긴다.
- 이유: [ONTOLOGY 3절](../ONTOLOGY.md)(상태 머신 · AuditLog), [SCREEN_SPEC 4절](../SCREEN_SPEC.md) 오류 형식. 출처: 에이전트 보고.
- 버린 대안: 업무 함수마다 개별로 상태를 바꾸고 이력을 남기기 — 누락 위험 **(추정: 보고에 대안으로 명시되지 않음)**.
- 영향: `app/src/domain/workflow.ts` · `errors.ts`, 화면 S-11 처리 이력.

## DD-013 R-AUTH-05 회신 권한 두 겹 확인
- 날짜 · 영역 · 상태: 2026-11-13 · 권한 · 채택
- 맥락: 조건 변경(②)으로 권한자가 상향된 뒤에도 옛 승인 요청이 남아 있을 수 있다. 하위 권한자가 그 옛 요청에 회신하면 권한 경계를 넘는 결정이 확정된다(CLAUDE.md 절대 규칙 10).
- 결정: 회신 시 ① 요청의 `requiredRole` 과 회신자 역할을 확인하고 ② 건별 **현재 라우팅 권한자 서열**도 다시 확인한다. 하나라도 맞지 않으면 422 `FORBIDDEN_ROLE`.
- 이유: R-AUTH-05([ONTOLOGY 4-1](../ONTOLOGY.md)), DEMO ② 권한 상향. 출처: 에이전트 보고.
- 버린 대안: 요청의 `requiredRole` 만 확인 — 권한 상향 뒤 남은 옛 요청 경로를 막지 못함.
- 영향: `app/src/domain/authority.ts` · `workflow.ts`(`replyToApproval`), 화면 UI-04(422 문구 그대로 표시).

## DD-014 R-AUTH-06 재라우팅은 계획/적용 분리 + RESUBMIT_PENDING 신설
- 날짜 · 영역 · 상태: 2026-11-13 · 권한 · 상태 전이 · 채택(기획 문서 반영 대기)
- 맥락: 자금 재전망 등으로 권한자가 바뀌면 건의 현재 상태(승인됨 · 대기 중 · 기한 경과 등)에 따라 처리가 달라야 한다. 대기 중인 건의 권한이 올라가는 경우는 문서에 정의가 없었다.
- 결정: `rerouteAll` 이 처리 방식을 **결정**(계획)하고 workflow 가 **적용**한다. 처리 방식: `REAPPROVAL_REQUIRED` · `POST_DEADLINE_REPORT` · `KEEP_HIGHER_APPROVAL` · `RESUBMIT_PENDING` · `ROUTING_UPDATED`. `RESUBMIT_PENDING` = 승인 대기 중인 건의 권한이 상향되면 옛 요청을 `SUPERSEDED` 로 닫고 새 권한자에게 재상신.
- 이유: R-AUTH-06([ONTOLOGY 4-1](../ONTOLOGY.md)), DEMO ② · AC-2-03. 계획을 순수 함수로 떼어 테스트 가능하게 함 **(추정)**. `RESUBMIT_PENDING` 은 **백엔드가 정한 것** — 출처: 에이전트 보고.
- 버린 대안: 보고에 명시 없음.
- 영향: `app/src/domain/authority.ts` · `workflow.ts`. **확인 필요**: 기획 문서 반영 필요 6번(R-AUTH-06 대기 건 상향 처리).

## DD-015 금액은 브랜드 타입 Krw<'FULL'|'SAMPLE'> + 런타임 assert
- 날짜 · 영역 · 상태: 2026-11-13 · 타입 · 채택
- 맥락: 표본(SAMPLE)과 풀스케일(FULL) 금액을 더하거나 곱하면 안 된다(CLAUDE.md 절대 규칙 8, R-SCALE-01).
- 결정: 금액은 `number` 에 스케일 브랜드를 붙인 `Krw<S>` 로 다루고, 같은 스케일끼리만 더하는 함수(`plus` · `sumKrw` · `addKrw`)를 둔다. `addKrw` 는 런타임에서도 스케일을 확인해 `ScaleMixError` 를 던진다. 표본 비율을 풀스케일 금액에 곱하는 함수는 두지 않는다. `plus` 는 `NoInfer` 로 FULL + SAMPLE 을 타입 오류로 만든다(`scale.test.ts` 가 찾은 버그 수정).
- 이유: R-SCALE-01, [TECH_STACK 2-5](../TECH_STACK.md). 출처: 에이전트 보고 · `app/src/domain/money.ts` 주석.
- 버린 대안: 값 객체 `{value, scale}` — 직렬화 · API 응답이 무거워짐.
- 영향: `app/src/domain/money.ts` · `types.ts`, `app/tests/unit/scale.test.ts`. 화면 UI-02(표본 · 풀스케일 합계 금지)와 같은 규칙.

## DD-016 기안 건 권고(recommendLine)는 규칙 기반 — AI 가 아님
- 날짜 · 영역 · 상태: 2026-11-13 · 계산 규칙 · AI 경계 · 채택
- 맥락: 승인 · 부결 · 조건부 권고가 시연의 핵심 판단이다. 이걸 AI 가 내면 재현 · 검증이 안 된다.
- 결정: `recommendLine` 은 결정적 규칙: `CP_NEGATIVE` → 부결, 재고 게이트 품절 예상 → 조건부, `NO_SUPPLY` → 부결, 그 외 → 승인. `inventoryGate:false` 옵션은 테스트 전용(AC-4-03, 재고 게이트가 없을 때와 비교). AI(2단계)는 이 권고와 근거를 문장으로 설명한다.
- 이유: [CLAUDE.md](../../CLAUDE.md) 절대 규칙 9, DD-002, R-CP-05 · R-INV-03. 출처: 에이전트 보고.
- 버린 대안: 권고를 AI 에 맡김 — 절대 규칙 9 위반.
- 영향: `app/src/domain/workflow.ts`, `app/tests/scenarios/s4-inventory-scm.test.ts` **(추정: 파일명 기준)**, 2단계 AI 에이전트 도구.

## DD-017 의존성 버전 선택 — TypeScript 5.9 · ESLint 9
- 날짜 · 영역 · 상태: 2026-11-13 · 라이브러리 · 채택
- 맥락: 골격 작성 시 최신 주 버전을 쓸지 정해야 했다.
- 결정: next 16.4 · react 19.3 · typescript 5.9 · eslint 9 · vitest 5.1 · tailwind 4.3 · drizzle-orm/kit · pg · `@anthropic-ai/sdk` 1.8 · tsx.
- 이유: TypeScript 7 은 Next 타입 검사와의 호환이 불확실하고, ESLint 10 은 플러그인 peer 의존성 위험이 있다. 출처: 에이전트 보고.
- 버린 대안: TypeScript 7 · ESLint 10.
- 영향: `app/package.json` · `package-lock.json`. 프론트엔드의 shadcn/ui 초기화도 이 버전 위에서 한다.

## DD-018 공헌이익 구현 방식 — 정수 누적 반올림 · 참고값 파생 · 등급 입력 제한
- 날짜 · 영역 · 상태: 2026-11-13 · 계산 규칙 · 채택 (DD-006 의 구현)
- 맥락: DD-006 공식값 · 참고값을 코드로 옮길 때 부동소수 오차와 "참고값이 판단에 새어 들어가는 것"을 막아야 했다.
- 결정:
  - 채널수수료는 `gmv × round(pct×10)` 를 정수로 누적한 뒤 그룹 합계에서 **한 번** half-up 반올림(A-02).
  - 참고값 `cpRefDef14 = cp − 쿠폰 − 환불` 로 공식값에서 파생하고, "공식 − 참고 = 쿠폰 + 환불"을 테스트로 고정.
  - `cpGrade` 는 타입상 `{cp}` 만 받아 참고값을 읽을 수 없다(AC-1-03b).
- 이유: A-02(소수 경계 오차 방지), R-CP-01 · R-CP-02 · R-CP-05, 화면 UI-10. 출처: 에이전트 보고.
- 버린 대안: 보고에 명시 없음.
- 영향: `app/src/domain/performance.ts`, `app/tests/unit/performance.test.ts`. 골든 값 A-1 · A-2 일치(LOG-002).

## DD-019 화면 데이터 경계 — views.ts = API 계약, 프리셋은 도메인 함수 재생
- 날짜 · 영역 · 상태: 2026-11-13 · 화면 · API 계약 · 채택(2단계에 API 로 교체)
- 맥락: 프론트엔드는 API(백엔드 2단계)보다 먼저 시작했다(DD-009). 그 사이에도 상태 변화(②·③-B·④)를 보여야 하고, 숫자를 화면이 만들어 내면 안 된다(CLAUDE.md 절대 규칙 9).
- 결정: 화면은 `app/src/app/_data/views.ts` **한 모듈만** 부른다. 함수 1개 = SCREEN_SPEC 4절 API 1개, 반환 모양 = 그 API 응답. 지금은 `world.ts` 가 시연 프리셋 10개를 백엔드 `workflow` · 모의 회신으로 **재생**해 값을 만든다(캐시만 · 저장 안 함). 2단계에는 함수 몸통만 `fetch('/api/…')` 로 바꾸고 `world.ts` 를 지운다.
- 이유: 화면 숫자가 전부 백엔드 코드 산출 → 1단계에서도 상태 변화 시연 가능, API 전환 지점이 한 곳. 출처: 에이전트 보고.
- 버린 대안: ① 페이지에서 도메인 함수 직접 호출 — 경계가 흩어져 API 전환이 어려움 ② 정적 JSON 목업 — ②·③-B·④ 상태 변화를 표현 못 하고 숫자 날조 위험.
- 영향: `app/src/app/_data/{views,world,types,registry}.ts`. 응답 타입(`_data/types.ts`)은 백엔드 소유 위치로 이전 · 확정 요청 중, `views.ts` 의 집계 일부(기한별 합계 · 경고 · 자동 갱신 위험 등)는 API 로 옮길 대상(LOG-004 백엔드 요청 ③ · ④).

## DD-020 화면 상태 관리 — 쿠키 + 서버 액션, 클라이언트 전역 상태 없음
- 날짜 · 영역 · 상태: 2026-11-13 · 화면 · 채택
- 맥락: 역할(권한자) 전환 · 프리셋 전환을 어떻게 화면에 반영할지, 권한 비교를 어디서 할지 정해야 했다.
- 결정: 역할 · 프리셋은 쿠키에 두고 서버 액션(`_actions/session.ts`)으로 바꾼 뒤 서버에서 다시 렌더한다. 클라이언트 전역 상태는 두지 않는다. 탭 · 필터는 URL 쿼리(JS 없이 동작, 링크 공유 가능). 클라이언트 컴포넌트는 팝오버 · 드로어 · 회신 폼 · 선택에만. 권한 비교도 서버 렌더 때 결정하고, 최종 판정은 2단계 서버 422.
- 이유: UI-05 "회신 후 서버 재조회로 갱신"과 같은 구조, UI-04 · DD-013(권한 판정은 서버). 출처: 에이전트 보고.
- 버린 대안: 클라이언트 전역 상태 스토어 — 보고에 "없음"으로 명시, 기각 이유는 위 구조 일치 **(추정)**.
- 영향: `app/src/app/_actions/session.ts`, `components/shell/role-switcher`, 모든 페이지가 서버 컴포넌트.

## DD-021 값 컴포넌트는 Sourced 타입만 받는다 — 출처 배지 · 주장 숨김을 타입으로 강제
- 날짜 · 영역 · 상태: 2026-11-13 · 화면 · 타입 · 채택
- 맥락: 모든 숫자에 출처 · 스케일 배지가 있어야 하고(UI-01, CLAUDE.md 절대 규칙 5), 주장 값은 「주장 · 참고」 영역에만 있어야 한다(UI-03, 규칙 6).
- 결정: 금액 · 수치 · 문구 값 컴포넌트는 `Sourced<T>` 만 받는다(배지 없는 숫자를 그릴 방법이 없음). 주장 숨김도 컴포넌트(접힘)가 강제한다. 금액은 `Money<'FULL'|'SAMPLE'>` 로 스케일을 구분한다(DD-015 의 화면 쪽 대응).
- 이유: UI-01 · UI-02 · UI-03 을 리뷰가 아니라 타입 단계에서 막기 위해. 출처: 에이전트 보고.
- 버린 대안: 보고에 명시 없음.
- 영향: `app/src/components/badges/*`(source-badge · scale-badge · values · fold), `app/src/app/_data/types.ts`.

## DD-022 차트는 서버 렌더 SVG — Recharts 제외 (TECH_STACK 과 다름)
- 날짜 · 영역 · 상태: 2026-11-13 · 라이브러리 · 화면 · 채택(TECH_STACK 반영 대기)
- 맥락: [TECH_STACK 1절](../TECH_STACK.md) 은 화면 라이브러리로 Recharts 를 적어 두었다. 필요한 차트는 기울기 · 막대 · 선 정도다.
- 결정: Recharts 대신 서버 렌더 SVG 컴포넌트(`slope-chart` · `roas-bars` · `cash-line`)를 직접 만든다. Recharts 는 설치했다가 제거했다. 원칙: 직접 라벨 · 강조색 최소 · 표 대안 제공.
- 이유: 직접 라벨 · 접근성 라벨을 붙이기 쉽고 클라이언트 번들이 늘지 않으며 서버 렌더 구조(DD-020)와 맞다. 출처: 에이전트 보고.
- 버린 대안: Recharts(TECH_STACK 1절 원안).
- 영향: `app/src/components/charts/*`. **확인 필요**: TECH_STACK 1절 「화면」 행 갱신(문서가 기준이므로 문서부터 고쳐야 함 — CLAUDE.md).

## DD-023 Geist 웹폰트 제거 → 시스템 한글 폰트
- 날짜 · 영역 · 상태: 2026-11-13 · 화면 · 채택
- 맥락: Next.js 기본 Geist 웹폰트를 쓸지 정해야 했다.
- 결정: Geist 를 빼고 시스템 한글 폰트를 쓴다.
- 이유: Geist 에는 한글 글리프가 없고, 빌드 때 네트워크로 폰트를 받아야 한다(docker 빌드 의존성 증가). 출처: 에이전트 보고.
- 버린 대안: Geist 유지 · 한글 웹폰트 추가 — 후자는 보고에 언급 없음.
- 영향: `app/src/app/layout.tsx` · `globals.css`.
