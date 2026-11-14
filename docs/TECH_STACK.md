# 기술 스택 · 구조 결정 (ADR)

> 결정일: 2026-11-12 · 대상: Aoura 운영 시스템 (W02 인플루언서 계약과 캠페인 집행)
> 이 문서는 제출 설명서의 "기술 · 구조를 정한 이유"의 근거다. 결정을 바꾸면 이 문서를 먼저 고친다.
> **2026-11-14 갱신**: 백엔드 2단계(DB · API 24개 · AI 에이전트) 반영 — 4절 실제 폴더 구조, 5절 남은 결정(원본 CSV 의 docker 포함 방식 **사용자 결정 대기**), 5-1 로컬 개발 DB · 환경변수 이름, 2-4 모의 대체 방식, 2-5 원본 적재 테이블 일반화.
> **2026-11-14 갱신(2)**: 사용자 결정 — **실시간 AI 판단안 확인(BE-15) 보류, 시연은 모의 판단안**. 2-3 · 2-4 · 5 · 5-1 반영. 과제 문서(A01 심사 관점 · A04 자기점검)와의 긴장과 제출 설명용 구간 구분은 [ONTOLOGY 9-1](ONTOLOGY.md#9-1-사용자-결정--ai-방식-b-실제-실행-1회--기록-재생).
> **2026-11-14 갱신(3)**: 사용자 결정 2건 반영 — ① **AI 방식 (b)**: 실제 Claude 로 판단안을 한 번만 만들고(2026-11-14 17:19 KST 실행 1회 성공) 이후에는 호출하지 않고 기록을 보여준다, 배포 런타임은 `AOURA_AI_MODE=mock`(2-3 · 2-4, 갱신(2)의 "보류"를 대체) ② **배포 A안**: 이미지에 원본 CSV 복사 + 시작 시 마이그레이션(5절 — axhub 확인 사실 · 미확인 4건, 상세는 [DEPLOY.md](DEPLOY.md)). 4절 폴더 구조(4단계), 5-1 환경변수 갱신.

## 1. 결정 요약

| 영역 | 선택 |
|---|---|
| 앱 | **Next.js (App Router) + TypeScript** — 화면과 API 를 한 저장소 · 한 서비스로 |
| DB | **axhub 앱 전용 Postgres + Drizzle ORM** (`axhub.yaml` 의 `database: engine: postgres`, 접속은 `DATABASE_URL`) |
| 규칙 · 계산 | **TypeScript 순수 함수 + 상태 머신** — 권한 · 기한 · 공헌이익 · 재고 커버는 코드가 계산 |
| AI | **Anthropic TypeScript SDK**, 모델 `claude-opus-5-5`, **단일 에이전트 + tool use**. 실제 실행 1회 확인 + 기록 재생, 시연 · 배포 런타임은 모의(2-3 · 2-4) |
| AI 키 | **개인 Anthropic API 키** — `.env` 에 넣고 `axhub env set` 으로 등록 (채팅 · 커밋 금지) |
| 화면 | Tailwind CSS + shadcn/ui + 서버 렌더 SVG 차트 (Recharts 제외 — devlog DD-022) |
| 검증 | Vitest (규칙 단위 테스트 · 시연 ①~④ 시나리오 테스트) + `tsc --noEmit` + ESLint |
| 배포 | axhub lounge · self-hosted 저장소 push · **docker** 방식 — **A안**: 최상위 Dockerfile 이 원본 CSV 를 이미지에 복사, 시작 시 마이그레이션(5절 · [DEPLOY.md](DEPLOY.md)). 아직 배포 전 |
| 개발 하네스 | Claude Code + 역할 에이전트 4개(기획 · 백엔드 · 프론트엔드 · 기록) + `CLAUDE.md` + `docs/` |

## 2. 왜 이렇게 정했나

### 2-1. Next.js 풀스택 한 저장소
- 승인 요청 · 상태 변경 · 처리 이력이 있어야 해서 **서버와 DB 가 필수**다(정적 사이트로는 완료 조건 1 불가).
- 화면과 API 가 같은 TypeScript 타입(온톨로지 모델)을 공유 → 프론트 · 백엔드 역할이 나뉘어도 계약이 어긋나지 않는다.
- axhub 가 Next.js · Node 22 를 지원해 한 서비스로 배포할 수 있다. (2026-11-14 정정: 자동 Dockerfile 이 아니라 **직접 쓴 최상위 Dockerfile** 을 쓴다 — 원본 CSV 를 이미지에 담아야 해서, 5절 A안.)
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
- **시연에서의 위치 (2026-11-14 사용자 결정 (b) — 같은 날의 "보류" 결정을 대체)**: 실제 Claude 로 판단안을 **한 번만** 만들고, 이후에는 AI 를 다시 호출하지 않고 그 기록을 보여준다. 시연 · 배포 런타임은 `AOURA_AI_MODE=mock` — [판단안 만들기] 는 모의 판단안(결정적 문장)이고 화면에 `모의` 를 표시한다. 흐름 · 상태 · 권한 · 계산 · 권고는 위 구조대로 코드가 정하므로 실시간이든 모의든 시연 흐름(상신 → 회신 → 상태 변경 → 다음 판단)은 같다. 실제 실행(2026-11-14 17:19 KST, 계약 판단안 1건 — 도구 5개 조회 → `submit_assessment`, 권고 B, 숫자 출처 검증 통과, 승인요청 생성까지)의 기록은 `app/src/server/ai/recorded/` 에 있고 기록 재생 화면에서 `기록 재생` 표지로 보인다. 제출 설명에서는 **「실제 작동 — 1회 실행 확인, 시연은 기록 재생」** 으로 구분한다(A04 「실제 작동 · 모의 처리 · 설계 단계」 — 구분표 · 한계는 [ONTOLOGY 9-1](ONTOLOGY.md#9-1-사용자-결정--ai-방식-b-실제-실행-1회--기록-재생)).

### 2-4. Claude 사용 방식
- SDK: `@anthropic-ai/sdk` (공식). OpenAI 호환 shim · 직접 fetch 사용 안 함.
- 모델: `claude-opus-5-5`, thinking `adaptive`, effort 는 단계별로 명시(기본 `medium`).
- 도구: 우리가 정의한 조회 · 계산 · 생성 도구만(DB 조회, 규칙 엔진 호출, 승인요청/작업 생성 제안). `strict: true` 스키마.
- `stop_reason` 확인(`refusal` · `max_tokens` · `pause_turn`, 제출 없는 종료는 한 번 재촉) 후 결과를 사용. **대체는 SDK 의 fallback 설정이 아니라 우리 코드의 모의 대체**로 한다(2단계 구현): 실시간 결과가 실패 · 거절이거나 숫자 출처 검증(판단안 숫자는 도구 반환값만)을 통과하지 못하면 결정적 모의 판단안으로 바꾸고 `aiMode = MOCK` · `fallbackReason` 을 남긴다(오류 원문 · 키는 기록하지 않음). 베타 fallback 기능은 쓰지 않는다(비베타 대안이 없고, 모의 대체가 같은 역할).
- 도구 6개(`get_facts` · `get_rule_results` · `get_alternatives` · `get_open_gaps` · `get_claims` · `submit_assessment`), 상태를 바꾸는 도구는 없다. AI 가 고르는 것은 계약 대안 권고 하나(enum 제한)와 문장뿐 — 숫자 · 권한자 · 건별 권고는 규칙 코드(`domain/assessment.ts`).
- 실시간 경로 확인: 2026-11-14 첫 호출들은 API 크레딧 부족(400)으로 실패 → 설계대로 모의 대체 확인. 사용자가 크레딧을 충전한 뒤 **2026-11-14 17:19 KST 에 실제 실행 1회가 성공**했다(BE-15 — 응답 2회, 응답의 model 필드 `claude-opus-5-5`, `stop_reason: tool_use`, 숫자 출처 검증 통과 — devlog LOG-030, 기록 파일로 확인). **추가 실행은 하지 않는다**(사용자 결정 (b)).
- **기록 재생** (4단계, DD-049 · DD-050): 성공한 실행을 `server/ai/recorded/rec-001-contract.json` 에 남기고 `GET /api/assessments/recorded` 로 보여준다. 이 API 는 AI 를 호출하지 않고 운영 상태를 읽거나 바꾸지 않으며, 기록의 근거가 지금 규칙 계산과 같은지 매번 대조한다(`basisCheck`). 운영 타입의 `aiMode`(`LIVE` · `MOCK`)는 넓히지 않고 재생 전용 타입(`RecordedAssessmentView`, `aiMode: 'RECORDED'`)으로 분리했다 — 기록이 운영 판단안 · 이력에 섞이면 시연 중 "지금 AI 가 만든 것"으로 읽히고 프리셋 결정성이 깨진다. 기록 파일에는 키 · 헤더 · 접속 문자열을 넣지 않는다.
- **호출 추적**: 실시간 판단안에는 `aiTrace`(응답별 메시지 ID · 응답 모델 · stop_reason · 입력/출력 토큰 수)를 남긴다. 실패 사유에는 API 오류의 종류(상태 코드 · type)만 넣고 안내 문구 · 키는 저장하지 않는다.
- 키가 없거나 호출 실패 시 **모의(mock) 모드**로 동작해 시연이 끊기지 않게 한다(모의 결과는 화면에 [모의] 표시). **시연 · 배포 환경은 `AOURA_AI_MODE=mock`** 으로 실시간 호출을 시도하지 않는다 — 크레딧 없는 키로 호출하면 실패 뒤 모의 대체가 되어 "실시간 호출 실패 → 모의로 생성" 경고가 시연 화면에 뜨고 응답이 늦어지기 때문이다. 모의 모드에서도 도구 6개는 코드가 같은 입력으로 실행하고(`toolCalls[].actor = SYSTEM`) 숫자 출처 검증을 거친다. 배포 환경에 `AOURA_AI_MODE` 는 **아직 미등록**이다 — 배포 전에 등록한다(5절).

### 2-5. 데이터 원칙
- 원본 CSV(`|` 구분, 원 · VAT 제외)는 **읽기 전용 원본 테이블**로 적재하고 파일 경로 · 행 출처를 남긴다. 원본 파일은 수정하지 않는다. 2단계 구현은 파일별 테이블 대신 `raw_files`(파일 목록) + `raw_rows`(`src_file` · `src_row` · 원문 jsonb) 두 테이블로 일반화했다 — 17 파일 24,290행([ONTOLOGY 1-1](ONTOLOGY.md#1-1-원본-적재-테이블-읽기-전용)). **배포(A안)에서는 원본을 DB 에 적재하지 않고 이미지 안의 CSV 파일에서 직접 읽는다**(`rawSource: FILES`, 5절) — 배포된 앱 DB 에 외부에서 적재할 길이 없기 때문이다. `raw_files` · `raw_rows` 적재(`db:load-raw`)는 로컬 개발용 경로로 남는다. 어느 쪽이든 원본 파일은 읽기 전용이고 값의 출처 경로 · 행은 같다.
- 운영 테이블은 조회용 핵심 열 + 도메인 객체 전체 `data` jsonb, 처리 이력 · 사건은 추가만, `sim_state` 1행의 `version` 으로 낙관적 잠금([ONTOLOGY 1-3 DB 스키마 원칙](ONTOLOGY.md#db-스키마-원칙-2단계-구현-2026-11-14-채택)).
- 가정 · 신규 데이터(계약 원문 발췌, 통보 수령확인, 물류 · CS 비용 등)는 **별도 테이블**에 두고 `source = assumption` 으로 표시.
- 모든 값은 화면에서 **[원본] · [집계] · [원본 근거 해석] · [가정] · [주장] · [모의]** 배지 중 하나를 단다.
- 표본(커머스 계열)과 풀스케일(계약 · 재고 · 자금) 금액을 더하거나 곱하지 않는다.

## 3. 개발 하네스 (Harness Engineering)

| 구성 요소 | 위치 | 역할 |
|---|---|---|
| 공통 규칙 | `CLAUDE.md` (프로젝트 루트) | 모든 에이전트가 지키는 금지 · 원칙 · 완료 기준 · 명령어 |
| 기준 문서 | `docs/` | PROBLEM(과제) · W02_TASK(업무 · 데이터) · TECH_STACK(이 문서) · DEPLOY(배포) · 이후 설계 문서 |
| 역할 에이전트 | `~/.claude/agents/aoura-planner.md` · `aoura-backend.md` · `aoura-frontend.md` · `aoura-recorder.md` | 역할별 책임 · 소유 영역 · 완료 조건 |
| 개발 기록 | `docs/devlog/` (기록 에이전트) | 작업 기록(LOG) · 설계 결정(DD) — 백엔드 · 프론트엔드 보고와 변경분이 들어올 때마다 갱신 |
| 피드백 루프 | `npm run check` (= typecheck + lint + test) | 모든 작업의 완료 판정. 통과 못 하면 완료 아님 |
| 배포 | 스킬 `aoura-deploy` ("배포") | `docs/DEPLOY.md` 절차 |

역할 에이전트를 사용자 폴더(`~/.claude/agents/`)에 둔 이유: 프로젝트 `.claude/` 는 대회 기록 키가 들어 있어 **수정 금지**. 이름에 `aoura-` 접두어를 붙여 다른 프로젝트와 구분하고, 각 에이전트는 이 프로젝트 폴더에서만 동작하도록 정의했다.

### 역할 분담

| 역할 | 소유 영역 | 하지 않는 것 |
|---|---|---|
| **기획** (`aoura-planner`) | `docs/` — 요구사항 · 온톨로지 · 화면/시나리오 명세 · 원본/가정 구분 · 수용 기준 · 결과 검수 | 앱 코드 작성 |
| **백엔드** (`aoura-backend`) | `app/src/server/`, `app/src/domain/`, `app/drizzle/`, `app/scripts/`, `app/src/app/api/` — DB 스키마 · 원본 적재 · 규칙 엔진 · 상태 머신 · AI 에이전트 · 도구 · API | 화면 컴포넌트 |
| **프론트엔드** (`aoura-frontend`) | `app/src/app/`(페이지, `api/` 제외), `app/src/components/` — 판단 화면 · 승인 UI · 타임라인 · 배지 | 규칙 · 계산 로직 (API 결과만 표시) |
| **기록** (`aoura-recorder`) | `docs/devlog/` — 백엔드 · 프론트엔드의 작업 기록(LOG)과 설계 결정(DD): 무엇을 · 왜 · 버린 대안 · 검증 결과 | 코드 · 다른 문서 수정 (읽기만) |

공유 계약: `app/src/domain/types.ts`(온톨로지 타입)와 API 응답 타입 `app/src/domain/api-types.ts` 는 **백엔드가 소유**, 변경 시 기획 문서와 함께 갱신. 화면 라벨 사본 `app/src/domain/labels.ts`(백엔드)와 `app/src/components/labels.ts`(프론트)가 같은 내용을 가진다 — 새 enum 값이 생기면 둘 다 고쳐야 typecheck 가 통과한다(예: `ESCALATE_NOTICE_UNCONFIRMED`, FE-03).

## 4. 폴더 구조 (2026-11-14 기준 — 4단계 · 배포 준비 작업본, 미커밋)

```
삼일PwC_프로젝트폴더/
├── CLAUDE.md
├── axhub.yaml                 # docker 구성 (root 미선언) — git push origin = 실제 docker 배포 (DEPLOY.md 맨 위 경고)
├── Dockerfile · .dockerignore # 최상위 (A안 — 4단계 빌드 · 허용 목록 방식, BE-14)
├── docs/                      # 기획 문서 · devlog/(기록)
├── app/                       # Next.js 앱
│   ├── src/app/               # 페이지(프론트) · _data/views.ts(서버 컴포넌트가 getService() 직접 호출 — DD-035) · _actions/session.ts(역할 쿠키)
│   ├── src/app/api/           # route handler 27개 (healthz 포함) (백엔드) — 얇은 껍질, 처리는 server/service.ts
│   ├── src/components/        # 화면 컴포넌트 · labels.ts (프론트)
│   ├── src/domain/            # 순수 함수 · 타입 (백엔드)
│   │   ├── types.ts · api-types.ts      # 온톨로지 타입 · API 응답 타입
│   │   ├── workflow.ts                  # 상태 머신 · 이벤트 처리 · 기한 감시
│   │   ├── authority.ts · deadline.ts · cash.ts · inventory.ts · performance.ts · penalty.ts · money.ts · dates.ts
│   │   ├── assessment.ts · provenance.ts # 판단안 근거(결정적) · 숫자 출처 검증
│   │   ├── gaps.ts · permissions.ts     # 원본 공백 상태(판단안 · S-12 공용) · 쓰기 행위 역할 검사
│   │   ├── sourced.ts · labels.ts · registry.ts · files.ts · errors.ts · mockReplies.ts · dataset.ts · seed.ts
│   ├── src/server/            # 서버 전용 (백엔드)
│   │   ├── service.ts · runtime.ts · http.ts · scenarios.ts   # 서비스 · 의존성 · 오류 응답 · 프리셋 재생
│   │   ├── views/             # 화면용 집계(경고 · 기한 묶음 · 자동 갱신 위험 등) 순수 함수
│   │   ├── store/             # 저장소 인터페이스 · memory · pg (낙관적 잠금)
│   │   ├── db/                # Drizzle 스키마 · 접속 · raw_rows 읽기
│   │   ├── raw/               # 원본 CSV 읽기(읽기 전용)
│   │   ├── deploy/            # bootstrap.ts — 시작 단계(마이그레이션 → 비어 있으면 SEED)
│   │   └── ai/                # client(SDK) · agent(도구 6개) · assessor(모의 대체) · recorded/(실제 실행 기록 REC-001 + 재생 · 대조)
│   ├── drizzle/migrations/    # 0000_init.sql
│   ├── drizzle.config.ts
│   ├── scripts/               # db-migrate.ts · db-load-raw.ts (원본 → raw_rows, 로컬용) · deploy/start.sh · deploy/bootstrap.ts (컨테이너 시작)
│   ├── docker-compose.yml     # 로컬 개발용 Postgres (5433) — 배포와 무관
│   └── tests/                 # unit · scenarios · api · db(TEST_DATABASE_URL 있을 때만) · helpers
└── 01_참가자_배포용/            # 원본 (수정 금지)
```

## 5. 남은 결정 · 후속 작업

- [x] **배포 방식 static → docker 전환** — 2026-11-12 완료 (사용자 승인). 첫 docker 배포 성공 전까지 옛 정적 페이지 유지.
- [x] **원본 CSV 를 배포 환경에서 읽는 방식 — A안 확정** (2026-11-14, 사용자 결정 "axhub 전제를 확인한 뒤 되는 쪽" → 백엔드 확인 결과 A안, devlog DD-051). 어느 안이든 원본 CSV 를 웹 공개 경로(`public/`)로 노출하지 않는다.

  | 안 | 방법 | 판정 | 이유 |
  |---|---|---|---|
  | **A 이미지에 CSV 복사** | 최상위 Dockerfile 이 원본 CSV 를 이미지 안으로 복사, `RAW_DATA_DIR` 로 가리킴. 시작 시 마이그레이션 | **채택** | axhub 가 직접 쓴 Dockerfile 과 저장소 최상위 빌드 컨텍스트를 받는다. 출처 경로가 로컬과 같고 배포 뒤 따로 할 일이 없다 |
  | B DB 적재 | 이미지에 원본 없음, 배포 후 `db:load-raw` 1회 → 런타임은 `raw_rows` 에서 읽음(구현은 있음, `rawSource: DB`) | 기각 | 앱 DB 는 외부 접속이 안 되고, `axhub db exec` 는 한도(INSERT 류 · 1MiB · 1,000문장 · 30초)가 있으며 심사 기간에는 쓰기가 막힌다 — 24,290행을 배포 뒤에 넣을 길이 없다 |
  | C Next 파일 추적 | `outputFileTracingRoot` · `outputFileTracingIncludes` | 기각 | A 가 되므로 필요 없다. 추적 범위가 커진다 |

  **확인된 axhub 사실** (백엔드가 axhub 문서 · CLI 로 읽기 전용 확인 — LOG-030. 전체 표는 [DEPLOY.md 2-2](DEPLOY.md#2-2-axhub-에서-확인한-사실-백엔드가-axhub-문서--cli-로-읽기-전용-확인--log-030-기획은-7번만-직접-확인)):
  1. 직접 쓴 Dockerfile 이 된다 — `build.dockerfile`, 없으면 최상위 `Dockerfile`.
  2. 최상위 `root` 를 선언하지 않으면 저장소 최상위가 빌드 컨텍스트, `root: app` 을 선언하면 `app/` 으로 좁아진다. `build.root` 는 검증기가 거부한다.
  3. 앱 DB 는 외부 접속이 안 된다. `axhub db exec` 는 한도가 있고 심사 기간에는 쓰기가 막힌다.
  4. 런타임에 `DATABASE_URL`(트랜잭션 풀러) · `DIRECT_DATABASE_URL`(마이그레이션용)이 주입된다 — 2단계 문서의 "`DATABASE_URL` 주입 여부 미확인"은 이것으로 해소.
  5. 등록된 env 는 `ANTHROPIC_API_KEY` 뿐, `AOURA_AI_MODE` 는 미등록.
  6. 배포 이력에 커밋 `602a5c2` 의 실패 건(`resolve.spec_invalid` — 앱은 docker, manifest 는 static)이 있다. 옛 정적 페이지는 그대로다(기획이 `axhub deploy list` 로 직접 확인).

  **미확인** — 처음 4건(한글 폴더명 `COPY` · 실제 docker build · 풀러 위 PgStore · XS 사양 기동 시간) 중 앞의 둘과 로컬 제한 사양 기동은 로컬 docker 로 확인됐다(백엔드 보고: 빌드 약 56초 · 기동 0.77초 — 0.5코어 · 1GB). **남은 미확인 4건**: axhub 빌더에서의 실제 빌드(amd64) · 실제 트랜잭션 풀러 위 저장소 동작 · 실환경 기동 시간 · `axhub deploy check`([DEPLOY.md 2-4](DEPLOY.md#2-4-미확인--실배포에서만-확인되는-것)).
- [x] **배포 구성 반영 (BE-14) — 구현 · 로컬 docker 확인, 실배포 대기** (2026-11-14, 미커밋 작업본. 기획이 파일을 읽어 확인): 최상위 `Dockerfile`(`node:22-slim` 4단계 — deps · build · raw · runner, `USER node`, `RAW_DATA_DIR=/data/raw`), 허용 목록 방식 `.dockerignore`, `axhub.yaml`(최상위 `root` **미선언** · `deploy_method: docker` · `port: 3000` · `health_path: /api/healthz` · `start_period: 90s` · `database: engine: postgres` · `env.required: AOURA_AI_MODE`). 이미지에는 `MASIL_FILES` 의 CSV 17개만 담는다(웹 공개 경로 밖, md 문서 6개는 담지 않음 — 런타임이 읽지 않는다). 시작 순서: `DIRECT_DATABASE_URL` 로 마이그레이션 → 운영 상태가 비어 있으면 SEED(있으면 유지) → 서버. 실패하면 종료 코드 1 이고 서버는 뜨지 않는다. `raw_rows` 는 적재하지 않는다. 상태 확인 `/api/healthz` 는 DB 를 보지 않는다. 상세 · 로컬 확인 결과는 [DEPLOY.md 2-3](DEPLOY.md#2-3-구성-저장소-파일-기준--2026-11-14-작업본). 2단계 문서의 "`root: app`" 안은 **폐기**. **`axhub.yaml` 이 docker 로 바뀌었으므로 이제 `git push origin` 은 실제 docker 배포다 — 사용자가 "배포"라고 할 때만. GitHub 백업은 `git push github main` 뿐.**
- [ ] **실배포** — 사용자의 "배포" 지시 대기. 순서: `AOURA_AI_MODE=mock`(runtime) 등록 → 커밋 → `git push origin` → 배포 후 점검 5항목(DEPLOY.md 4절 9번).
- [x] `ANTHROPIC_API_KEY`: 로컬은 `app/.env.local`(git 제외 — `.git/info/exclude`), axhub 에는 2026-11-12 **secret · stage=runtime** 으로 등록 완료 (DEPLOY.md 5절 방법).
- [ ] `AOURA_AI_MODE=mock` 을 axhub **runtime** env 로 등록 — 비밀값 아님. 등록하지 않으면 배포가 `prepare.required_env_missing` 으로 멈춘다. `--from-dotenv` 방식은 stage 가 build 로 잡히므로 쓰지 않는다. 사용자의 "배포" 지시 뒤(DEPLOY.md 5절).
- [x] 온톨로지 · 상태 머신 · 화면 명세 (기획 에이전트 첫 작업) — 2026-11-12 문서화: [ONTOLOGY.md](ONTOLOGY.md) · [DEMO_SCENARIOS.md](DEMO_SCENARIOS.md) · [SCREEN_SPEC.md](SCREEN_SPEC.md). 구현: 1단계(커밋 `be79a9d`) · 2단계(커밋 `f2ba215`) · 3단계(커밋 `43edbbc` — 쓰기 권한 서버 검사 · ③ 화면 검증) · **4단계 백엔드(작업본, 미커밋 — BE-21~24 · AI 실행 기록 · 재생 API, devlog LOG-030)**. 배포 준비(BE-14)는 구현 · 로컬 docker 확인까지. 프론트엔드 4단계(FE-15 ~ 19 — 기록 재생 화면 포함)도 완료(프론트엔드 보고, ONTOLOGY 11-4). **알려진 결함 1건 수정 중**: 번들을 거친 서버에서 기록 재생의 `basisCheck` 가 불일치로 나온다(BE-25 — 실배포 전에 고친다). 완료 조건 판정은 DEMO 0-2.
- [x] **실제 AI 판단안 확인 (BE-15)** — 2026-11-14 17:19 KST 실행 1회 성공 · 기록 저장 · 재생 API(사용자 결정 (b)). 추가 실행 없음.

### 5-1. 로컬 개발 DB 와 환경변수 (2026-11-14)

로컬 Postgres 는 둘 중 하나를 쓴다(배포와 무관). 값(접속 문자열 · 키)은 이 문서에 쓰지 않는다 — `app/.env.local`(git 제외)에 둔다.
- **Homebrew Postgres 17** — 백엔드가 2단계 확인에 쓴 방식(로컬 DB `aoura_dev`).
- **`app/docker-compose.yml`** — `docker compose up -d` 로 Postgres 17 을 **호스트 포트 5433** 에 띄운다(로컬 전용 계정, 운영 비밀값 아님).
- 준비: `npm run db:setup` = `db:migrate`(Drizzle 마이그레이션) + `db:load-raw`(원본 17 파일 → `raw_files` · `raw_rows`). 스키마 변경 시 `db:generate`.
- 배포용 스크립트: `npm run build:deploy` — 시작 단계를 esbuild 로 `build/deploy/bootstrap.cjs` 단일 파일로 묶는다(Dockerfile 이 부름). 로컬 개발에는 필요 없다.

| 환경변수 | 용도 | 없으면 | 어디에 |
|---|---|---|---|
| `DATABASE_URL` | 운영 상태 DB 접속(로컬은 원본 적재 DB 도) | 메모리 저장소(재시작 시 초기화, `persistence: MEMORY`) | 로컬 `.env.local` · axhub 가 런타임에 **주입**(트랜잭션 풀러) — 등록하지 않는다. 실제 풀러 위 저장소 동작은 **미확인**(실배포에서 확인) |
| `DIRECT_DATABASE_URL` | **시작 단계 전용** — 마이그레이션 · 세션 잠금 · 시드(세션 단위 주소) | `DATABASE_URL` 로 대신하되 세션 잠금 없이 | axhub 가 런타임에 **주입** — 등록하지 않는다. 로컬은 필요 없음 |
| `MIGRATIONS_DIR` | 시작 단계의 마이그레이션 폴더 | 실행 위치의 `drizzle/migrations` | 설정하지 않는다(이미지에 기본 위치로 들어 있음) |
| `PORT` | 서버 포트 | 3000 | axhub 가 주입(`runtime.port`) — 등록하지 않는다 |
| `ANTHROPIC_API_KEY` | 실시간 판단안 | 모의 모드(`aiMode: MOCK`) | 로컬 `.env.local` · axhub secret(runtime, 등록됨). `AOURA_AI_MODE=mock` 이면 쓰이지 않는다 |
| `AOURA_AI_MODE` | `mock` 이면 키가 있어도 모의 강제(시연 · 테스트) | 키가 있으면 실시간 | **배포(시연) 런타임에 `mock` 설정** — 비밀값 아님, `axhub env set`(2026-11-14 결정, BE-14). **axhub 에 아직 미등록** — 배포 전에 등록. 로컬 시연도 `mock` 권장. 기록 재생(`/api/assessments/recorded`)은 이 값과 무관하게 같은 응답 |
| `RAW_DATA_DIR` | 원본 CSV 폴더 절대 경로 | `app/` 기준 `../01_참가자_배포용/04_원본데이터`, 그것도 없으면 DB `raw_rows` | 이미지에서 `RAW_DATA_DIR=/data/raw`(Dockerfile `ENV`) → `rawSource: FILES`. 등록하지 않는다 |
| `TEST_DATABASE_URL` | DB 통합 테스트(`tests/db/`) 전용 DB | DB 테스트 건너뜀 | 로컬만 (운영 DB 를 넣지 않는다) |
