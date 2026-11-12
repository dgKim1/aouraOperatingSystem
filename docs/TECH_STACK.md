# 기술 스택 · 구조 결정 (ADR)

> 결정일: 2026-11-12 · 대상: Aoura 운영 시스템 (W02 인플루언서 계약과 캠페인 집행)
> 이 문서는 제출 설명서의 "기술 · 구조를 정한 이유"의 근거다. 결정을 바꾸면 이 문서를 먼저 고친다.

## 1. 결정 요약

| 영역 | 선택 |
|---|---|
| 앱 | **Next.js (App Router) + TypeScript** — 화면과 API 를 한 저장소 · 한 서비스로 |
| DB | **axhub 앱 전용 Postgres + Drizzle ORM** (`axhub.yaml` 의 `database: engine: postgres`, 접속은 `DATABASE_URL`) |
| 규칙 · 계산 | **TypeScript 순수 함수 + 상태 머신** — 권한 · 기한 · 공헌이익 · 재고 커버는 코드가 계산 |
| AI | **Anthropic TypeScript SDK**, 모델 `claude-opus-5-5`, **단일 에이전트 + tool use** |
| AI 키 | **개인 Anthropic API 키** — `.env` 에 넣고 `axhub env set` 으로 등록 (채팅 · 커밋 금지) |
| 화면 | Tailwind CSS + shadcn/ui + Recharts |
| 검증 | Vitest (규칙 단위 테스트 · 시연 3상황 시나리오 테스트) + `tsc --noEmit` + ESLint |
| 배포 | axhub lounge · self-hosted 저장소 push · **docker** 방식 (현재 static → 전환 필요, 아래 5절) |
| 개발 하네스 | Claude Code + 역할 에이전트 3개(기획 · 백엔드 · 프론트엔드) + `CLAUDE.md` + `docs/` |

## 2. 왜 이렇게 정했나

### 2-1. Next.js 풀스택 한 저장소
- 승인 요청 · 상태 변경 · 처리 이력이 있어야 해서 **서버와 DB 가 필수**다(정적 사이트로는 완료 조건 1 불가).
- 화면과 API 가 같은 TypeScript 타입(온톨로지 모델)을 공유 → 프론트 · 백엔드 역할이 나뉘어도 계약이 어긋나지 않는다.
- axhub 공식 템플릿 경로(Next.js + `@ax-hub/sdk`) · Node 22 자동 Dockerfile 로 배포가 단순하다.
- 대안(Next.js + FastAPI 분리)은 데이터 분석이 편하지만 compose 배포 · 서비스 두 개 · 타입 중복이 생겨 기각.

### 2-2. 계산은 코드, 해석은 AI
- 과제 원칙: "원본의 생산능력 · 계약 · 승인 제약을 가정으로 임의로 없애면 안 된다", "유리한 회신만 만드는 것으로 검증을 대신할 수 없다".
- 그래서 **승인 권한 구간(1천만 · 1억 · 10억), 미통보 = 체결, 기한 경과 = 자동 확정, covenant 우선 규정, 실질 공헌이익(공식값 = `A05` 5절 단일 차감, `calculation_definitions` 1.4 문자 그대로는 참고값), 재고 커버(1.3)** 는 결정적 코드로 계산하고 단위 테스트로 고정한다.
- AI 는 ① 접수 문서 해석 ② 도구로 근거 조회 ③ 판단안 · 근거 · 대안 작성 ④ 주장/사실 구분 ⑤ 통보문 · 상신문 초안 을 맡는다. **AI 가 낸 숫자는 쓰지 않고, 도구가 돌려준 숫자만 인용**한다.
- **최종 결정은 사람**(권한자, 모의 회신)이 하고, 상태 변경은 **도구(코드)** 가 한다.

### 2-3. 런타임 AI: 단일 에이전트 + 워크플로 (multi-agent 아님)
- 업무 흐름이 BPMN 으로 정해져 있다(접수 → 취합 → 조건 확인 → 승인 분기 → 통보 → 기록). 흐름 · 상태 · 권한은 **상태 머신 코드가 통제**하고, 각 단계에서 필요한 해석만 에이전트가 한다.
- 오판 비용이 크다(연 28억 자동 갱신). 에이전트 여러 개가 합의하는 구조보다 **한 에이전트 + 결정적 규칙 + 사람 승인**이 검증 · 설명이 쉽다.
- 마케팅 · 재무 · 계약 관점은 판단안 안의 **관점별 근거 항목**으로 보여준다.
- 확장 여지: 필요해지면 "검토 에이전트"(판단안의 근거 누락 · 주장 혼동 점검)를 2단계로 추가.
- 과제는 Multi-Agent 를 강제하지 않으며, 구조를 고른 **이유 설명**을 요구한다 → 이 절이 그 설명이다.

### 2-4. Claude 사용 방식
- SDK: `@anthropic-ai/sdk` (공식). OpenAI 호환 shim · 직접 fetch 사용 안 함.
- 모델: `claude-opus-5-5`, thinking `adaptive`, effort 는 단계별로 명시(기본 `medium`).
- 도구: 우리가 정의한 조회 · 계산 · 생성 도구만(DB 조회, 규칙 엔진 호출, 승인요청/작업 생성 제안). `strict: true` 스키마.
- `stop_reason` 확인(`refusal` 포함) 후 결과를 사용. 서버 측 fallback 설정은 구현 시 함께 적용.
- 키가 없거나 호출 실패 시 **모의(mock) 모드**로 동작해 시연이 끊기지 않게 한다(모의 결과는 화면에 [모의] 표시).

