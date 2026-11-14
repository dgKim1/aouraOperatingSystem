# 배포 가이드 — Aoura 운영 시스템 (axhub)

이 문서는 이 프로젝트를 axhub 에 배포하는 방법과, 지금까지 겪은 문제 · 해결을 기록해요.
스킬 `aoura-deploy`(트리거: "배포")가 이 문서를 기준으로 동작해요.

> **2026-11-14 갱신**: 배포 방식 **A안 확정**(이미지에 원본 CSV 복사 + 시작 시 마이그레이션 — 사용자 결정 "axhub 전제를 확인한 뒤 되는 쪽", 백엔드 확인 결과 A안, devlog DD-051 · LOG-030). 2절을 docker 구성으로 다시 썼고, 4절 절차 · 5절 환경변수 · 7절 이력(실패 1건)을 갱신했어요.
> **2026-11-14 갱신(2)**: 백엔드가 배포 준비(BE-14) 구현을 마쳤어요 — **구현 · 로컬 docker 확인, 실배포 대기**. 2절을 저장소의 실제 파일(`Dockerfile` · `.dockerignore` · `axhub.yaml` · `app/scripts/deploy/*` · `app/src/server/deploy/bootstrap.ts` · `app/src/app/api/healthz/route.ts`, 모두 미커밋 작업본)을 기획이 읽어 다시 썼어요. 로컬 docker 실행 결과는 백엔드 보고를 인용했어요(기획은 docker 를 돌리지 않았어요). 배포 · push · env 등록은 아직 아무도 하지 않았어요.

---

> ## 주의 — `git push origin` = 실제 docker 배포
>
> **`axhub.yaml` 이 `deploy_method: docker` 로 바뀌었어요. 이제 `git push origin` 은 실제 docker 배포예요.**
>
> - 전에는 `axhub.yaml` 이 static 이라, push 해도 "배포 방식 불일치"로 준비 단계에서 실패하고 옛 정적 페이지가 그대로 남았어요(7절 실패 이력). 그 안전판은 이제 없어요.
> - docker 설정이 들어간 커밋을 `origin` 에 push 하면 빌드 → 앱 DB 생성 → 마이그레이션 · 시드 → 서비스 교체까지 진행돼요. 옛 정적 페이지는 새 서비스로 바뀌어요.
> - 2026-11-14 현재 이 변경은 **미커밋 작업본**이에요. 커밋되는 순간부터 그다음 `git push origin` 이 배포예요.
> - 그래서:
>   1. 사용자가 **"배포"라고 하기 전에는 `origin` 에 push 하지 않아요.**
>   2. **GitHub 백업은 `git push github main` 뿐**이에요(배포와 무관).
>   3. `git push` 를 원격 이름 없이 쓰지 않아요 — 기본 원격이 `origin` 이에요.
>   4. 커밋 요청을 받았을 때 `axhub.yaml` · `Dockerfile` 이 스테이징에 들어가면 "이 커밋 뒤의 origin push 는 배포"라고 알려요.
>   5. push 전에 `AOURA_AI_MODE` 를 등록해요(5절) — 없으면 `prepare.required_env_missing` 으로 멈춰요.

---

## 1. 앱 정보

| 항목 | 값 |
|---|---|
| 앱 이름(표시) | Aoura 운영 시스템 |
| 앱 slug | `aoura-os` |
| 앱 ID | `67aa2c25-3329-4ee9-8cb7-3b5114266cf2` |
| 테넌트(조직) | `lounge` (ID `c7a0a6fe-86c6-45f4-adc2-3ab7bd19ea36`) — **반드시 lounge** |
| 배포 방식 | **`docker`** (2026-11-12 static 에서 전환 · 되돌릴 수 없음). `axhub.yaml` 도 docker 로 맞춤(작업본). 첫 docker 배포 성공 전까지는 옛 정적 페이지가 계속 열려 있음 |
| 코드 저장 위치 | axhub self-hosted 저장소 (`git_backend: selfhosted`) |
| 앱 주소 | https://aoura-os-oiw3.axhub.page — **지금은 옛 정적 페이지**(2026-11-10 배포분). 운영 시스템은 아직 배포되지 않았어요 |
| CLI | axhub CLI (`~/.axhub/bin/axhub`), 로그인 계정 lounge 멤버 |

