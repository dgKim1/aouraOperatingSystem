# CLAUDE.md — Aoura 운영 시스템 (AX 인재전쟁 · W02)

모든 에이전트(기획 · 백엔드 · 프론트엔드 포함)가 이 프로젝트에서 지키는 공통 규칙이다. 응답은 한국어.

## 무엇을 만드는가
W02 「인플루언서 계약과 캠페인 집행」(Masil) 업무의 AI 운영 시스템.
입력 → 확인 → 판단 → **승인 요청 → 상태 변경** → 바뀐 상태가 **다음 판단에 반영**까지 실제로 돈다.

기준 문서 (작업 전에 관련 문서를 읽는다. 문서와 코드가 다르면 문서가 기준이고, 바꿀 땐 문서부터):
- `docs/PROBLEM.md` — 과제 · 완료 조건 5개 · 여섯 관점 · 자기점검
- `docs/W02_TASK.md` — 업무 흐름 · 원본 사실/규칙 · 데이터 연결 · 미해결 지점
- `docs/TECH_STACK.md` — 기술 스택 · 구조 · 역할 분담 · 폴더 구조
- `docs/DEPLOY.md` — 배포 (스킬 `aoura-deploy`, 트리거 "배포")

## 절대 규칙
1. **수정 금지**: `.claude/` `.codex/` `.agents/` 폴더, `.gitignore`, `01_참가자_배포용/` 아래 모든 원본 파일.
2. **커밋 전** `git check-ignore .claude/settings.local.json .codex/hooks.json .agents/hooks.json` 가 세 줄 모두 출력되는지 확인. 아니면 멈춘다. `.claude/` `.codex/` `.agents/` `.axhub/` `.env*` 는 커밋하지 않는다.
3. **비밀값**(API 키 등)은 채팅으로 받지 않고, 코드 · 문서 · 커밋에 쓰지 않는다. `.env` 와 `axhub env set` 만.
4. axhub 는 **lounge** 테넌트만. `axhub up` 사용 금지(저장소 push 배포만).
5. **원본과 가정 구분**: 모든 값 · 데이터에 출처를 단다 — `원본` · `집계` · `원본근거해석` · `가정` · `주장` · `모의`.
6. **주장은 사실이 아니다**: 회의록 · 부서 전망 · 기안의 예상 GMV · 재무팀 공식 전망은 `주장`으로 다룬다.
7. **원본 제약을 없애지 않는다**: 생산능력 · 계약 · 승인 권한 · 기한을 가정으로 지우지 않는다. 모의 회신에는 **거절 · 정보 부족** 케이스도 둔다.
8. **스케일**: 커머스 표본(`mkt_*`)과 풀스케일(계약 · 재고 · 자금) 금액을 더하거나 곱하지 않는다. 표본 결론은 비중 · 순위 · 방향까지.
9. **계산은 코드, 해석은 AI**: 권한 · 기한 · 공헌이익 · 재고 커버는 `app/src/domain/` 순수 함수로 계산하고 테스트한다. AI 출력의 숫자는 도구가 돌려준 값만 쓴다.
10. **권한 경계를 넘는 결정은 자동 확정하지 않는다** — 사람(권한자)에게 승인 요청을 만든다.

## 데이터 기준 (A05 · data_dictionary · calculation_definitions)
- CSV 구분자 `|`, 금액 원 단위 · 부가세 제외.
- 공헌이익 공식값은 **A05(v1.5) 5절 기준**: Net Revenue(GMV − 반품환불)에서 원가 · 마케팅비 · 채널수수료 · 출고/반품 물류비를 각 한 번씩 차감하고, 쿠폰 · 환불은 다시 차감하지 않는다. `calculation_definitions.md` 1.4 를 그대로 적용한 값(쿠폰 · 환불 이중 차감)은 비교용 참고값으로만 표시한다. 근거: A05 1절 · A01 4절 · 8절(구판 문서 · 원본 별첨과 충돌 시 A05 우선).
- 승인 권한은 `00_common/approval_authority_policy.md`. 기안 금액은 실제 기안 요청액으로 해석(`docs/W02_TASK.md` 3-3).

## 기술
Next.js(App Router) + TypeScript · axhub Postgres + Drizzle · `@anthropic-ai/sdk` (`claude-opus-5-5`, 단일 에이전트 + tool use) · Tailwind + shadcn/ui · Vitest.
AI 키가 없으면 모의(mock) 모드로 동작하고 화면에 `모의` 표시.

## 역할과 소유 영역 (TECH_STACK 3절)
- 기획 `aoura-planner`: `docs/` (코드 작성 안 함)
- 백엔드 `aoura-backend`: `app/src/domain/` `app/src/server/` `app/drizzle/` `app/scripts/` `app/src/app/api/`
- 프론트엔드 `aoura-frontend`: `app/src/app/`(api 제외) `app/src/components/`
- 남의 영역을 고쳐야 하면 직접 고치지 말고 무엇을 왜 바꿔야 하는지 보고한다. 공유 타입 `app/src/domain/types.ts` 는 백엔드 소유.

## 완료 기준
- `app/` 에서 `npm run check` (typecheck + lint + test) 통과. 통과 못 하면 "완료"라고 하지 않는다.
- 새 규칙 · 계산에는 단위 테스트, 시연 시나리오(정상 · 조건 변경 · 정보 부족/거절)에는 시나리오 테스트.
- 관련 `docs/` 갱신(무엇을 원본/가정으로 처리했는지 포함).
- 커밋 메시지는 한국어로 변경 요지. 배포는 사용자가 "배포"라고 할 때만.