### 2-5. 데이터 원칙
- 원본 CSV(`|` 구분, 원 · VAT 제외)는 **읽기 전용 원본 테이블**로 적재하고 파일 경로 · 행 출처를 남긴다. 원본 파일은 수정하지 않는다.
- 가정 · 신규 데이터(계약 원문 발췌, 통보 수령확인, 물류 · CS 비용 등)는 **별도 테이블**에 두고 `source = assumption` 으로 표시.
- 모든 값은 화면에서 **[원본] · [집계] · [원본 근거 해석] · [가정] · [주장] · [모의]** 배지 중 하나를 단다.
- 표본(커머스 계열)과 풀스케일(계약 · 재고 · 자금) 금액을 더하거나 곱하지 않는다.

## 3. 개발 하네스 (Harness Engineering)

| 구성 요소 | 위치 | 역할 |
|---|---|---|
| 공통 규칙 | `CLAUDE.md` (프로젝트 루트) | 모든 에이전트가 지키는 금지 · 원칙 · 완료 기준 · 명령어 |
| 기준 문서 | `docs/` | PROBLEM(과제) · W02_TASK(업무 · 데이터) · TECH_STACK(이 문서) · DEPLOY(배포) · 이후 설계 문서 |
| 역할 에이전트 | `~/.claude/agents/aoura-planner.md` · `aoura-backend.md` · `aoura-frontend.md` | 역할별 책임 · 소유 영역 · 완료 조건 |
| 피드백 루프 | `npm run check` (= typecheck + lint + test) | 모든 작업의 완료 판정. 통과 못 하면 완료 아님 |
| 배포 | 스킬 `aoura-deploy` ("배포") | `docs/DEPLOY.md` 절차 |

역할 에이전트를 사용자 폴더(`~/.claude/agents/`)에 둔 이유: 프로젝트 `.claude/` 는 대회 기록 키가 들어 있어 **수정 금지**. 이름에 `aoura-` 접두어를 붙여 다른 프로젝트와 구분하고, 각 에이전트는 이 프로젝트 폴더에서만 동작하도록 정의했다.

### 역할 분담

| 역할 | 소유 영역 | 하지 않는 것 |
|---|---|---|
| **기획** (`aoura-planner`) | `docs/` — 요구사항 · 온톨로지 · 화면/시나리오 명세 · 원본/가정 구분 · 수용 기준 · 결과 검수 | 앱 코드 작성 |
| **백엔드** (`aoura-backend`) | `app/src/server/`, `app/src/domain/`, `app/drizzle/`, `app/scripts/` — DB 스키마 · 원본 적재 · 규칙 엔진 · 상태 머신 · AI 에이전트 · 도구 · API | 화면 컴포넌트 |
| **프론트엔드** (`aoura-frontend`) | `app/src/app/`(페이지), `app/src/components/` — 판단 화면 · 승인 UI · 타임라인 · 배지 | 규칙 · 계산 로직 (API 결과만 표시) |

공유 계약: `app/src/domain/types.ts`(온톨로지 타입)와 API 응답 타입은 **백엔드가 소유**, 변경 시 기획 문서와 함께 갱신.

## 4. 폴더 구조 (예정)

```
삼일PwC_프로젝트폴더/
├── CLAUDE.md
├── axhub.yaml                 # root: app, deploy_method: docker, database: postgres
├── docs/
├── app/                       # Next.js 앱 (현재 index.html 은 교체 예정)
│   ├── src/app/               # 페이지 · route handler (프론트 / API 경계)
│   ├── src/components/
│   ├── src/domain/            # 온톨로지 타입 · 규칙 엔진 · 상태 머신 (순수 함수)
│   ├── src/server/            # DB · AI 에이전트 · 도구 · 서비스
│   ├── drizzle/               # 스키마 · 마이그레이션
│   ├── scripts/               # 원본 CSV 적재 (읽기 전용)
│   └── tests/                 # 단위 · 시나리오 테스트
└── 01_참가자_배포용/            # 원본 (수정 금지)
```

## 5. 남은 결정 · 후속 작업

- [x] **배포 방식 static → docker 전환** — 2026-11-12 완료 (사용자 승인). 첫 docker 배포 성공 전까지 옛 정적 페이지 유지.
- [ ] `axhub.yaml` 을 `deploy_method: docker` · `root: app` · `database: engine: postgres` 로 변경 (Next.js 골격과 함께, 그 전엔 push 금지).
- [x] `ANTHROPIC_API_KEY`: 로컬은 `app/.env.local`(git 제외 — `.git/info/exclude`), axhub 에는 2026-11-12 **secret · stage=runtime** 으로 등록 완료 (아래 DEPLOY.md 5절 방법).
- [ ] 원본 데이터를 앱에서 읽는 방식: 빌드/시드 시 `01_참가자_배포용/04_원본데이터` → DB 적재 (배포 이미지에 원본 CSV 포함 여부 확인 — 웹 공개 경로로는 노출하지 않음).
- [x] 온톨로지 · 상태 머신 · 화면 명세 (기획 에이전트 첫 작업) — 2026-11-12 문서화: [ONTOLOGY.md](ONTOLOGY.md) · [DEMO_SCENARIOS.md](DEMO_SCENARIOS.md) · [SCREEN_SPEC.md](SCREEN_SPEC.md). 구현은 미착수.