- `origin/main` 은 커밋 `602a5c2`(2026-11-13)이에요. 로컬 `main` 은 그 뒤 커밋 3개(`be79a9d` · `f2ba215` · `43edbbc`)와 미커밋 작업본(4단계 · 배포 준비)이 더 있어요. 첫 docker 배포는 이 전부를 한 번에 올리게 돼요.

## 2. 배포 구성 (A안 — 2026-11-14 확정)

**A안 = 이미지에 원본 CSV 를 복사하고, 컨테이너 시작 때 DB 마이그레이션을 돌린다.**

### 2-1. 왜 A안인가

| 안 | 방법 | 판정 | 이유 |
|---|---|---|---|
| **A 이미지에 CSV 복사** | 최상위 Dockerfile 이 원본 CSV 를 이미지 안으로 복사, 런타임은 파일에서 읽음 | **채택** | 직접 쓴 Dockerfile 과 저장소 최상위 빌드 컨텍스트가 axhub 에서 된다(아래 확인 사실 1 · 2). 배포 뒤 따로 할 일이 없고, 출처 경로가 로컬과 같다 |
| B DB 적재 | 이미지에 원본 없음, 배포 후 `db:load-raw` 로 `raw_rows` 적재 | 기각 | 앱 DB 는 외부에서 접속할 수 없고(확인 사실 4), `axhub db exec` 는 한도가 있으며 심사 기간에는 쓰기가 막힌다(확인 사실 5). 원본 17 파일 24,290행을 배포 뒤에 넣을 길이 없다 |
| C Next 파일 추적 | `outputFileTracingIncludes` 로 빌드 산출물에 포함 | 기각 | 상위 폴더까지 추적 범위가 커지고, A 가 되므로 필요 없다 |

### 2-2. axhub 에서 확인한 사실 (백엔드가 axhub 문서 · CLI 로 읽기 전용 확인 — LOG-030. 기획은 7번만 직접 확인)

| # | 사실 | 배포 구성에 주는 영향 |
|---|---|---|
| 1 | **직접 쓴 Dockerfile 을 쓸 수 있다** — `build.dockerfile` 로 지정, 없으면 저장소 최상위 `Dockerfile` | 자동 Dockerfile 대신 우리 Dockerfile 로 원본 CSV 를 담는다 |
| 2 | **최상위 `root` 를 선언하지 않으면 저장소 최상위가 빌드 컨텍스트**다. `root: app` 을 선언하면 컨텍스트가 `app/` 으로 좁아진다 | **`root` 를 선언하지 않는다** — 선언하면 `app/` 밖의 `01_참가자_배포용/` 을 복사할 수 없다 |
| 3 | `build.root` 는 검증기가 거부한다 | `root` 는 최상위 키로만 있고, 우리는 쓰지 않는다 |
| 4 | **앱 DB 는 외부에서 접속할 수 없다** | 로컬에서 마이그레이션 · 적재를 돌릴 수 없다 → 컨테이너가 시작할 때 스스로 마이그레이션 |
| 5 | `axhub db exec` 는 INSERT 류만 · 1MiB · 1,000문장 · 30초 한도이고, **심사 기간에는 쓰기가 막힌다** | 배포 뒤 수동 DB 작업에 기대지 않는다(B 기각 이유) |
| 6 | 런타임에 **`DATABASE_URL`(트랜잭션 풀러)** 과 **`DIRECT_DATABASE_URL`(직접 접속 — 마이그레이션용)** 이 주입된다 | 마이그레이션은 `DIRECT_DATABASE_URL`, 앱의 조회 · 쓰기는 `DATABASE_URL` |
| 7 | 등록된 환경변수는 **`ANTHROPIC_API_KEY` 뿐**이고 `AOURA_AI_MODE` 는 **미등록**. 배포 이력에 커밋 `602a5c2` 의 **실패 1건**(`resolve.spec_invalid` — 앱은 docker, manifest 는 static)이 있고 옛 정적 페이지는 그대로다 | 배포 전에 `AOURA_AI_MODE=mock` 등록(5절). 실패 건은 7절 이력 (기획이 2026-11-14 `axhub deploy list` 로 실패 건 직접 확인) |

