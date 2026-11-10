# 배포 가이드 — Aoura 운영 시스템 (axhub)

이 문서는 이 프로젝트를 axhub 에 배포하는 방법과, 첫 배포(2026-11-10) 때 겪은 문제·해결을 기록해요.
스킬 `aoura-deploy`(트리거: "배포")가 이 문서를 기준으로 동작해요.

## 1. 앱 정보

| 항목 | 값 |
|---|---|
| 앱 이름(표시) | Aoura 운영 시스템 |
| 앱 slug | `aoura-os` |
| 앱 ID | `67aa2c25-3329-4ee9-8cb7-3b5114266cf2` |
| 테넌트(조직) | `lounge` (ID `c7a0a6fe-86c6-45f4-adc2-3ab7bd19ea36`) — **반드시 lounge** |
| 배포 방식 | `static` (정적 사이트) |
| 코드 저장 위치 | axhub self-hosted 저장소 (`git_backend: selfhosted`) |
| 앱 주소 | https://aoura-os-oiw3.axhub.page |
| CLI | axhub CLI (`~/.axhub/bin/axhub`), 로그인 계정 lounge 멤버 |

## 2. 폴더 구조와 배포 범위

```
삼일PwC_프로젝트폴더/
├── axhub.yaml          ← 배포 설정 (저장소 최상위)
├── app/                ← 웹에 공개되는 폴더 (index.html 필수)
│   └── index.html
├── docs/DEPLOY.md      ← 이 문서
├── 01_참가자_배포용/    ← 대회 자료 — 저장소에는 있지만 웹에는 공개되지 않음
├── .claude/ .codex/ .agents/ .gitignore   ← 수정 금지 (개인 기록 키)
└── README.md
```

`axhub.yaml`:

```yaml
version: axhub/v1
name: aoura-os
metadata:
  name: Aoura 운영 시스템
  description: AX 인재전쟁 배포 테스트 앱
build:
  deploy_method: static
  static_output_dir: app
```

- `static_output_dir: app` 이라서 **`app/` 폴더만** 웹에 올라가요. 대회 자료(PDF·원본 데이터)는 공개되지 않아요.
- `root: app` 은 쓰지 않아요 — import 도구가 로컬에서 `root` 를 반영하지 않아 `static.output_missing` 으로 실패했어요.
- 앱을 빌드가 필요한 구조(Vite 등)로 키우면 `app/` 안에 `package.json` 을 두고 `build.build`·`static_output_dir` 을 빌드 결과 폴더(예: `app/dist`)로 바꿔요. 서버가 필요해지면 `axhub apps deploy-method --app aoura-os --to docker` (되돌릴 수 없음 — 먼저 확인).

## 3. git 원격 저장소

| 원격 | 주소 | 용도 |
|---|---|---|
| `origin` | `https://git.axhub.ai/t-c7a0a6fe-…/a-67aa2c25-….git` | **axhub 배포** — push 하면 자동 배포 |
| `github` | `https://github.com/dgKim1/aouraOperatingSystem.git` | 코드 백업 (비공개 저장소) |

- axhub self-hosted 방식은 `origin` 이 axhub 저장소여야 해요. 그래서 원래 GitHub 였던 `origin` 을 `github` 로 이름을 바꿨어요.
- GitHub 반영은 `git push github main` 으로 따로 해요 (배포와 무관).

## 4. 배포 절차 (재배포)

모든 명령은 프로젝트 루트에서 실행하고, `export PATH="$HOME/.axhub/bin:$PATH"` 를 먼저 해요.

1. **변경 확인** — `git status --short`
2. **기록 키 보호 확인 (커밋 전 필수)**
   ```bash
   git check-ignore .claude/settings.local.json .codex/hooks.json .agents/hooks.json
   ```
   세 줄이 모두 출력돼야 해요(exit 0). 하나라도 빠지면 **커밋·push 하지 말고 멈춰요.**
3. **배포 전 점검** — `axhub deploy check --app aoura-os --tenant lounge --json`
   `fail` 항목만 고쳐요. `handling: stop`(대회 배포 마감)이면 아무것도 바꾸지 말고 메시지를 그대로 전해요.
4. **커밋** — 앱 변경만 스테이징해요(`git add app/ axhub.yaml docs/ …`). `.claude/` `.codex/` `.agents/` `.axhub/` `.env*` 는 절대 커밋하지 않아요.
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
8. **실제 화면 확인**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://aoura-os-oiw3.axhub.page   # 200
   ```
9. (선택) GitHub 백업 — `git push github main`

## 5. 하지 않는 것

- **`axhub up`(저장소 없이 업로드) 금지** — 항상 axhub 저장소 push 로 배포해요.
- `lounge` 가 아닌 테넌트에 앱을 만들거나 배포하지 않아요.
- `.claude/` `.codex/` `.agents/` 폴더와 `.gitignore` 를 수정하지 않아요.
- 비밀값을 채팅으로 받지 않아요. 필요한 환경변수는 `.env` 에 넣고 `axhub env set --app aoura-os --from-dotenv .env --only <이름> --execute` 로 등록해요.

## 6. 문제 해결 기록

| 증상 | 원인 | 해결 |
|---|---|---|
| import 실패 `static.output_missing` (from_dir=.) | 로컬 import 가 `root: app` 을 무시 | `root` 제거, `static_output_dir: app` |
| import 미리보기 "origin 이 이 앱의 axhub 저장소가 아니에요" | `origin` 이 GitHub | `git remote rename origin github` 후 재실행 |
| import 후 `.gitignore` 에 `.axhub/` `.claude/` `.codex/` 가 추가됨 | import 도구의 자동 커밋 | 원본으로 되돌림: `git checkout f501a3f -- .gitignore` 후 커밋. `.axhub/` 는 `.git/info/exclude` 로 제외 |
| `.axhub/`, `.DS_Store` 가 untracked 로 보임 | 로컬 상태 파일 | `.git/info/exclude` 에 등록돼 있음 (이 PC 전용) |
| `axhub: command not found` | PATH 미반영 | `export PATH="$HOME/.axhub/bin:$PATH"` |
| 로그인 만료 | 토큰 만료(약 24시간) | `axhub auth login --tenant lounge --json` → 브라우저 승인 → `axhub auth login --tenant lounge --resume-last --wait-approval 90s` |
| 배포 실패 | — | `axhub deploy logs <deployment_id> --app aoura-os --tenant lounge`, `axhub deploy diagnose --app aoura-os --tenant lounge` |

## 7. 배포 이력

| 날짜 | 커밋 | 배포 ID | 결과 | 내용 |
|---|---|---|---|---|
| 2026-11-10 | `ec120e3` | `508cb106-1876-4fb6-bce5-7e6540d7c382` | 성공 | 첫 배포 (import) |
| 2026-11-10 | `a03d947` | `b5b8bfbf-c856-4406-bf7a-fd39376d8301` | 성공 | `.gitignore` 원복 후 재배포 |
