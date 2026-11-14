# 화면 명세 (W02)

> 작성 2026-11-12 · 기획(aoura-planner) · 대상 · 규칙 ID 는 [ONTOLOGY.md](ONTOLOGY.md), 시연 흐름 · 골든 값은 [DEMO_SCENARIOS.md](DEMO_SCENARIOS.md).
> 프론트엔드는 **API 가 돌려준 값만 표시**한다(계산 · 권한 판정 · 상태 전이 로직을 화면에 두지 않음). 4절 API 는 백엔드 2단계에서 **확정**됐다(2026-11-14, 기준 타입은 `app/src/domain/api-types.ts`).
> **2026-11-14 갱신**: 프론트엔드 1단계 보고(「기획 문서와 다른 점」 5건) 반영 — 역할 목록 정리(SCM 하나), 시점 이동은 2단계 API, 필수/선택 기능 구분(5-1), 재고 경고 표시 시점, 외부 회신 양식 대응(4-1). S-10 공식 전망 표시는 **결정됨**(아래 줄). 후속 작업 FE-01~FE-06 · BE-06 · BE-07 · BE-10 은 [ONTOLOGY 7절](ONTOLOGY.md#7-1단계-구현-반영--후속-작업-2026-11-14).
> **2026-11-14 갱신(2)**: 백엔드 2단계 API(24개) 확정 반영 — 4절을 실제 경로 · 응답 타입(`api-types.ts`) · 오류 형식으로 다시 씀, 4-1 외부 회신 최종 처리(A-33 · A-34), 보충요청 종결 문구 3종(S-07), S-05 도구 호출 · 모의 대체, S-11 대상 7종, S-12 공백 상태. 새 작업 FE-07~FE-11 · BE-11~BE-16 은 [ONTOLOGY 8절](ONTOLOGY.md#8-2단계-백엔드-반영--완료-조건-점검--후속-작업-2026-11-14).
> **2026-11-14 갱신(3)**: 프론트엔드 2단계(LOG-017) 반영 — 문서와 다르게 만든 6건 판정([ONTOLOGY 9-2](ONTOLOGY.md#9-2-프론트엔드가-문서와-다르게-만든-6건--판정-log-017)): 기안 접수 25건 전체(S-02) · 시연 시각 바로가기(S-01) · [권한 검증 확인](S-06) · 결과 보관함(0-4) · S-13 현재 지점만 점검 채택, 실시간 AI 문장의 `원본근거해석` 배지 기각(S-05). 실시간 AI 보류로 시연은 `AI: 모의`(0-1). 작업 처리는 담당 역할만(S-07 · 4절, A-35 · BE-17).
> **2026-11-14 갱신(4)**: 3단계(백엔드 LOG-022 · 025, 프론트엔드 LOG-023) 반영 — S-01 기한별 건수 정정(원본 5 · 12 · 8건), 자동 갱신 경고 「다음 행동」 상태별 표(0-3), S-01 · S-03 반려 · 재검토 배너와 「1년 배분 선점」 박스, 4절 새 API · 필드(`GET /api/receivables` · `AuditRowView` · 보충요청 행 · 비교표 · `cashEvents` · `actorRole` 필수), 판단안 미확인 목록의 공백 상태(S-05, BE-21), 재상신 근거 판단안(S-06 · S-07). 결정 · 새 작업은 [ONTOLOGY 10절](ONTOLOGY.md#10-3단계-반영--판단-3건--재상신-규칙--후속-작업-2026-11-14).
> **2026-11-14 결정(사용자)**: S-10 은 재무팀 공식 전망(주장)을 재전망(집계)과 **한 차트 · 한 비교표에서 대조**한다(이유: 주장과 현재 재전망의 차이를 한눈에). 공식 전망은 대조 전용 — 권한 판정 · 하회 구간 · 경고 · 권고에는 쓰지 않는다. 0-2 · S-10 · UI-03 · 4절 · 5-1 반영, 주간 대응 기준은 가정 A-32.

## 0. 공통

### 0-1. 레이아웃 (모든 화면)
| 영역 | 내용 | 비고 |
|---|---|---|
| 상단 제목 | **W02 · 인플루언서 계약과 캠페인 집행** (Masil · 마케팅) | 자기점검 "업무 번호를 제출 화면에 표시" |
| 기준시각 | `가상 기준시각 2026-07-01 09:00` + [시점 이동] 버튼 | 가정 배지(A-21). 실제 날짜와 다르다는 툴팁. 시점 이동은 **2단계 API**(`GET /api/clock/preview` · `POST /api/clock/advance`, BE-07)로 동작한다. 1단계(API 전)에는 버튼 비활성 + "시연 시나리오 프리셋으로 시점 이동" 안내를 허용 |
| AI 모드 | `AI: 실시간` 또는 **`AI: 모의`** 배지 | 키 없음 · 호출 실패 · `AOURA_AI_MODE=mock` 이면 모의. 모의면 판단안 문장 옆에도 `모의` 배지. **시연은 모의**(2026-11-14 사용자 결정 — 실시간 확인 보류, ONTOLOGY 9-1). `모의` 표시를 숨기지 않는다 |
| 역할 전환 | `현재 역할: 마케팅팀 ▾` (마케팅팀 · Masil 대표 · 그룹 CEO/이사회 · SCM · 계약 담당 · 에이전시(모의)) | 시연용. 승인 회신은 해당 권한 역할일 때만 버튼 활성. **SCM 은 역할 하나**로 보충 검토 회신(S-07 · S-09, 승인 아님)과 보충 발주 승인 회신(S-06, `requiredRole = SCM` 일 때만)을 모두 한다 — 둘은 역할이 아니라 버튼(행동 종류)으로 구분한다(ONTOLOGY 1-3 역할, FE-01). "SCM 회신(모의)" 별도 역할은 두지 않는다 |
| 왼쪽 메뉴 | 운영 현황 · 사건 입력 · 전속계약 · 확대 기안 · 승인함 · 작업 · 분석(성과 · 재고 · 자금) · 처리 이력 · 데이터 출처 · 시연 시나리오 | |
| 배지 범례 | 원본 · 집계 · 원본근거해석 · 가정 · 주장 · 모의 + 스케일(풀스케일 · 표본) | 화면 하단 고정 |

### 0-2. 배지 규칙
- `SourceBadge` — 라벨 6종 고정 색: 원본(회색) · 집계(파랑) · 원본근거해석(청록) · 가정(주황) · **주장(보라, 취소선 아님)** · 모의(점선 테두리). 클릭 시 팝오버: `refs`(파일 · 컬럼 · 행 키) · `method`(계산식) · `assumptionIds`.
- `ScaleBadge` — 금액 옆에 `풀스케일` / `표본`. **표본 금액과 풀스케일 금액을 한 합계 행 · 한 축 차트에 두지 않는다.** 같은 카드에 둘 때는 세로 구분선 + "서로 더하거나 곱하지 않음" 문구.
- 주장(CLAIM) 값은 판단 근거 영역에 두지 않고 **「주장 · 참고」 접힘 영역**에만 둔다(예: 기안 예상 GMV, 회의록 문장). **예외 — 대조 전용 표시**: S-10 의 재무팀 공식 전망 대 재전망 차트 · 비교표는 접지 않고 보여주되, 공식 전망 값마다 `주장` 배지를 붙인다. 이 값은 판단 문구 · 경고 · 권고 · 권한 판정에 쓰지 않는다(2026-11-14 사용자 결정).
- 미확인 값은 빈칸이 아니라 `미확인` 칩 + 공백 ID(G-xx) 링크.

### 0-3. 경고 컴포넌트 (여러 화면 공통)
| 경고 | 조건(API 가 계산) | 표시 |
|---|---|---|
| 승인 권한 경고 | `routing.requiredRole` ≠ 기본 권한자, 또는 권한자 변경 발생 | "그룹 CEO/이사회 승인 필요 — covenant 하회 예상 구간(7/21~8/21)에 집행일 포함 (R-AUTH-03)" + 이전 권한자 취소선 |
| 기한 경고 | R-DL-03: D-7 경고(노랑) · D-3 위험(빨강) · 경과 | 남은 일수 + "기한 경과 시: 자동 확정(철회 불가)" / "자동 갱신(= 체결)" |
| 자동 갱신 경고 | 계약이 `AUTO_RENEWED` 로 갈 수 있는 상태 + 기한 D-7 이내 | 빨강 배너 "통보 없이 7/17 이 지나면 연 28억 계약이 권한 승인 없이 체결됩니다" + **계약 상태별 「다음 행동」**(아래 0-3-1) |
| 계약 연결 경고 | `CONTRACT_PENDING` | "기안을 부결해도 전속계약은 자동 갱신될 수 있습니다 — 계약 결정 별도 필요" + 계약 링크 |
| 재고 커버 경고 | `INVENTORY_BELOW_MIN` / `STOCKOUT_BEFORE_SETTLEMENT` | "더마 SKU-1004 커버 2.2주 (< 4주), 예상 품절 7/15, 지금 발주 시 도착 10/12 > 집행일 8/31" (7/20 기준 예). 도착일은 `simNow` 에 따라 바뀌는 API 계산값이다(7/1 이면 9/23). PLAN-011 경고는 **7/1 기안 접수 직후부터** 보이는 것이 맞다 — 게이트 조건이 그때 이미 성립(ONTOLOGY 4-4) |
| 성과 방향 경고 | `CP_NEGATIVE` (공식값 A05 기준) | "실질 공헌이익(공식값) 음수 — 부결 권고" |
| 참고 플래그 (경고 아님) | `CP_REF_SIGN_DIFFERS` | 회색 참고 칩 "1.4 문자 그대로(이중 차감) 참고값은 음수 — 판단에 쓰지 않음". 심각도 목록 · S-01 경고 목록에 넣지 않음 |
| 수령 미확인 | 계약 `NOTICE_SENT` · `NOTICE_UNCONFIRMED` | "통보 발송됨 · 수령 미확인 — 통보 완료로 보지 않음 (확장 E1)" |

### 0-3-1. 자동 갱신 경고의 「다음 행동」 — 계약 상태별 (2026-11-14, LOG-025 구현 확인)
경고 `AL-AUTO-RENEWAL` 의 `nextAction {text, href, role}` 은 서버가 계약 상태로 정한다(`server/views` `autoRenewalNextAction`). 화면은 그대로 보인다. 상태와 맞지 않는 고정 문구("그룹 CEO/이사회 승인 → 통보 발송"만 보이는 것)는 결함이다 — 반려 뒤에는 권한자가 아니라 계약 담당이 움직여야 한다.

| 계약 상태 | 다음 행동 (누가 · 무엇을) | 이동 | 역할 |
|---|---|---|---|
| `ACTIVE` (유효) | 계약 담당: 사건 입력에서 갱신 통보 접수 | S-02 `/events` | 계약 담당 |
| `UNDER_REVIEW` (검토 중) | 계약 담당: 판단안 만들기 → 승인 요청 상신 | S-03 | 계약 담당 |
| `PENDING_APPROVAL` (승인 대기) | {대기 요청의 권한자} 승인 회신 → 계약 담당 통보 발송 | S-06 그 요청 상세(대기 요청이 없으면 S-03) | 요청의 `requiredRole`(계약은 그룹 CEO/이사회) |
| `REVIEW_BEFORE_DEADLINE` (반려 · 재검토 중) | 계약 담당: **열려 있는 작업만** 나열(정보 요청 회신 확인 · 기한 전 재검토 · 재상신) → 그룹 CEO/이사회 재승인 | S-07 `/tasks` | 계약 담당 |
| `NOTICE_PENDING` (통보 대기) | 계약 담당: 통보 발송 작업 완료 (기한 전) | S-07 | 계약 담당 |

- 이 다섯 상태가 기한 경과 시 `AUTO_RENEWED` 로 가는 상태 전부다(ONTOLOGY 3-1). 통보를 보낸 뒤(`NOTICE_SENT` · `NOTICE_UNCONFIRMED`)는 이 경고가 아니라 「수령 미확인」 경고가, `AUTO_RENEWED` 뒤에는 "자동 갱신되었습니다 — 권한 미경유 체결" 경고(다음 행동: 그룹 CEO/이사회 사고 대응 작업 확인, S-07)가 나온다.
- 문구에 금액 · 날짜를 새로 계산해 넣지 않는다(기한 · 금액은 경고 제목 · 상세의 서버 값).

### 0-4. 결과 패널 · 결과 보관함 (2026-11-14, DD-037 채택)
- 모든 쓰기(회신 · 작업 · 사건 입력 · 시점 이동 · 판단안 · 상신 · 보충 초안)는 누른 버튼 자리에 **결과 패널**을 보여준다 — `MutationResult` 의 `transitions` · `createdTasks` · `createdApprovals` · `summary` 를 링크와 함께(UI-05). 오류면 `message` 를 그대로(FE-11).
- 처리한 행이 재조회 뒤 목록에서 사라지는 화면(작업의 「열린 작업」 표, 승인함 대기 목록 등)에는 **결과 보관함**: 마지막 결과 1건을 그 화면 위쪽에 고정한다. 같은 화면(경로)에서만 보이고, [닫기]로 지우며, 브라우저 메모리라 새로고침하면 사라진다. **영구 증거는 S-11 처리 이력**이다 — 보관함은 증거 저장소가 아니다.

## 1. 화면 목록 · 라우트

| ID | 화면 | 라우트 | 주 사용자 | 시연 |
|---|---|---|---|---|
| S-01 | 운영 현황 | `/` | 모두 | ①②③④ |
| S-02 | 사건 입력 | `/events` | 시연자(계약 담당 · 재무 · 외부 모의) | ①②③④ |
| S-03 | 전속계약 상세 | `/contracts/[id]` | 계약 담당 · 그룹 CEO/이사회 | ①③ |
| S-04 | 확대 기안 상세 | `/proposals/[id]` | 마케팅팀 · Masil 대표 | ①②④ |
| S-05 | 판단안 | `/assessments/[id]` | 권한자 · 담당자 | ①②③④ |
| S-06 | 승인함 / 승인 요청 상세 | `/approvals`, `/approvals/[id]` | 권한자(역할 전환) | ①②③④ |
| S-07 | 작업 | `/tasks` | 담당 역할 | ①②③④ |
| S-08 | 인플루언서 성과 순위 | `/analysis/influencers` | 마케팅 · 재무 | ①④ |
| S-09 | 재고 커버 | `/analysis/inventory` | SCM · 마케팅 | ④ |
| S-10 | 자금 재전망 · covenant | `/analysis/cash` | 재무 | ② |
| S-11 | 처리 이력 | `/history` | 모두 · 심사 | 전부 |
| S-12 | 데이터 출처 · 가정 · 공백 | `/data` | 심사 | 완료 조건 5 |
| S-13 | 시연 시나리오 | `/scenarios` | 시연자 | 프리셋 |

## 2. 화면별 명세

### S-01 운영 현황 `/`
- **목적**: "지금 기한 안에 누가 무엇을 결정해야 하는가"를 한 화면에서. 담당자가 다음 행동(상신 · 회신 · 작업)으로 바로 이동.
- **표시**
  1. **기한 타임라인** (가로축 7/1 ~ 9/30): 7/17(계약 통보 기한 + 기안 5건 70,902,290) · 8/14(12건 80,734,739) · 9/11(8건 29,166,243) 마커 [건수 · 합계는 집계 · 표본 — `mkt_budget_plan_ms.csv` 를 `contract_deadline` 으로 묶어 `requested_budget_krw` 합산, 2026-11-14 원본 재확인. 첫 판의 「10건 · 10건」은 오기], **covenant 하회 예상 구간 음영**(v1 7/21~8/21, 조건 변경 후 v2 7/21~8/28 로 늘어나는 것이 보여야 함 [집계 · 풀스케일]), 계약 만료 8/31, 기발주 대금 7/21, 기발주 입고 9/14~9/18 [집계 · 가정 A-20]. 각 마커에 상태 색(미결 · 승인 · 부결 · 자동 확정).
  2. **결정 대기 카드**: 승인요청별(권한자 · 대상 · 기한 · 남은 일수 · 권고). 예 "APR-001 그룹 CEO/이사회 · INF-001 전속계약 · D-16 · 권고: 조건변경 통보".
  3. **경고 목록**: 0-3 경고를 심각도순.
  4. **전속계약 카드**: 상태 · 고정 피 28억 [원본 · 풀스케일] · 성과 피 `미확인`(G-02) · 통보 기한 · 수령확인 여부.
     - **반려 · 재검토 중 배너** (계약 `REVIEW_BEFORE_DEADLINE`, LOG-023 구현): "반려 · 재검토 중" 배지 + 자동 갱신 경고의 「다음 행동」(0-3-1)을 같은 카드에 둔다. 반려를 미갱신 확정처럼 보이게 하지 않는다(AC-3-01).
     - **「1년 배분 선점」 박스** (계약 `AUTO_RENEWED`, LOG-023 구현): "자동 갱신으로 고정 피가 확정되었습니다 (권한 미경유 체결)" + 갱신 기간 · 고정 피 [원본 조건 · 풀스케일] + 해지 위약금 9/30 → 1,283,333,333 · 12/31 → 933,333,333 [집계 · 풀스케일 · 가정 A-15]. 위약금은 **서버 계산값**(`GET /api/contracts/:id/penalty`)만 쓰고 화면에서 계산하지 않는다. "표본 성과와 곱하지 않음" 문구를 함께 둔다.
  5. **작업 요약**: 열린 작업 수 · OVERDUE 수, 역할별.
  6. **최근 처리 이력 5건**.
- **사용자 행동**: 카드 클릭 → S-03/S-04/S-06/S-07. [시점 이동] (모달: 날짜 · 시각 입력, 지나가는 기한 목록 미리보기 → 확인). 미리보기는 서버가 저장 없이 기한 감시를 돌려 준 결과(`GET /api/clock/preview`)를 그대로 보여준다 — 지나가는 기한은 `passingDeadlines`(계약 통보 · 기안 확정기한 · 승인요청 · 작업), 일어날 전이는 `transitions`, 생길 작업은 `createdTasks`. 화면에서 날짜 비교로 만들지 않는다(BE-07 구현됨 · FE-02). 예: ① S1-6 뒤 7/18 미리보기에 미완료 작업(승인조건 문서화 · 그룹 보고)이 있으면 OVERDUE 전이로 함께 보인다(DEMO S1-7).
  - **시연 시각 바로가기** (2026-11-14 채택, ONTOLOGY 9-2 ②): 모달에 DEMO_SCENARIOS 의 사건 시각 버튼을 둔다 — 날짜 입력을 채울 뿐 이동은 [미리보기] → [이동]을 거친다. 현재 기준시각 이전 시각은 서버가 409 `CLOCK_BACKWARD` 로 막고 그 문구를 보인다. 시각은 DEMO 와 같아야 한다: ① 7/10 14:00 · 7/13 10:00 · 7/14 11:00 · 7/18 00:00, ② 7/14 10:00 · 7/15 15:00, ③ 7/13 16:00 · 7/14 11:00(재상신) · 7/15 10:00 · 7/16 10:00 · 7/17 09:00 · 7/17 15:00 · 7/18 00:00, ④ 7/20 09:00. **12개 구현됨**(FE-14, LOG-023 — `shell/clock-dialog.tsx` 코드 확인).
- **상태 변경 후 반영**: 회신 · 시점 이동 후 타임라인 마커 색 · 경고 목록 · 카드가 서버 재조회로 바뀐다(①: 7/18 이동 후 7/17 경고 사라짐, ③-B: 계약 카드 `자동 갱신됨(권한 미경유 체결)` 빨강).
- **빈 상태**: 사건 미접수 → "접수된 통보 · 기안이 없습니다. [사건 입력] 또는 [시연 시나리오]".
- **오류**: API 실패 시 마지막 성공 시각 표시 + 재시도. 숫자를 캐시로 대신 보여주지 않는다.

### S-02 사건 입력 `/events`
- **목적**: 시스템의 **입력 지점**. 원본 문서 접수와 모의 사건 · 회신을 같은 방식으로 넣는다.
- **입력 양식(이벤트 유형별)**
  | 유형 | 필드 | 라벨 |
  |---|---|---|
  | 갱신 통보 접수 | 계약 선택(INF-001), 원본 문서 링크 | 원본 |
  | 확대 기안 접수 | 기안 PROP-2026-07 — **25건 전체** (건 범위 선택 없음 — 권한 판정 기안 총액이 25건 합이라 일부 접수는 권한자를 낮춘다. 판단 범위는 S-04 행 선택 → 판단안. ONTOLOGY 1-3 Event · BE-20) | 원본 |
  | 회수 지연 통보 | AR 선택(MAR-xxxx, 현재 만기 · 미회수 금액 표시), 새 만기일. 목록은 `GET /api/receivables`(21행 [원본 `fin_ar_aging_ms.csv` · 풀스케일]) — 원본 만기 · 현재 만기(이미 지연 사건이 있으면 `모의`) · 재전망 포함 여부(연체 제외 A-08)를 서버 값 그대로 | **모의** |
  | 기안 조건 정정 | 건 선택, 요청액 · 집행일(둘 중 하나 이상) | **모의** |
  | 외부 회신 | 상대(에이전시 · SCM · Corevia), 결과(수령확인 · 정보 제공 · 정보 부족 · 거절), 본문. SCM · Corevia 정보 제공이면 입고 예정일, SCM 정보 제공이면 보충 필요 여부 추가 — 처리는 4-1 | **모의** |
- **검증 오류**: 필수값 누락 → 필드 오류. 과거로 가는 날짜 → "기준시각 이전 사건은 넣을 수 없습니다". 존재하지 않는 ID → 404 메시지.
- **제출 후**: 처리 결과 요약 패널 — "상태 변경 n건 · 생성된 작업 n건 · 권한자 변경 n건 · 새 판단안 필요 여부" + 각 링크. (②: "PLAN-004 권한자 Masil 대표 → 그룹 CEO/이사회, 재승인 필요" 가 바로 보여야 함)
- **판단 실행 버튼**: [AI 판단안 만들기] (대상 선택). 모의 모드면 버튼 옆 `모의` 배지. 에이전시(모의) 역할에서는 숨긴다(외부 상대 — FE-14). 사건 입력 양식 자체는 역할과 무관하게 쓸 수 있다(사건 기록은 결정이 아님 — ONTOLOGY 1-3 쓰기 행위별 허용 역할, A-36).

### S-03 전속계약 상세 `/contracts/[id]`
- **목적**: 계약 갱신 결정을 권한자에게 올리고, 통보 · 수령확인까지 추적.
- **탭 1 개요**
  - 계약 조건 표(ONTOLOGY 1-2 ExclusiveContract): 각 값 + 원본 배지 + `inf001_exclusive_contract_notice.md` 링크. 성과 피 `미확인`(G-02) — 에이전시 모의 「정보 제공」 뒤에는 회신 문구 + `모의` 배지(A-33, API `performanceFee` 가 `Txt`(MOCK)로 옴). 이때도 권한 판정은 "연 금액 하한" 문구 그대로. 고정 피 지급 일정 `미확인`(G-09).
  - **상태 스테퍼**: 접수 → 검토 → 상신 → (승인/반려·재검토) → 통보 → 수령확인 → 결과. 현재 상태 강조, 분기(반려 · 자동 갱신 · 수령 미확인) 표시.
  - **기한 카운트다운**: 통보 기한 7/17, 내부 기한(승인 7/15 · 발송 7/16) [가정 A-12].
  - **권한 판정**: "연 금액 하한 2,800,000,000 > 1,000,000,000 → 그룹 CEO/이사회 (R-AUTH-02) · 미통보 자동 갱신도 체결" [원본].
  - **연결된 기안**: INF-001 기안 3건(PLAN-001~003) 상태 + "별개 결정" 문구(R-CON-01).
- **탭 2 성과 근거** (표본, 방향만): 집행 비중 40.58% (1위) · 요청 비중 28.0% (1위) · 실질 공헌이익(공식값 A05) −61,308,789 · 순위 10위 · 명목 ROAS 1.36 vs 실질 ROAS −0.198 (참고 접힘: 1.4 문자 그대로 cp −160,803,942 · 실질 ROAS −0.519). 상단 고정 문구 "표본 결과 — 28억과 곱하거나 더하지 않음". S-08 링크.
- **탭 3 판단안**: 최신 판단안(S-05 요약) + 버전 목록. 대안 A/B/C 비교 표(효과 · 위험 · 필요 권한자) · 권고 · 미확인(G-02 등).
  - 행동: [승인 요청 만들기] (판단안이 있고 상신 가능 상태일 때) · [판단안 다시 만들기].
- **탭 4 통보**: 통보 기록(발송 시각 · 내용 · 모의 배지), 수령확인(있음/없음, 증빙), 재통보 작업. 행동(계약 담당 역할): [통보 발송 기록] · (에이전시 모의 역할) [수령확인 회신].
- **탭 5 이력**: 이 계약의 AuditLog.
- **반려 · 재검토 중 배너** (`REVIEW_BEFORE_DEADLINE`, LOG-023 구현): 개요 위에 "반려 · 기한 전 재검토 — 미갱신 확정이 아닙니다" + 반려 사유 + 자동 갱신 경고의 「다음 행동」(0-3-1). S-01 계약 카드와 같은 내용.
- **상태 변경 후 반영**: ③-B 이후 개요에 "갱신 기간 2026-09-01 ~ 2027-08-31 · 고정 피 2,800,000,000 확정 [원본 조건 · 상태 자동 갱신]" + **위약금 계산기**(해지 예정일 입력 → R-PEN-01 결과, 가정 A-15 배지; 예 9/30 → 1,283,333,333, 12/31 → 933,333,333). 「1년 배분 선점」 박스(S-01 과 같은 서버 계산값)도 함께 둔다.
- **빈 상태**: 판단안 없음 → "아직 판단안이 없습니다 [AI 판단안 만들기]". 모의 모드면 판단안 문장에 `모의`.

### S-04 확대 기안 상세 `/proposals/[id]`
- **목적**: 25건을 기한 묶음별로 보고, 건마다 권한자 · 성과 방향 · 재고 · covenant 를 확인해 상신 묶음을 만든다.
- **상단 요약**: 기안 총액 180,803,272 [집계 · 표본] → "1억 초과 → 전 건 Masil 대표 이상 + 그룹 보고" [원본 규칙 · 원본근거해석 W02 3-3]. 건별 1천만 초과 5건. 기한별 합계(7/17 39.2% · 8/14 44.7% · 9/11 16.1%). 예상 GMV 합 1,923,937,023 은 **주장 접힘 영역**.
- **표 (기본 정렬: 기한 → 요청액 내림차순)**
  | 열 | 출처 |
  |---|---|
  | 건 · 캠페인 · 인플루언서 | 원본 |
  | 요청액 | 원본 · 표본 |
  | 집행일 · 확정기한 · 남은 일수 | 원본 · 집계 (`SETTLEMENT_BEFORE_DEADLINE` 아이콘, G-11) |
  | 권한자 (변경 시 이전 값 취소선 + 사유) | 집계 (규칙 ID) |
  | 성과 등급 + cp 공식값(A05, 캠페인 기준). 1.4 참고값은 기본 숨김 보조 열 + `CP_REF_SIGN_DIFFERS` 참고 칩 | 집계 · 표본 |
  | 재고 (주력 SKU 최소 커버, 경고 아이콘) | 집계 · 풀스케일 |
  | 플래그 칩 | 집계 |
  | 상태 | — |
- **필터**: 기한 묶음 · 권한자 · 등급 · 상태 · 플래그.
- **행 클릭 → 드로어(건 상세)**: 확대 대상 캠페인의 비용 분해(GMV → 반품환불 → Net Revenue → COGS · 채널수수료 · 배송 · 반품물류 · Marketing Spend → cp 공식값(A05 단일 차감). 그 아래 「참고: 1.4 문자 그대로」 접힘 — 쿠폰 · 반품환불 재차감 단계를 별도 색으로 "이중 차감(참고값)" 표시), 주력 SKU 재고 표, covenant 대조("집행일 8/28 ∈ 하회 구간 v2"), 연결 계약, 이력.
- **행동**: 행 선택 → [선택 건 판단안 만들기] → [승인 요청 만들기] (서버가 권한자별로 묶어 여러 요청을 만들 수 있음 — A-11; 요청 생성 결과를 모달로 보여줌).
- **상태 변경 후 반영**: ② 이후 PLAN-004 · PLAN-024 권한자 열이 `그룹 CEO/이사회` 로 바뀌고 "변경됨" 칩, PLAN-004 상태 `재승인 필요`. ④ 이후 PLAN-011 상태 `조건부 승인` + 조건 "집행일 9/21".
- **빈 상태**: 기안 미접수 → "기안이 접수되지 않았습니다".

### S-05 판단안 `/assessments/[id]`
- **목적**: AI · 규칙이 무엇을 받아 어떤 판단을 지원했는지 보여주고, 사람이 결정할 수 있게 근거 · 대안 · 불확실성을 나눠 보여줌.
- **구역**
  1. 헤더: 대상 · 트리거 사건 · 버전 · 생성 시각 · AI 모드(`실시간`/`모의`) · 모델명. 시연은 `모의`(ONTOLOGY 9-1).
  - **문장의 표지**: 모의 판단안의 권고 이유 · 관점 · 대안 문장은 `모의` 배지. 실시간 판단안 문장은 출처 배지 6종이 아니라 **「AI 작성」 표지** — `원본근거해석` 을 쓰지 않는다(근거 문구가 정해지지 않은 AI 문장을 원본 근거 해석처럼 보이게 함, ONTOLOGY 0 · 9-2 ⑥ · FE-12). 문장 속 숫자의 출처는 「확인한 사실」 배지와 숫자 출처 검증으로 보인다.
  2. **확인한 사실** (`facts`): `name`(표시명) · 값 + 배지 + 출처 (`key` 는 내부 식별자라 숨김). 도구 호출 목록(접힘, `toolCalls`): 도구명 · 입력 · 반환값 · 행위자(`AI` = 모델이 호출 / `SYSTEM` = 모의 모드에서 코드가 같은 도구를 실행). 숫자 출처 검증 결과(`provenance.ok`) 표시(FE-08).
  3. **규칙 결과** (`ruleResults`): 규칙 ID · 결과 · 입력값 (예 R-AUTH-03: settlementDate 2026-08-28 ∈ [07-21, 08-28] → GROUP_CEO_BOARD).
  4. **대안 비교 표**: 대안 · 효과(배지 포함) · 위험 · 필요한 권한자. 권고 대안 강조 + 이유.
  5. **관점별 근거**: 마케팅 · 재무 · 계약 · SCM.
  6. **미확인 · 공백**: G-xx 와 영향. **모의 회신으로 채워진 공백도 목록에서 빼지 않는다** (2026-11-14 결정, ONTOLOGY 10-1 ⓐ): `unknowns[].status = 'FILLED_BY_MOCK'` 인 항목은 `미확인` 칩 대신 `모의` 배지 + "모의 회신으로 보완 — 원본 공백은 그대로"(S-12 와 같은 문구 · 같은 상태값)로 보인다. 예: 에이전시 「정보 제공」 뒤 판단안의 G-02, 수령확인 뒤 G-03. 「확인한 사실」의 모의 값(성과 피 조건 `모의`)과 짝이 맞아야 한다(BE-21 · FE-15. 그 전에는 G-02 가 목록에서 빠져 해소된 것처럼 보인다 — 알려진 차이).
  7. **주장 · 참고** (접힘): 회의록 · 예상 GMV · 공식 전망 인용.
- **행동**: [승인 요청 만들기] · [다시 판단] · (권한자 역할이면) 승인 요청으로 이동.
- **오류**: AI 호출 실패 → 서버가 자동으로 모의 판단안을 만들고 `fallbackReason` 을 준다 → "실시간 호출 실패 → 모의로 생성: {fallbackReason}" 경고(오류 원문 · 키는 오지 않음). 판단안을 만드는 사이 상태가 바뀌면 409 `CONFLICT` → "다시 만들기" 안내(FE-11). `refusal` 이면 "AI 가 판단안 작성을 거절했습니다 — 규칙 결과만 표시" (규칙 결과 · 숫자는 그대로 보임).

### S-06 승인함 `/approvals` · 승인 요청 상세 `/approvals/[id]`
- **목적**: 권한자가 근거를 보고 결정(모의 회신)한다. **결정은 사람만**.
- **목록**: 내 역할(현재 역할) 대상 요청 우선, 열: ID · 대상 · 권한자 · 권한 근거 · 내부 기한 · 원본 기한 · 상태 · 버전. 다른 역할 요청은 회색(조회만).
- **상세**: 요청 요약(권고 · 대상 건별 권고) · 권한 근거(`routingReasons`, 규칙 · 배지) · 기한 · 판단안 스냅샷 링크 · 관련 경고.
  - **요청의 권고 = 근거 판단안의 권고**가 기본이다(재상신 포함 — ONTOLOGY 1-3 ApprovalRequest 「재상신 근거 판단안」). 상신자가 판단안과 다른 결정을 직접 지정한 요청(API 의 `payload.proposedDecision` — 화면 입력은 없음)은 권고 옆에 "상신자 지정 — 판단안 권고({판단안 권고})와 다름" 표시를 단다(`proposedSource = 'SUBMITTER'`, BE-22 · FE-16).
- **행동 (requiredRole 일 때만 활성)**:
  - [승인] (계약: 결정 선택 RENEW_SAME/RENEGOTIATE/TERMINATE), [조건부 승인] (조건 입력), [반려] (사유 필수), [정보 요청] (질문 필수). 기안 묶음은 건별 결정(승인 · 부결 · 보류 · 조건부) 표.
  - 다른 역할로 누르면 버튼 비활성 + "이 요청은 그룹 CEO/이사회만 결정할 수 있습니다". 서버 422 도 같은 문구로 표시.
  - **[권한 검증 확인]** (2026-11-14 채택, ONTOLOGY 9-2 ③): `PENDING` 요청을 권한 없는 역할로 볼 때만 보인다. 누르면 현재 역할을 `respondentRole` 로 권고안 승인 회신을 **서버에 실제로 보내** 422 `FORBIDDEN_ROLE` 문구를 그대로 보여주고, 상태가 바뀌지 않았음(상태 버전 · 요청 상태 그대로)을 표시한다. 화면 비활성만으로는 서버 검사를 보여줄 수 없어서 둔다 — 서버 검사가 깨지면 실제로 승인되는 진짜 시험이다(UI-04, DEMO S1-5).
  - 모든 회신은 `모의` 배지로 기록된다는 안내.
- **회신 후**: 결과 패널 — "상태 변경: 계약 PENDING_APPROVAL → NOTICE_PENDING · 생성 작업: 통보 발송(7/16), 승인조건 문서화" + 링크. 요청 상태 배지 갱신.
- **SUPERSEDED/EXPIRED** 요청은 상단에 "이 요청은 {새 요청 ID} 로 대체됨" / "기한 경과로 만료". 새 요청 상세에는 "이전 요청 {supersedesId} 대체 · v{version}". 이미 회신된 요청이 대체된 경우(② APR-003)는 상태 배지를 바꾸지 않고 "PLAN-004 는 재승인 요청 {새 요청 ID} 로 넘어감" 링크만 단다. 번호는 API 값으로 그린다(FE-05).
- **회신 유형 안내**: 기안 묶음에서 승인과 부결을 섞어 결정하면 회신 유형은 `승인`(APPROVED), 조건부 건이 하나라도 있으면 `조건부 승인`. 권고안 자체를 돌려보낼 때만 [반려](ONTOLOGY 1-3 ApprovalReply).

### S-07 작업 `/tasks`
- **목적**: 판단 이후 반복 처리(통보 · 재통보 · 재검토 · 재상신 · 정보 요청 · 그룹 보고 · 일정 조정 · 보충 검토 · 사고 대응)를 끝까지 추적.
- **표**: 유형 · 대상 · 담당 역할 · 기한 · 상태(OVERDUE 빨강) · 생성 원인(이벤트/회신 링크) · 지시(`instruction`). 기한 규칙은 ONTOLOGY 1-3 「작업 기한 규칙」(A-12 · A-27~A-29).
- **작업 유형 라벨**: `INCIDENT_AUTO_RENEWAL` = "자동 갱신 사고 대응"(계약 `AUTO_RENEWED` 일 때만), `ESCALATE_NOTICE_UNCONFIRMED` = "통보 수령 미확인 에스컬레이션"(`NOTICE_UNCONFIRMED`, 자동 갱신 아님) — 두 라벨을 섞지 않는다(FE-03, BE-01 뒤).
- **처리 권한** (A-35, BE-17 · BE-18 **구현됨** — LOG-022 · 023): [시작] · [완료] · [취소]는 작업 **담당 역할(`ownerRole`)일 때만** 보인다. 다른 역할이면 "담당 {역할} 만 처리 (현재 {역할})". 요청에는 항상 `actorRole`(현재 역할)을 보내고, 서버가 담당이 아니라고 422 를 주면 문구를 그대로 보인다. SCM 보충 검토 작업은 [완료] 대신 [보충 검토 회신]만(BE-18 — `PATCH` 완료는 409).
  - **[권한 검증 확인]** (LOG-023 구현, S-06 과 같은 취지): 담당이 아닌 역할로 열린 작업을 볼 때 보인다. 현재 역할을 `actorRole` 로 [시작]을 **서버에 실제로 보내** 422 `FORBIDDEN_ROLE` 문구("권한 없음: 이 작업은 {담당}만 처리할 수 있습니다 …")와 상태 불변을 보인다.
  - **재상신(`RESUBMIT`) 양식**: 근거 판단안을 고른다(기본 = 그 계약의 최신 판단안). 고른 판단안의 **버전 · 권고**를 양식에 보여 무엇이 상신되는지 알 수 있게 한다(FE-16). 판단안이 하나도 없으면 서버가 422 로 거부한다(BE-22).
- **행동**: [시작] · [완료](결과 메모, 유형별 추가 입력: `SEND_NOTICE` → 발송 시각 · 내용 / `RESCHEDULE_CAMPAIGN` → 새 집행일 / `RESUBMIT` → 판단안 선택) · [취소](사유). SCM 역할이고 `REPLENISHMENT_REVIEW` · SCM `INFO_REQUEST` 작업이면 [보충 검토 회신](정보 제공 + 보충 필요/불필요 + 입고 예정일 · 정보 부족 · 거절) — 승인이 아니라 검토 회신(`COUNTERPARTY_REPLY`, 4-1).
- **보충요청 종결 표시** (세 가지를 다르게): SCM '불필요'로 닫힌 초안(`DRAFT → REJECTED`, A-30) "SCM 검토: 불필요로 종결 (승인 거절 아님)" · SCM '거절(보충 불가)'로 닫힌 초안(`DRAFT → REJECTED`, A-34) "SCM 검토: 보충 불가로 종결 (승인 거절 아님)" · 권한자가 거절한 보충요청(`SUBMITTED → REJECTED`) "승인 거절"(FE-04). 문구는 BE-13 의 `statusText` 를 쓰고, 그 전에는 이력의 이전 상태와 사유 접두어("불필요:" / "보충 불가:")로 구분한다.
- **완료 후 반영**: 연결 엔티티 전이 결과를 토스트 + 링크로(예: "계약 상태 NOTICE_SENT, 수령확인 작업 생성").
- **빈 상태**: "열린 작업이 없습니다".

### S-08 인플루언서 성과 순위 `/analysis/influencers`
- **목적**: "배분이 성과를 따라가는가" — 집행 비중 순위 vs 실질 공헌이익 순위.
- **상단 고정 문구**: "표본(대표 표본) 기준 — 비중 · 순위 · 방향까지. 연간 계획치 · 28억과 곱하지 않음" [원본 data_dictionary 6항].
- **표**: 부록 A-1 열 그대로(집행 비중 · 요청 비중 · GMV · Spend · **cp 공식값(A05)** · 명목/실질 ROAS · 반품률 · 순위 — 순위는 공식값 기준). 토글 없음. [참고값 보기] 스위치(기본 꺼짐)를 켜면 1.4 문자 그대로 cp · 실질 ROAS 를 회색 보조 열로 보여준다.
- **차트**: (1) 집행 비중 순위 vs 공식 cp 순위 기울기 차트 (2) 명목 ROAS vs 실질 ROAS(공식) 막대. 금액 축은 표본만. 참고값은 차트에 넣지 않는다.
- **설명 박스**: "공식값은 A05(v1.5) 5절 단일 차감 — Net Revenue(GMV − 반품환불)에서 원가 · 마케팅비 · 채널수수료 · 출고/반품 물류비를 각 한 번씩 뺌. 근거: A05 1절 · A01 4절 · 8절(구판 문서 · 원본 별첨과 충돌하면 A05 우선). calculation_definitions 1.4 를 문자 그대로 적용하면 쿠폰 · 환불이 두 번 빠지며, 이 값은 참고로만 보여줌. 참고값으로도 INF-001 · INF-005 는 하위이고, INF-003 · INF-007 은 참고값에서만 음수." + 비용 가정 A-01~A-06 배지.
- **참고(주장 접힘)**: 회의록 "배분이 성과를 거꾸로 따른다" 등.
- **공헌이익에 없는 것**: 물류 추가비용 · CS 비용(G-07) `미포함(원본 없음)` 칩.

### S-09 재고 커버 `/analysis/inventory`
- **목적**: 확대 캠페인이 요구하는 상품을 실제로 공급할 수 있는가(부서 영향 D2).
- **표**: 부록 A-3 (SKU · 카테고리 · Corevia 제품군 · 4주 평균 · 현재고 · 이동중 · 커버 · 원본 커버값 · min/max · 리드타임 · MOQ · 예상 품절일 · 기발주 · 기발주 도착 예상). 커버 < min 빨강.
- **캠페인 연결**: SKU 별 "이 SKU 를 주력으로 하는 기안 건"(A-16 가정 배지) — 예 더마 4종 → PLAN-011.
- **보충 제안 패널**: R-INV-04 계산 단계(Target → 제안 → MOQ 반영 → 금액) + 가정 A-17 · A-18 · A-19 배지 + 열린 질문 G-08. 기안 건에서 만든 제안은 **주력 SKU 중 안전재고 min 미달 SKU 만**(PLAN-011 → 1001 · 1002 · 1004, 1003 없음 — R-INV-04 적용 범위). 행동: [보충 요청 만들기](SCM 역할) → 권한자 자동 표시(SCM / 그룹 CEO/이사회). 초안이 생긴 뒤 SCM 역할이면 [보충 검토 회신].
- **주의 문구**: "캠페인 증분 수요는 표본이라 수량으로 더하지 않음 — 방향(+)만" · "in_transit 입고일 미확인".

### S-10 자금 재전망 · covenant `/analysis/cash`
- **목적**: 하회 예상 구간을 특정하고(승인 주체 판정용), 재무팀 공식 전망(주장)과 **한눈에 대조**한다(2026-11-14 사용자 결정).
- **판단에 쓰는 값은 재전망뿐**: 권한 판정(R-AUTH-03) · 하회 구간 · 0-3 경고 · 판단안 권고는 재전망(집계)만 쓴다. 공식 전망은 **대조용**이며 판단 문구 · 경고 · 권고에 나오지 않는다(UI-03).
- **차트 (필수)**: 재전망 일별 종가 선(영업일, v1 점선 · v2 실선 겹쳐 보기) · 30억 기준선 · 하회 구간 음영(현재 재전망 기준). 그 위에 **재무팀 공식 전망 주간 종가**를 다른 색 · 다른 모양의 점(예: 보라 마름모)으로 겹친다. 점은 x 축 `week` 날짜(월요일)에 찍는다(A-32). 범례 항목과 점 툴팁에 `주장` 배지, 툴팁에 `fin_cash_forecast_ms.csv` · `week` · `projected_closing_krw` 출처.
  - 둘 다 풀스케일(FULL) 현금 잔액이라 같은 축에 둔다 — R-SCALE-01 · UI-02 위반 아님(표본 금액은 이 차트에 없다).
  - 이벤트 표(날짜 · 항목 · 금액 · 출처 파일/행)는 차트 아래 그대로 둔다. 행은 API `cashEvents`(현재 재전망의 입력 — AR 회수 · AP 지급 · 발주 대금)를 그대로 쓴다: 원본 만기(`sourceDate`) · 재전망에 놓인 영업일(`date`) · 포함 여부 · 제외 사유(연체 A-08, 이중계상 AP 등) · 출처 파일/행. 회수 지연으로 날짜가 바뀐 행은 `모의`. 포함분을 날짜별로 더하면 일별 종가가 나온다(백엔드 테스트 — DD-043).
- **공식 전망 대 재전망 비교표 (필수, 접지 않음, 차트 바로 아래)** — 행 = 공식 전망 13주(`week` 2026-07-06 ~ 2026-09-28):

  | 열 | 값 | 출처 배지 |
  |---|---|---|
  | 주차 | `week`(월요일) + 대응 기간 "직전 화 ~ 해당 월"(첫 주는 7/1 ~ 7/6) | 원본 · 가정(A-32) |
  | 공식 전망 종가 | `projected_closing_krw` | **주장** · 풀스케일 |
  | 재전망 해당 주 종가 | 재전망의 `week` 날짜(월요일 영업일) 종가 | 집계 · 풀스케일 · A-08 · A-09 · A-32 |
  | 차이 | 재전망 − 공식 전망 (음수 = 재전망이 낮음) | 집계 |
  | 30억 하회 여부 (재전망 기준) | 대응 기간 영업일 중 종가 < 30억 이 하루라도 있으면 "하회 n영업일", 없으면 "없음" | 집계 |

  - **재전망 해당 주 값 정의(A-32)**: `week` 컬럼 뜻은 원본에 정의가 없다(미확인). 첫 행 종가 = 6/30 자금일보 종가 5,148,063,540 + 유입 − 유출 이고 13행 모두 직전 행 종가에서 이어진다(집계로 확인) — 6/30 종가에서 이어지려면 첫 주가 7/1 부터라야 하므로 `week` 를 **그 날짜(월요일)에 끝나는 주**로 해석해 그 월요일 종가와 맞댄다. 하회 여부는 종가 하루가 아니라 기간 전체 영업일로 본다(covenant 는 매 영업일 판정 — 월요일만 보면 v1 의 8/18~8/21 하회 4영업일이 주 08-24 행에서 사라짐).
  - **차이가 가장 큰 주** 행을 강조(굵게 + "최대 차이" 칩)하고 원인 메모를 붙인다: "7/21 기발주 14건 대금 3,749,760,000 이 공식 전망 유출에 없는 것으로 보임(7/21 이 든 주 07-27 의 공식 유출 1,538,636,693 — 13주 공식 유출이 모두 13억~17억대라 37.5억 일괄 유출 흔적 없음). **추정 — 원인 미확인**. 차이 중 나머지 금액은 미확인". 최대 차이 주는 API 가 계산한다(v1 = 주 08-17, v2 = 주 08-24 — DEMO 부록 A-4-1).
  - 보조 문구(표 아래 회색): "재전망은 원본 스케줄(AR · AP(po_id='NONE') · 발주)만 쓰므로 9/6 이후 예정 현금흐름이 없다. 공식 전망에는 매주 유입 · 유출이 있어 9월 차이에는 기준일 이후 새로 생길 거래가 섞여 있을 수 있다 — 원인 미확인".
  - ② 이후에는 현재 재전망(v2) 기준으로 다시 그리고, v1 과 값이 달라진 행(주 08-24 · 08-31)에 "② 이후 변경" 표시. 공식 전망 열은 고정(재무팀 파일은 바뀌지 않음). 달라진 행은 화면이 비교하지 않고 API 의 `changedFromV1` · `v1Recalculated` · `v1BelowDays` 를 쓴다.
  - 차이 설명 문구는 `diffNotesSourced`(문구마다 출처 라벨 — 공식 전망 `주장` · 재전망 `집계` · 원인 추정 `원본근거해석` · 표본 제외 `원본`)로 보인다. 라벨 없는 `diffNotes` 는 쓰지 않는다(UI-01).
- **재전망 버전 · 민감도**: ② 이후 v1(점선) · v2(실선)를 한 차트에 겹쳐 보이면 버전 선택 토글은 없어도 된다(**선택**). 민감도 토글(A-08)은 **선택**(5-1) — 구현하지 않으면 민감도 결과 숫자를 화면 문구로 따로 적지 않는다(숫자는 API 계산값만).
- **구간 영향 표**: 하회 구간에 집행일이 걸린 기안 건 목록과 권한자(v1 12건 → v2 14건).
- **문구**: "기안 요청액(표본)은 이 전망에 포함하지 않음 — 마케팅 축소는 자금 해법이 아님(회의록), 시점 대조의 목적은 승인 주체와 순서" · "고정 피 지급 일정 미확인(G-09)" · "공식 전망은 대조용(주장) — 승인 권한 · 경고 판단에는 재전망만 사용".
- **추가 유출 시나리오 (선택, 5-1)**: 보충 발주 같은 신규 풀스케일 약정을 "추가 유출"로 분리해 겹쳐 보기(원본 전망분과 다른 색). ④ 의 권한 경로 변경은 보충 승인요청의 `routingReasons`(R-AUTH-03)로 이미 보이므로 시연 필수가 아니다. 넣더라도 비교표의 "재전망 해당 주 종가"는 원본 전망분 기준으로 두고 추가 유출 반영값은 따로 표시한다(R-CASH-04).

### S-11 처리 이력 `/history`
- **목적**: 판단 이후 무엇이 생성 · 갱신됐는지 증거.
- **표 (필수)**: 시각(가상 `simAt` · 실제 `createdAt`) · 대상 · 이전 → 이후 상태 · 행위자(AI/사람/시스템/모의) · 규칙 ID · 원인 이벤트 · 사유. 상태 문구는 서버가 주는 `AuditRowView` 의 `fromText` · `toText` · `displayText` 를 쓴다(예 "SCM 검토: 불필요로 종결 (승인 거절 아님)" · "작업 생성: …" · "상태 유지: …" · "재전망 교체 CF-v1 → CF-v2"). 화면은 사유 문자열을 파싱하지 않는다(DD-044). 필터(필수): 대상(`entityType` 7종 — 계약 · 기안 건 · 승인요청 · 작업 · 보충요청 · **판단안(`ASSESSMENT`)** · **재전망(`CASH_FORECAST`)**) · 행위자(`ActorKind` 4종) (FE-07). 같은 상태 유지 행(`fromStatus = toStatus`, 권한 재판정 · 재상신)도 사유와 함께 보여준다.
- **시나리오 실행 ID 필터 (선택)**: 프리셋 전환 · 초기화가 운영 테이블을 비우므로 이력에는 늘 한 실행만 있다 — 필터가 없어도 증거가 섞이지 않는다.
- **보기 전환 — 타임라인 보기 (선택)**: 대상별 레인(계약 · 기안 · 승인요청 · 작업 · 보충요청). 표가 같은 증거를 보여주므로 시연 필수 아님.

### S-12 데이터 출처 · 가정 · 공백 `/data`
- **목적**: 완료 조건 5(원본과 가정 구분)의 단일 증거 화면.
- **탭**: (1) 원본 파일 목록(경로 · 행 수 · 스케일 · 쓰는 곳 · 적재 시각) (2) 가정 A-01~A-36 **36개** (내용 · 이유 · 쓰는 곳 — API 목록 그대로, BE-19 구현됨) (3) 공백 G-01~G-13 (W02_TASK 5절 연결 · 처리 · 상태: `미확인` 또는 "모의 회신으로 보완 — 원본 공백 그대로". "해소"로 표시하지 않는다 — BE-12 · FE-10) (4) 주장 목록(회의록 · 메모 · 예상 GMV · 공식 전망) (5) 모의 회신 · 모의 사건 목록(거절 · 정보 부족 포함 표시) (6) 원본 불일치와 처리(공헌이익 정의 충돌 → A05 공식값 결정 · 공식 전망 차이 · settlement_date 의미 등).

### S-13 시연 시나리오 `/scenarios`
- **목적**: 3상황(+④)을 언제든 같은 결과로 재현.
- **프리셋 목록은 API**(`GET /api/scenarios`, 10개: 초기 · ① 접수 · ① 승인요청 · ① 회신 · ① 통보/수령확인 · ① 기한 도래 · ② · ③ 반려 · ③-B · ④ — ④ 는 PLAN-011 판단안 v1 + 보충 초안 3건까지, 판단안 v1 은 BE-24)에서 받고, [초기화 후 재생]은 `POST /api/scenarios/:id/reset`, 기대 결과 체크리스트는 `GET /api/scenarios/:id/check`(`passed/total`). 상태는 서버 전역 하나라 재생하면 모든 화면 · 사용자에게 같은 상태가 보인다.
- **카드 (4개 모두 필수 시연, 권장 순서 ①→②→③→④)**: ① 정상 · ② 조건 변경 · ③ 정보 부족 · 거절(A/B) · ④ 확장 · 부서 영향(④-a/④-b). 각 카드에 [초기화 후 시작 지점까지 재생] · 다음에 할 행동 안내(예 "승인함에서 그룹 CEO/이사회 역할로 APR-001 반려").
- **수용 기준 점검은 현재 지점(마지막 재생 프리셋)만** (2026-11-14 변경, ONTOLOGY 9-2 ⑤): 「현재 지점 점검」 구역에 `GET /api/scenarios/{현재 프리셋}/check` 의 ✓/✗ · `passed/total` 과 "그 뒤 화면에서 넣은 사건 포함" 을 보인다. 첫 판의 「4개 시나리오 전체 진행률」은 뺀다 — 서버 상태가 하나라 다른 프리셋을 점검하려면 재생해 지금 상태를 바꿔야 하고, 현재 상태를 다른 프리셋 기준으로 점검하면 ✗ 가 나와 오해를 부른다. 시나리오 전체 통과의 증거는 `npm run check` 시나리오 테스트다(안내 문구 구현됨 — FE-14, LOG-023).
- **시연 운영 주의**: 상태 공유 · 한 사람만 조작 · 시작 전 리셋 — [DEMO 0-4](DEMO_SCENARIOS.md#0-4-시연-운영-주의-2026-11-14). 단계별 진행은 [DEMO 0-6 시연 진행표](DEMO_SCENARIOS.md#0-6-시연-진행표-한-장-2026-11-14).
- **[전체 초기화]**: 확인 모달. 원본 적재 테이블은 건드리지 않고 운영 테이블만 비움.

## 3. 시연 상황 → 화면 연결

①~④ 모두 필수 시연이다(2026-11-13 결정). ④는 나만의 확장 E2 와 다른 부서 영향 D2 의 주 증거, ①은 E1 · D1, ②는 D1 재판정의 증거.

| 단계 | ① 정상 | ② 조건 변경 | ③ 정보 부족 · 거절 | ④ 확장 · 부서 영향 (필수) |
|---|---|---|---|---|
| 입력 | S-02 통보 · 기안 접수 | S-02 회수 지연(모의) | S-06 반려 회신 · S-02 에이전시 정보 부족 회신 | S-04 PLAN-011 선택 |
| 확인 | S-03 개요 · 성과 근거, S-04 표 | S-10 v1 → v2 음영 확장 | S-03 미확인(G-02) | S-09 더마 커버 · 품절일 |
| 판단 | S-05 ASM-001/002 | S-02 결과 패널 "PLAN-004 재승인 필요" → S-05 ASM-004 | S-05 v2 (정보 미도착 반영) | S-05 게이트 결과 · 보충 제안 |
| 승인 요청 | S-04/S-03 → S-06 APR-001~003 | S-06 재승인 요청 v2 (PLAN-004, supersedes APR-003 · ② 프리셋 APR-004) | S-06 재상신 요청 v2 (supersedes APR-001 · ③ 프리셋 APR-004) | S-09 보충 요청 → S-06 |
| 상태 변경 | S-06 회신 → S-07 통보 → S-03 통보 탭 수령확인 | S-04 PLAN-004 조건부 · S-07 일정 조정 | S-03 재검토 · S-07 작업 3건 / B: 자동 갱신 | S-04 PLAN-011 조건부 / S-06 보충 거절 |
| 다음 판단 반영 | S-01 7/18 이동 → 경고 해소, S-08/S-04 배분 비중 | S-04 권한자 열 변경, S-06 SUPERSEDED | S-03 위약금 계산기 · S-01 빨강 카드 | S-04 집행일 9/21 · 권고 변경 |
| 증거 | S-11 | S-11 | S-11 | S-11 |

## 4. API (2단계 확정, 2026-11-14)

백엔드 2단계 구현(`app/src/app/api/**/route.ts` 24개, 응답 타입 `app/src/domain/api-types.ts`)을 코드로 확인해 옮겼다. **3단계에서 `GET /api/receivables` 가 더해져 25개**이고, 아래 표의 「3단계」 표시 필드는 `api-types.ts` 작업본(2026-11-14, 미커밋)을 코드로 확인해 옮겼다. **타입 이름 · 필드의 기준은 `api-types.ts`**(백엔드 소유)이고, 이 표는 화면과의 대응을 보여준다. 프론트엔드는 `@/domain/api-types` 를 import 하고 `app/src/app/_data/types.ts` 를 대체한다. 서버 컴포넌트는 `getService()`(`@/server/runtime`)를 직접 불러도 응답 모양이 같다.

**공통**
- JSON, 금액 정수(원). 값 객체는 `Sourced<T>`(`{value, label, refs, scale, method?, assumptionIds?}`) — 도우미 타입 `Money<'FULL'|'SAMPLE'>` · `Num` · `Txt`(`@/domain/sourced`). 미확인 값은 `UnknownValue = {gapId, note}`.
- 상태 저장소는 서버 전역 하나다(DB `sim_state` 1행). 프리셋 전환은 쿠키가 아니라 `POST /api/scenarios/:id/reset` 이고 **모든 사용자에게 같은 상태**가 보인다. 현재 역할(역할 전환)은 프론트가 유지한다(서버는 회신 본문의 `respondentRole`, 작업 처리 · 보충 초안의 `actorRole`(BE-17 구현됨 — **필수**, 없으면 422 `VALIDATION`)로 검증). 서버가 역할을 검사하는 쓰기는 이 셋뿐이고 나머지 쓰기는 역할을 받지 않는다 — [ONTOLOGY 1-3 쓰기 행위별 허용 역할](ONTOLOGY.md#쓰기-행위별-허용-역할-2026-11-14). 상태가 하나라 동시에 시연하면 서로 섞인다 — [DEMO 0-4](DEMO_SCENARIOS.md#0-4-시연-운영-주의-2026-11-14).
- 응답 헤더 `cache-control: no-store`. 상태 변경 뒤 화면은 다시 조회한다(UI-05).
- **오류**: `{error:{code, message, details?}}`. 코드 · 상태: 422 `FORBIDDEN_ROLE` · `VALIDATION` · `INFO_MISSING` / 409 `INVALID_TRANSITION` · `CLOCK_BACKWARD` · `CONFLICT` / 404 `NOT_FOUND` / 500 `INTERNAL`(내부 메시지 숨김). 언제 어떤 코드인지는 [ONTOLOGY 3절 오류 코드 표](ONTOLOGY.md#3-상태와-전이-상태-머신). 화면은 `message` 를 그대로 보여준다(UI-04 · FE-11). 오류가 나면 서버는 아무것도 저장하지 않는다.
- **상태 변경 응답 공통 `MutationResult`** (UI-05 결과 패널의 원천):
  ```ts
  { transitions: AuditRowView[];           // 이번 처리의 이력 (상태 전이 · 작업 생성 · 권한 재판정 · 같은 상태 유지 행 포함). 3단계: AuditLogEntry + fromText · toText · displayText
    createdTasks: Task[]; createdApprovals: ApprovalRequest[];
    routingChanges: {lineId, from, to, ruleId, action}[];   // action = R-AUTH-06 처리 방식 (ONTOLOGY 4-1)
    summary: { stateChanges, createdTasks, createdApprovals, routingChanges, needsAssessment: string[] }; // stateChanges = 이력 중 from ≠ to 건수
    simNow: IsoDateTime; stateVersion: number }
  ```
  변경 API 는 이것에 자기 필드를 더해 돌려준다(아래 표의 `…MR`). 생성 계열은 HTTP **201**.

**조회 (GET)**

| 경로 · 쿼리 | 응답 (`api-types.ts`) | 화면 |
|---|---|---|
| `/api/meta` | `MetaView {workId:'W02', simNow, aiMode:'LIVE'\|'MOCK', model, cashForecastVersion, dataMode:'API', persistence:'POSTGRES'\|'MEMORY', rawSource:'FILES'\|'DB', preset: PresetInfo\|null, stateVersion}` | 헤더 전체 |
| `/api/overview` | `OverviewView {timeline (TimelineItem — share 포함), covenantWindows, pendingApprovals (PendingApprovalCard — assessmentId 포함), alerts (`AlertView.nextAction {text, href?, role?}` — 자동 갱신 경고는 계약 상태별, 0-3-1), referenceFlags, contract (ContractSummary — autoRenewalRisk · autoRenewed · performanceFee: UnknownValue\|Txt(MOCK)), taskCounts, recentAudit: AuditRowView[] (3단계), received, poPaymentTotal}` | S-01 |
| `/api/receivables` | `ReceivableView[]` — **새 API (3단계)**. `fin_ar_aging_ms.csv` 21행: `{id, channelId, invoiceDate, originalDue (원본), currentDue (회수 지연 사건이 있으면 모의), overridden, amount, outstanding (Money<'FULL'>, 원본 — 재전망 유입에 쓰는 값), agingDays, overdue (원본 만기가 기준일 이전 — 기본 제외 A-08), inForecast, ref}` | S-02 회수 지연 양식 |
| `/api/contracts/:id?terminateOn=` | `ContractView {contract, terms, routing{requiredRole, reasons, annualAmount, lowerBound}, deadlines, linkedLines, performance, notices, receipts, audit, approvals, consequences, penaltyPreview, openGaps, assessmentId, latestAssessment, assessments[], canRequestApproval}` | S-03 |
| `/api/contracts/:id/penalty?terminateOn=YYYY-MM-DD` | `PenaltyView {terminateOn, renewalStart, renewalEnd, remainingMonths, applies, amount}` (`terminateOn` 없으면 422) | S-03 위약금 계산기 |
| `/api/proposals/:id?deadline=&role=&grade=&status=&flag=&approval=` | `ProposalView {received, proposal, summary{authorityText, authorityReasons, over10mCount, groups, gradeCounts}, lines: LineView[] (routing.previousRole · changeReason, supplyOutlook, inboundExpectedDate, recommendation, costSteps · refCostSteps), covenantWindow}` | S-04 |
| `/api/assessments?subjectId=` | `AssessmentView[]` — **새 API**(판단안 목록, 대상 ID 로 거름) | S-03 탭 3 · S-05 버전 목록 |
| `/api/assessments/:id` | `AssessmentView` = `Assessment` + `mock` · `toolCalls` · `warnings` · `fallbackReason` · `provenance{ok, violations}` · `approvalRequestIds` (ONTOLOGY 1-3 Assessment, `stubNote` 없음) | S-05 |
| `/api/approval-requests?role=&status=` | `ApprovalView[]` | S-06 목록 |
| `/api/approval-requests/:id` | `ApprovalView {request, statusText, subjectText, subjectHref, items, daysLeft, level, assessmentId, supersededBy, alerts, replies, audit, contractDecisionAllowed}` | S-06 상세 |
| `/api/tasks?role=&status=` | `TaskView[]` (= `Task` + `typeText` · `statusText` · `subjectHref`) | S-07 |
| `/api/analytics/influencers?includeReference=true\|false` | `InfluencersView {rows, totals, remaining{total, shares}, assumptions}` — 참고값(`cpRefDef14` · `realRoasRefDef14`)은 `includeReference=true` 일 때만 | S-08 |
| `/api/analytics/inventory` | `InventoryView {rows, suggestions (ReplenishmentSuggestionView), replenishments: ReplenishmentRowView[], simDate}` — 3단계: 보충요청 행 = `ReplenishmentRequest` + `statusText`(BE-13) + **`amount`**(Money<'FULL'>, finalQty × 기발주 단가 [집계 · A-17 · A-18]) · **`unitCost`**(Money<'FULL'>, 기발주 `amount_krw / order_qty` [집계]) · **`paymentDate`**(Txt, 초안 생성일 + 25일 [가정 A-19]). 화면은 원시 `amountKrw` · `unitCostKrw` · `expectedPaymentDate` 대신 이 셋을 쓴다(출처 · 스케일 배지) | S-09 |
| `/api/analytics/cash?version=v1\|current&sensitivity=true` | `CashView` — **모양 변경**: `current`(= `CashRunView` + `opening`) · `v1` · `sensitivity`(요청 시) · `extraOutflow`(SUBMITTED 이상 보충요청이 있을 때, 원본 전망분과 분리) · `covenant` · `poPayment` · `overrides` · `official` · **`compareVersion` · `officialComparison: OfficialComparisonRowView[]`**(13행, `official` CLAIM · `recalculated` · `diff` AGGREGATED [A-08 · A-09 · A-32] · `belowThreshold` · `belowDays`) · **`largestGap {week, diff, notes: Txt[]}`**(원인 메모 INTERPRETED + "원인 미확인") · `diffNotes` · `linesInWindow`. **3단계 추가**: 비교표 행의 `changedFromV1`(v1 대비 재전망 값 · 하회 영업일 수가 달라졌는가 — v1 대조면 항상 false) · `v1Recalculated`(Money<'FULL'>\|null) · `v1BelowDays`(number\|null) / `diffNotesSourced: Txt[]`(`diffNotes` 와 같은 내용 + 출처 라벨 · refs) / `cashEvents: CashEventRowView[]`(`{id, kind:'AR_INFLOW'\|'AP_OUTFLOW'\|'PO_PAYMENT', item, direction, amount, sourceDate, date\|null, included, excludedReason, ref, label, assumptionIds}` — 현재 재전망 입력 행). `version=v1` 이면 최초 재전망과 대조, 그 밖(`current` · 생략 · ② 이후의 `v2`)은 현재 재전망과 대조 | S-10 |
| `/api/audit?entityType=&entityId=&actorKind=` | `AuditRowView[]` = `AuditLogEntry` + `fromText`(생성 행은 null) · `toText` · `displayText` (3단계. `entityType` 7종 — ONTOLOGY 1-3 AuditLog). `ContractView.audit` · `ApprovalView.audit` · `MutationResult.transitions` 도 같은 모양 | S-11 |
| `/api/data-registry` | `RegistryView {sources, assumptions, gaps (open — BE-12 에서 status 로 바뀜), claims, mocks, inconsistencies}` | S-12 |
| `/api/scenarios` | `PresetInfo[]` — **새 API**. 10개: `SEED` · `S1_RECEIVED` · `S1_4` · `S1_5` · `S1_6` · `S1_7` · `S2` · `S3_1` · `S3_B` · `S4` (각 `scenario` · `title` · `description` · `next`) | S-13 |
| `/api/scenarios/:id/check` | `ScenarioCheckView {preset, criteria: {id, text, passed, actual, expected}[], passed, total}` | S-13 |
| `/api/clock/preview?to=ISO` | `ClockResponse & {preview: true, passingDeadlines: {kind:'CONTRACT_NOTICE'\|'LINE_DEADLINE'\|'APPROVAL'\|'TASK', id, deadline}[]}` — **저장하지 않고** 기한 감시를 돌린 결과. `transitions` 는 실제 이동과 같다(테스트) | S-01 시점 이동 모달 |

**변경**

| 메서드 · 경로 | 요청 | 응답 | 화면 |
|---|---|---|---|
| `POST /api/events` | `{type, payload}` — `EventInput`: `RENEWAL_NOTICE_RECEIVED {contractId}` · `EXPANSION_PROPOSAL_RECEIVED {proposalId}`(25건 전체 — `lineIds` 가 오면 422, BE-20) · `AR_COLLECTION_DELAYED {arId, newDueDate}` · `LINE_TERMS_CHANGED {lineId, requestedKrw?, settlementDate?}` · `COUNTERPARTY_REPLY {from, outcome, note, inboundExpectedDate?, replenishmentNeeded?}` (4-1) · `APPROVAL_REPLY {requestId, …ReplyBody}` · `CLOCK_ADVANCED {to}`. `label` 은 보내지 않는다(서버가 붙임). 기준시각 이전 날짜는 422 | `EventResponse` = `…MR` + `event` + `needsAssessment` | S-02 |
| `POST /api/clock/advance` | `{to: ISO}` | `ClockResponse` = `…MR` + `event`. 과거면 409 `CLOCK_BACKWARD` | S-01 |
| `POST /api/assessments` | `{subjectType, subjectIds}` | **`{assessment: AssessmentView, …MR}`** (SCREEN_SPEC 1단계 제안의 `Assessment` 단독에서 바뀜). AI 호출 중 상태가 바뀌면 409 `CONFLICT` | S-02 · S-03 · S-04 · S-05 |
| `POST /api/approval-requests` | `{assessmentId}` | **`{requests: ApprovalRequest[], …MR}`** (권한자별 묶음 A-11 — 1단계 제안의 배열 단독에서 바뀜). 계약 판단안에 상신할 결정이 없으면 422, 보충 판단안은 409(보충 상신은 SCM 회신으로만) | S-03 · S-04 · S-05 |
| `POST /api/approval-requests/:id/replies` | `ReplyBody {respondentRole, outcome, itemDecisions?, decision?, conditions?, reason, infoRequest?: {target, question}}` — 반려는 `reason`, 정보 요청은 질문 필수 | `ReplyResponse` = `…MR` + `event` + `reply` + `request`. 422 `FORBIDDEN_ROLE` 메시지 "권한 없음: 이 요청은 {권한자}만 결정할 수 있습니다 …" | S-06 |
| `PATCH /api/tasks/:id` | `TaskPatchBody {status: 'IN_PROGRESS'\|'DONE'\|'CANCELLED', actorRole, resultNote?, payload?}` — **`actorRole` 필수 · 작업 `ownerRole` 과 같아야 함**(A-35, BE-17 **구현됨**: 없으면 422 `VALIDATION`, 다르면 422 `FORBIDDEN_ROLE`, 상태 · 상태 버전 불변. TS 타입은 호환을 위해 선택으로 남아 있으나 서버는 필수로 검사). SCM 보충 검토 작업의 `DONE` 은 409(BE-18 구현됨) — `payload`: `SEND_NOTICE {content?}` · `RESCHEDULE_CAMPAIGN {settlementDate}` · `RESUBMIT {assessmentId?, proposedDecision?}`. `RESUBMIT`: 근거 판단안 = 지정한 것, 없으면 최신 계약 판단안. 권고 결정 = `proposedDecision`(상신자 지정) > 근거 판단안의 권고. 없는 판단안 404 · 계약 판단안이 아니면 422 `VALIDATION`(LOG-025 구현) · 계약 판단안이 하나도 없으면 422 `INFO_MISSING`(BE-22 — 지금 구현은 이전 요청 권고 유지). 취소는 `resultNote`(사유) 필수 | `TaskPatchResponse` = `…MR` + `task: TaskView` | S-07 |
| `POST /api/replenishment-requests` | `ReplenishmentCreateBody {triggerLineId, skuIds?, actorRole}` — **`actorRole` 필수 · SCM 만**(A-35, BE-17 구현됨: 없으면 422 `VALIDATION`, SCM 아니면 422 `FORBIDDEN_ROLE`, 초안 수 · 상태 버전 불변) | `ReplenishmentCreateResponse` = `…MR` + `replenishments`. 대상 아님 422 · 중복 초안 409 (ONTOLOGY 1-3) | S-09 |
| `POST /api/scenarios/:id/reset` | — | `ScenarioResetResponse {preset, simNow, replayedEvents, stateVersion}`. 운영 상태만 바꾸고 원본 적재는 그대로. 판단안은 모의로 재생(시연 결정성) — 실시간 AI 는 [판단안 만들기] 때만 | S-13 |

**1단계 제안과 달라진 점 (프론트엔드 영향)**: ① 변경 응답이 모두 `MutationResult` 를 펼친 모양 ② `POST /api/assessments` → `{assessment, …}` ③ `POST /api/approval-requests` → `{requests, …}` ④ 새 API: `GET /api/scenarios`(프리셋 목록) · `GET /api/assessments`(목록) · `GET /api/clock/preview` 의 `passingDeadlines` ⑤ `/api/proposals` 필터 쿼리 `band` → `grade` · `status` · `flag` · `approval` 추가 ⑥ `CashView` 모양 변경(`current` · `v1` 실행 단위) ⑦ 프리셋은 쿠키가 아니라 서버 재생.

### 4-1. 외부 회신 양식 ↔ 도메인 처리 대응 (2026-11-14, 2단계 확정)
S-02 「외부 회신」 · S-03 통보 탭 · S-07/S-09 SCM [보충 검토 회신]은 모두 `POST /api/events {type:'COUNTERPARTY_REPLY', payload}` 로 보낸다. payload = `{from: 'AGENCY'|'SCM'|'COREVIA', outcome: 'RECEIPT_CONFIRMED'|'INFO_PROVIDED'|'INSUFFICIENT'|'REJECTED', note, inboundExpectedDate?, replenishmentNeeded?}` (`CounterpartyReplyInput`, 서버가 `label:'MOCK'` 을 붙임). 처리 전체 표는 [ONTOLOGY 1-3 Event 상대별 효과](ONTOLOGY.md#event). 모두 `MOCK`.

| 상대 `from` | 결과 `outcome` (S-02 양식) | 처리 | 시연 |
|---|---|---|---|
| `AGENCY` | 수령확인 | `NoticeReceipt` 생성, 계약 `NOTICE_SENT → NOTICE_ACKNOWLEDGED → NEGOTIATING/TERMINATING`, 수령확인 · 재통보 작업 완료 | ① S1-6 · ③ S3-3 |
| `AGENCY` | 정보 제공 | 열린 계약 `INFO_REQUEST` 완료 + 성과 피 조건에 회신 문구 기록(`모의`, A-33). S-03 성과 피 칸 · 다음 판단안 사실이 모의 문구로 바뀜. 권한 판정 금액은 "하한 28억" 그대로 | — |
| `AGENCY` | 정보 부족 · 거절 | 열린 계약 `INFO_REQUEST` 완료 + 결과 메모. G-02 유지. 계약 · 통보 상태는 바꾸지 않음(통보는 일방 통지) | ③ S3-2 (정보 부족) |
| `SCM` | 정보 제공 + 보충 불필요(`replenishmentNeeded:false`, 입고 예정일) | SCM 작업 2건 완료, 보충요청 `DRAFT → REJECTED`(A-30, 승인 거절 아님), 기안 건 `supplyOutlook = INBOUND_CONFIRMED` | ④-a |
| `SCM` | 정보 제공 + 보충 필요(`replenishmentNeeded:true`) | SCM 작업 2건 완료, 보충요청 `DRAFT → SUBMITTED` + 승인요청(SCM 또는 covenant 구간이면 그룹 CEO/이사회) | ④-b |
| `SCM` | 정보 부족 | SCM `INFO_REQUEST` 만 완료, 초안 · 보충 검토 작업은 그대로 | — |
| `SCM` | 거절 (보충 불가) | SCM 작업 2건 완료, 보충요청 `DRAFT → REJECTED`(사유 '보충 불가', A-34, 승인 거절 아님), 기안 건 `supplyOutlook = NO_SUPPLY` → PLAN-011 권고가 부결로 바뀜 | 필수 시연 아님 (④ 보강용) |
| `COREVIA` | 정보 제공(입고 예정일) | SCM 이 연 `INFO_REQUEST` 완료, 연결 건 `inboundExpectedDate` 기록(권고 조건 문구의 날짜가 바뀜) | — |
| `COREVIA` | 정보 부족 · 거절 | SCM `INFO_REQUEST` 완료 + 결과 메모 | — |

- 오류: 맞는 열린 작업 · 초안이 없으면 404 `NOT_FOUND`(예: 정보 요청 작업 없이 정보 부족 회신). SCM · Corevia 의 「수령확인」, SCM 「정보 제공」에 보충 필요 여부 없음 → 422 `VALIDATION`. 양식은 이 조합을 처음부터 막는다(FE-09).

## 5. 프론트엔드 수용 기준 (화면)

- **UI-01** 모든 숫자 옆에 출처 배지가 있고, 금액에는 스케일 배지가 있다. 배지 없는 숫자는 결함.
- **UI-02** 표본 금액과 풀스케일 금액이 한 합계 · 한 차트 축에 함께 나오지 않는다.
- **UI-03** 주장 값은 판단 근거 영역에 두지 않는다(「주장 · 참고」 영역: 기안 예상 GMV · 회의록 등). 대조 전용 표시(S-10 공식 전망 대 재전망 차트 · 비교표)는 `주장` 배지를 붙여 예외로 허용하고, 판단 문구 · 경고 · 권고에는 쓰지 않는다. 확인: S-10 의 공식 전망 점 · 열마다 `주장` 배지가 있고, 0-3 경고 · 판단안 · 승인요청 사유 어디에도 공식 전망 숫자가 없다.
- **UI-04** 승인 버튼은 `requiredRole` 역할에서만 활성이고, 422 응답 문구를 그대로 보여준다. 서버 422 는 S-06 [권한 검증 확인]으로 화면에서 확인한다(2단계 충족 — LOG-017). 작업 버튼도 담당 역할에서만 보이고 서버 422 문구를 그대로 보인다 — S-07 [권한 검증 확인]으로 화면에서 확인한다(3단계 충족 — BE-17 · LOG-023: 마케팅팀이 계약 담당 작업을 시도 → 422 문구 표시).
- **UI-05** 회신 · 작업 완료 · 시점 이동 후 화면이 서버 재조회로 갱신되고, 결과 패널에 상태 변경 · 생성 작업이 링크로 나온다. (API 는 2단계에서 생김 — 응답 `MutationResult` 의 `transitions` · `createdTasks` · `createdApprovals` · `summary` 를 그대로 쓴다. 판정은 프론트 2단계 연결 뒤)
- **UI-06** AI 모의 모드일 때 헤더와 판단안에 `모의` 배지가 보인다.
- **UI-07** 미확인 값은 `미확인` 칩 + G-xx 링크로 표시된다.
- **UI-08** S-01 타임라인에서 ② 이후 하회 구간 음영이 8/21 → 8/28 로 늘어난 것이 보인다.
- **UI-09** 상단에 업무 번호 W02 가 항상 보인다.
- **UI-10** 공헌이익은 공식값(A05)만 주 값으로 보이고, 1.4 참고값은 접힘 · 보조 열 · 회색 참고 칩으로만 보인다. 참고값이 경고 목록이나 권고 문구에 쓰이지 않는다.

### 5-1. 필수 · 선택 기능 (2026-11-14 결정)
기준: 시연 ①~④ 와 완료 조건 5개를 보여주는 데 **없으면 증거가 빠지는 것만 필수**. 선택 기능은 시간이 남을 때 한다. 선택 기능을 만들지 않을 때는 그 자리를 숨기고, 대신 숫자를 고정 문구로 적지 않는다.

| 화면 | 기능 | 구분 | 이유 |
|---|---|---|---|
| S-01 | 시점 이동(미리보기 · 확인) | **필수** (2단계, BE-07 · FE-02) | ① 7/18 · ③ 7/17 09:00 · 7/18 기한 감시가 "바뀐 상태가 다음 판단에 반영"의 핵심 증거. 프리셋만으로는 사용자가 직접 기한을 넘기는 장면을 보여줄 수 없음 |
| S-02 · S-06 · S-07 | 사건 입력 · 회신 · 작업 완료 실제 동작 | **필수** (2단계) | 완료 조건 1 (UI-05) |
| S-11 | 이력 표 + 대상 · 행위자 필터 | **필수** | 여섯 관점 「판단 이후의 처리」 증거 |
| S-11 | 타임라인 보기 | 선택 | 표가 같은 증거를 보여줌 |
| S-11 | 시나리오 실행 ID 필터 | 선택 | 초기화로 이력에 한 실행만 남음 |
| S-10 | 일별 재전망 차트 · 30억 기준선 · 하회 구간 음영 · v1/v2 겹쳐 보기 | **필수** | ② 조건 변경의 증거(UI-08) |
| S-10 | 재전망 버전 선택 토글 | 선택 | v1 · v2 겹쳐 보기로 대신함 |
| S-10 | 민감도 토글(A-08) | 선택 | 시연 판단을 바꾸지 않음(하회 시작일 7/21 은 모든 가정에서 같음 — ONTOLOGY 4-5) |
| S-10 | 추가 유출 시나리오 | 선택 | ④ 권한 경로는 보충 승인요청 `routingReasons` 로 보임 |
| S-10 | 공식 전망 주간 점(차트 겹침) + 공식 전망 대 재전망 비교표(접지 않음) | **필수** (FE-06 · BE-10) | 2026-11-14 사용자 결정. 완료 조건 5(원본 · 주장 구분)와 R-CASH-03 "차이 원인 설명"의 증거. 기존 「주장 · 참고」 접힘 표는 비교표로 대체 |