### 2-3. 구성 (저장소 파일 기준 — 2026-11-14 작업본)

```
삼일PwC_프로젝트폴더/
├── axhub.yaml          ← 배포 설정 (저장소 최상위) — docker
├── Dockerfile          ← 최상위. 빌드 컨텍스트 = 저장소 최상위
├── .dockerignore       ← 허용 목록 방식 (기본 전부 제외)
├── app/                ← Next.js 앱 (화면 + API)
│   ├── scripts/deploy/start.sh · bootstrap.ts   ← 컨테이너 시작 단계
│   ├── src/server/deploy/bootstrap.ts            ← 마이그레이션 · 시드 로직
│   └── src/app/api/healthz/route.ts              ← 상태 확인
├── 01_참가자_배포용/    ← 원본 (수정 금지) — 이미지에는 앱이 읽는 CSV 17개만, 웹에는 공개되지 않음
├── docs/DEPLOY.md      ← 이 문서
└── .claude/ .codex/ .agents/ .gitignore   ← 수정 금지 (개인 기록 키) — 이미지에 넣지 않음
```

**`axhub.yaml`**

| 키 | 값 | 뜻 |
|---|---|---|
| `root` | **선언하지 않음** | 선언하면 컨텍스트가 그 폴더로 좁아져 원본 폴더를 담을 수 없다(확인 사실 2) |
| `build.deploy_method` | `docker` | 앱에 기록된 방식과 같아야 한다(다르면 `resolve.spec_invalid`) |
| `build.dockerfile` | `Dockerfile` | 저장소 최상위 |
| `runtime.port` | `3000` | |
| `runtime.health_path` | `/api/healthz` | 로그인 · DB 없이 200 |
| `runtime.healthcheck.start_period` | `90s` | 시작 단계(마이그레이션 · 시드) + Next 기동 여유 |
| `database.engine` | `postgres` | 배포 때 앱 전용 DB 생성, 런타임에 `DATABASE_URL` · `DIRECT_DATABASE_URL` 주입 |
| `env.required` | `AOURA_AI_MODE` (runtime) | **등록돼 있지 않으면 배포가 시작 전에 멈춘다**(`prepare.required_env_missing`) |
| `env.optional` | `ANTHROPIC_API_KEY` (runtime) | 등록돼 있음. mock 모드에서는 쓰지 않는다 |

**`Dockerfile`** — `node:22-slim` 4단계 빌드

| 단계 | 하는 일 |
|---|---|
| `deps` | `app/package.json` · `package-lock.json` 으로 `npm ci` |
| `build` | `npm run build`(Next standalone 산출물) + `npm run build:deploy`(시작 단계를 esbuild 로 단일 파일 `bootstrap.cjs` 로 묶음 — 런타임 이미지에 tsx · devDependencies 를 넣지 않는다). 빌드 중에는 DB · 원본 · AI 를 읽지 않는다 |
| `raw` | 원본 CSV 고르기 — `app/src/domain/files.ts` 의 `MASIL_FILES` 에 적힌 **`02_masil/…csv` 17개만** `/out` 으로 복사. 목록의 파일이 하나라도 없으면 **빌드가 실패**한다. 원본 폴더는 한글 이름 대신 `01_*/04_*` 패턴으로 찾는다(유니코드 정규화 차이 회피) |
| `runner` | standalone 서버 + `.next/static` + `bootstrap.cjs` + `drizzle/migrations` + `start.sh` + 원본 CSV(`/data/raw`, 쓰기 금지). `ENV RAW_DATA_DIR=/data/raw` · `PORT=3000` · `HOSTNAME=0.0.0.0` · `NODE_ENV=production`. **`USER node`**(root 아님). `CMD ["./start.sh"]` |

- 원본 CSV 는 `/data/raw` — 웹 공개 경로(`.next/static` · `public`) 밖이에요. `app/public` 폴더는 없어요.
- 이미지에 담는 원본은 **CSV 17개뿐**이에요. 계약 통보서 · 승인 권한 정책 · covenant · 회의록 등 **md 문서 6개는 담지 않아요** — 런타임이 파일로 읽지 않고, 그 값은 코드(시드 · 규칙)에 옮겨 적혀 있으며 화면에는 출처 경로로만 나와요(`files.ts` `DOC_FILES`).

**`.dockerignore`** — 허용 목록 방식: 첫 줄 `*` 로 전부 제외한 뒤 `app`(단 `node_modules` · `.next` · `build` · `tests` · `index.html` · `docker-compose.yml` 제외)과 `01_*/04_*/02_masil` 만 허용. 어디에 있든 `.env` · `.env.*` · `.git` · `.claude` · `.codex` · `.agents` · `.axhub` 는 제외. 문서 · 대회 자료(PDF · html) · 다른 회사 폴더는 컨텍스트에 들어오지 않아요.

**시작 순서** (`start.sh` → `bootstrap.cjs` → `server.js`)

1. `DIRECT_DATABASE_URL`(없으면 `DATABASE_URL`)이 있으면 시작 단계 실행:
   1. **마이그레이션** — Drizzle 이 적용 이력을 기록하므로 여러 번 돌아도 안전. `DIRECT_DATABASE_URL` 일 때는 세션 잠금(advisory lock)으로 동시 시작을 줄 세운다. `DATABASE_URL`(트랜잭션 풀러)로 대신 돌 때는 잠금 없이 돈다.
   2. **운영 상태가 비어 있으면 SEED 저장, 이미 있으면 그대로 둔다** — 재시작 · 재배포가 진행 중인 시연 상태 · 처리 이력을 지우지 않는다.
   3. `raw_rows` 는 **적재하지 않는다** — 런타임은 `/data/raw` 파일을 직접 읽는다(`rawSource: FILES`). S-12 의 원본 행 수는 읽어 들인 메모리의 행 수.
2. 시작 단계가 **실패하면 종료 코드 1 이고 서버는 뜨지 않는다**(반쯤 준비된 상태로 요청을 받지 않음). 원본 CSV 를 못 찾아도 실패. 로그에는 원인 종류 · 코드만 남고 접속 문자열 · 키는 출력하지 않는다.
3. DB 주소가 하나도 없으면 메모리 저장소로 뜬다(로컬 확인용 — `/api/meta` `persistence: MEMORY`).
4. `exec node server.js`.

**상태 확인 `GET /api/healthz`** → `HealthView {status: 'ok'}`, `cache-control: no-store`. **DB · 원본 · 서비스 · AI 를 보지 않아요**(상태 확인은 로그인 없이 오고 짧은 시간 안에 200 을 받아야 해서). 환경 정보(접속 주소 · 키 · 모드)도 싣지 않아요. DB 까지 포함한 동작 확인은 `GET /api/meta` 로 해요.

**로컬 docker 확인 결과** (백엔드 보고 — 0.5코어 · 1GB 제한, 새 DB. 기획 미재확인)

| 항목 | 결과 |
|---|---|
| 빌드 | 성공, 약 56초 (한글 폴더명 우회 포함) |
| 기동 | 0.77초 |
| `GET /api/healthz` | 200 |
| `GET /api/meta` | `aiMode: MOCK` · `persistence: POSTGRES` · `rawSource: FILES` |
| 프리셋 `S1_7` 리셋 → 점검 | **7/7** |
| `GET /api/assessments/recorded` | 200 — 단 **알려진 결함(수정 중, BE-25)**: 번들을 거친 서버에서는 `basisCheck.ok` 가 `false` 로 나온다 |
| 원본 CSV · 내부 파일을 HTTP 로 요청 | 404 |
| 컨테이너 재시작 | 운영 상태 유지 (시드로 덮어쓰지 않음) |

기획이 직접 확인한 것: 위 파일들의 내용, `app/` 에서 `npm run check` 통과(2026-11-14 17:39 — 26 파일 · 2 건너뜀, 297 통과 · 4 건너뜀, `tests/api/healthz.test.ts` 3건 포함).

### 2-4. 미확인 — 실배포에서만 확인되는 것

로컬 docker 로 "한글 폴더명 `COPY`" · "실제 docker build" · "기동 시간(로컬 제한 사양)"은 확인됐어요(백엔드 보고). 남은 미확인:

| # | 미확인 | 왜 문제가 될 수 있나 | 확인되는 곳 |
|---|---|---|---|
| 1 | **axhub 빌더에서의 실제 빌드 (amd64)** | 로컬 빌드 환경과 CPU 구조 · 파일 시스템(한글 경로 정규화)이 다를 수 있다 | 배포 빌드 로그 |
| 2 | **실제 트랜잭션 풀러(`DATABASE_URL`) 위 저장소 동작** | 풀러는 세션 기능에 제약이 있다. 낙관적 잠금(`sim_state.version`) · 프리셋 재생 · 쓰기가 풀러 위에서 도는지. 로컬 확인은 풀러 없는 Postgres 였다 | 배포 뒤 4절 9번 |
| 3 | **실환경 기동 시간** | 시작 단계 + Next 기동이 `start_period` 90초 안에 끝나는지 | 배포 로그 · `axhub deploy verify` |
| 4 | **`axhub deploy check`** | 아직 돌리지 않았다 | 4절 3번 |

1 · 3 이 실패하면 새 서비스가 뜨지 않고 이전 서비스가 남아요. 2 가 실패하면 서비스는 뜨지만 쓰기가 실패해요 — 그때는 4절 "실패하면"으로 가요.

## 3. git 원격 저장소

| 원격 | 주소 | 용도 |
|---|---|---|
| `origin` | `https://git.axhub.ai/t-c7a0a6fe-…/a-67aa2c25-….git` | **axhub 배포** — push 하면 자동 배포 (맨 위 경고) |
| `github` | `https://github.com/dgKim1/aouraOperatingSystem.git` | 코드 백업 (비공개 저장소) — 배포와 무관 |

- axhub self-hosted 방식은 `origin` 이 axhub 저장소여야 해요. 그래서 원래 GitHub 였던 `origin` 을 `github` 로 이름을 바꿨어요.
- GitHub 반영은 `git push github main` 으로 따로 해요.

## 4. 배포 절차

모든 명령은 프로젝트 루트에서 실행하고, `export PATH="$HOME/.axhub/bin:$PATH"` 를 먼저 해요.
**사용자가 "배포"라고 했을 때만** 시작해요. 0번은 첫 docker 배포 전에 한 번 끝내 둬요.

0. **첫 docker 배포 전 준비** (한 번)
   - `app/` 에서 `npm run check` 통과.
   - 로컬 docker 확인(2-3 표)이 최신 작업본 기준인지 — Dockerfile · 시작 스크립트를 고쳤다면 다시 확인.
   - **기록 재생 `basisCheck` 결함(BE-25)이 고쳐졌는지** — 번들을 거친 서버(`next build` 사본 또는 docker 이미지)에서 `basisCheck.ok = true`. 고쳐지기 전에 배포하면 AI 증거 화면에 빨간 "불일치" 경고가 뜬 채로 올라가요. **2026-11-14 현재 수정 중**이에요.
   - **`AOURA_AI_MODE=mock` 을 runtime 으로 등록**(5절). 없으면 `prepare.required_env_missing` 으로 멈춰요.
1. **변경 확인** — `git status --short`
2. **기록 키 보호 확인 (커밋 전 필수)**
   ```bash
   git check-ignore .claude/settings.local.json .codex/hooks.json .agents/hooks.json
   ```
   세 줄이 모두 출력돼야 해요(exit 0). 하나라도 빠지면 **커밋 · push 하지 말고 멈춰요.**
3. **배포 전 점검** — `axhub deploy check --app aoura-os --tenant lounge --json`
   `fail` 항목만 고쳐요. `handling: stop`(대회 배포 마감)이면 아무것도 바꾸지 말고 메시지를 그대로 전해요.
4. **커밋** — 앱 변경만 스테이징해요(`git add app/ axhub.yaml Dockerfile .dockerignore docs/ …`). 원본 폴더(`01_참가자_배포용/`)는 이미 저장소에 있어야 해요 — 빌드가 저장소에서 CSV 를 꺼내요. `.claude/` `.codex/` `.agents/` `.axhub/` `.env*` 는 절대 커밋하지 않아요. `.gitignore` 는 고치지 않아요.
5. **push = 배포**
   ```bash
   git -c credential.interactive=false push origin HEAD:main
   SHA=$(git rev-parse HEAD)
   ```
6. **배포 ID 찾기** — `axhub deploy list --app aoura-os --tenant lounge --all --json` 의 `items` 에서 `commit_sha == $SHA` 인 항목의 `id` (push 직후엔 없을 수 있어 10초 간격으로 몇 번 재조회).
7. **결과 확인**
   ```bash
   axhub deploy verify <deployment_id> --app aoura-os --tenant lounge --wait --wait-timeout 9m --json
   ```
   `status: succeeded`, `production_live: true` 면 성공.
8. **상태 확인**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://aoura-os-oiw3.axhub.page/api/healthz   # 200
   curl -s https://aoura-os-oiw3.axhub.page/api/meta                                       # aiMode MOCK · persistence POSTGRES · rawSource FILES
   ```
9. **배포 후 점검 (첫 docker 배포 뒤 필수)** — 미확인 2 · 3 의 답이 여기서 나와요.

   | # | 점검 | 기대 |
   |---|---|---|
   | 1 | `GET /api/healthz` | 200 `{status: "ok"}` |
   | 2 | `GET /api/meta` | `aiMode: MOCK` · `persistence: POSTGRES` · `rawSource: FILES` |
   | 3 | `POST /api/scenarios/S1_7/reset` → `GET /api/scenarios/S1_7/check` | **7/7** (쓰기 · 프리셋 재생이 풀러 위에서 되는지) |
   | 4 | `GET /api/assessments/recorded` | 200, 기록 1건 · **`basisCheck.ok = true`**(이미지 안 원본으로 대조). 확인 도구: `node app/scripts/check-recorded-bundle.mjs <주소>`(읽기 전용 GET 한 번) |
   | 5 | `GET /data/raw/…csv` (원본 CSV 경로) | 404 — 원본이 주소로 내려받아지지 않는다 |

   그다음 [DEMO 0-6 시연 진행표](DEMO_SCENARIOS.md#0-6-시연-진행표-한-장-2026-11-14)대로 ①~④ + 기록 재생 화면을 한 번 돌리고, 완료 조건을 「충족」으로 다시 판정해요(DEMO 0-2). 3번 점검은 운영 상태를 프리셋으로 바꾸므로 시연 전에 [전체 초기화]를 해요.
10. (선택) GitHub 백업 — `git push github main`
11. 7절 이력 표에 결과를 적어요(실패도 적어요).

**실패하면**: `axhub deploy logs <deployment_id> --app aoura-os --tenant lounge`, `axhub deploy diagnose --app aoura-os --tenant lounge` 로 원인을 보고, 원인을 사용자에게 그대로 전해요. 준비 · 빌드 단계에서 실패하면 이전 서비스(지금은 옛 정적 페이지)가 그대로 남아요. `axhub up` 으로 우회하지 않아요.

## 5. 환경변수 · 하지 않는 것

| 이름 | 종류 · 단계 | 상태 | 값 |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | secret · runtime | **등록됨** (2026-11-12) | 비밀값 — 문서 · 채팅 · 커밋에 쓰지 않아요. mock 모드에서는 쓰이지 않아요 |
| `AOURA_AI_MODE` | 일반(plain) · **runtime** | **미등록 — 배포 전에 등록 필수**(`axhub.yaml` `env.required`) | `mock` (비밀값 아님) |
| `DATABASE_URL` | axhub 가 런타임에 주입 | **등록하지 않아요** | 트랜잭션 풀러 주소 — 앱의 조회 · 쓰기 |
| `DIRECT_DATABASE_URL` | axhub 가 런타임에 주입 | **등록하지 않아요** | 세션 단위 주소 — 시작 단계(마이그레이션 · 잠금 · 시드) 전용 |
| `PORT` | axhub 가 주입(`runtime.port`) | **등록하지 않아요** | 3000 |
| `RAW_DATA_DIR` | 이미지 `ENV` | 등록하지 않아요 | `/data/raw` |
| `MIGRATIONS_DIR` | 선택 | 등록하지 않아요 | 기본값 = 실행 위치의 `drizzle/migrations`(이미지에 들어 있음) |

- 앱 스크립트: `npm run build:deploy` — 시작 단계(`scripts/deploy/bootstrap.ts`)를 `build/deploy/bootstrap.cjs` 로 묶어요(Dockerfile 이 부름).
- **`AOURA_AI_MODE` 등록** — axhub 상태를 바꾸는 일이라 **사용자의 "배포" 지시 뒤**에 해요. **아래 `--from-dotenv` 방식을 쓰지 않아요**(그 방식은 stage 가 build 로 잡혀요). `axhub env set --help` 로 확인한 옵션: 위치 인자 `[KEY] [VALUE]` · `--stage <build|runtime|both>` · `--plain`(`--secret` 과 배타). 그에 따른 명령은 아래와 같아요 — **아직 실행해 본 적이 없어요(문법은 도움말 기준, 미검증)**. 실행 뒤 `env list` 로 이름 · 단계(runtime)를 반드시 확인해요.
  ```bash
  axhub env set AOURA_AI_MODE mock --app aoura-os --tenant lounge --stage runtime --plain
  axhub env list --app aoura-os --tenant lounge   # AOURA_AI_MODE 가 runtime 으로 보이는지
  ```
- 비밀값은 채팅으로 받지 않아요. 비밀값인 환경변수는 `app/.env.local` 에 넣고(git 제외됨) 아래처럼 등록해요. 값은 화면에 출력하지 않아요.
  ```bash
  # 처음 등록 (from-dotenv 는 stage 가 build 로 잡힘)
  axhub env set --app aoura-os --tenant lounge --from-dotenv app/.env.local --only <이름> --execute
  # 실행 시점에만 쓰는 값은 runtime 으로 변경 — 값은 파일에서 파이프로만 전달
  sed -n 's/^<이름>=//p' app/.env.local | tr -d '\r\n' | axhub env update <이름> --app aoura-os --tenant lounge --stage runtime --from-stdin
  axhub env list --app aoura-os --tenant lounge   # 값은 *** 로 표시
  ```
- **`axhub up`(저장소 없이 업로드) 금지** — 항상 axhub 저장소 push 로 배포해요.
- `lounge` 가 아닌 테넌트에 앱을 만들거나 배포하지 않아요.
- `.claude/` `.codex/` `.agents/` 폴더와 `.gitignore` 를 수정하지 않아요.
- 사용자가 "배포"라고 하기 전에는 `git push origin` · `axhub env set` · 배포 방식 변경을 하지 않아요.

## 6. 문제 해결 기록

| 증상 | 원인 | 해결 |
|---|---|---|
| 배포 실패 `resolve.spec_invalid` "앱의 배포 방식과 axhub.yaml의 deploy_method가 달라요" (준비 단계) | 앱은 docker 로 전환됐는데(2026-11-12) `axhub.yaml` 은 static 인 채로 `origin` 에 push 됨(커밋 `602a5c2`) | `axhub.yaml` 을 docker 구성(2절)으로 바꾼 커밋을 push. 그 전에는 `origin` 에 push 하지 않음. 실패해도 옛 정적 페이지는 그대로 남음 |
| import 실패 `static.output_missing` (from_dir=.) | (static 시절) 로컬 import 가 `root: app` 을 무시 | `root` 제거, `static_output_dir: app`. docker 에서는 `root` 를 아예 선언하지 않음(2절) |
| import 미리보기 "origin 이 이 앱의 axhub 저장소가 아니에요" | `origin` 이 GitHub | `git remote rename origin github` 후 재실행 |
| import 후 `.gitignore` 에 `.axhub/` `.claude/` `.codex/` 가 추가됨 | import 도구의 자동 커밋 | 원본으로 되돌림: `git checkout f501a3f -- .gitignore` 후 커밋. `.axhub/` 는 `.git/info/exclude` 로 제외 |
| `.axhub/`, `.DS_Store` 가 untracked 로 보임 | 로컬 상태 파일 | `.git/info/exclude` 에 등록돼 있음 (이 PC 전용) |
| `axhub: command not found` | PATH 미반영 | `export PATH="$HOME/.axhub/bin:$PATH"` |
| 로그인 만료 | 토큰 만료(약 24시간) | `axhub auth login --tenant lounge --json` → 브라우저 승인 → `axhub auth login --tenant lounge --resume-last --wait-approval 90s` |
| 배포가 시작 전에 멈춤 `prepare.required_env_missing` | `axhub.yaml` `env.required` 의 `AOURA_AI_MODE` 가 등록돼 있지 않음 | 5절대로 runtime 으로 등록 뒤 다시 배포 |
| 배포 실패 | — | `axhub deploy logs <deployment_id> --app aoura-os --tenant lounge`, `axhub deploy diagnose --app aoura-os --tenant lounge` |

## 7. 배포 이력

| 날짜 | 커밋 | 배포 ID | 결과 | 내용 |
|---|---|---|---|---|
| 2026-11-10 | `ec120e3` | `508cb106-1876-4fb6-bce5-7e6540d7c382` | 성공 | 첫 배포 (import, static) |
| 2026-11-10 | `a03d947` | `b5b8bfbf-c856-4406-bf7a-fd39376d8301` | 성공 | `.gitignore` 원복 후 재배포 (static) — **지금 떠 있는 옛 정적 페이지** |
| 2026-11-13 05:12 KST (UTC 2026-11-12 20:12 — `axhub deploy list` 의 `started_at`) | `602a5c2` | `64f40f5e-33db-4c53-960a-f0282477419a` | **실패** | 준비 단계 `resolve.spec_invalid` — "deploy method mismatch: app=docker manifest=static". 문서 커밋(온톨로지 · 시연 · 화면 명세)이 `origin` 에 push 된 것. 누가 push 했는지는 **미확인**(devlog LOG-030 은 사용자 직접 push 로 추정). 서비스 영향 없음 — 옛 정적 페이지 유지. 2026-11-14 `axhub deploy list` 로 확인 |

- 운영 시스템(docker)의 배포는 **아직 없어요.** 첫 docker 배포 결과를 이 표에 이어 적어요.
