# 온톨로지 — 대상 · 관계 · 상태 · 규칙 (W02)

> 작성 2026-11-12 · 기획(aoura-planner) · 기준: [PROBLEM.md](PROBLEM.md) · [W02_TASK.md](W02_TASK.md) · [TECH_STACK.md](TECH_STACK.md)
> 이 문서는 백엔드가 `app/src/domain/types.ts` 와 Drizzle 스키마로 옮길 **계약 문서**다. 코드와 다르면 이 문서가 기준이고, 바꿀 때는 이 문서부터 고친다.
> 경로는 `01_참가자_배포용/04_원본데이터/` 기준. 시연 상황은 [DEMO_SCENARIOS.md](DEMO_SCENARIOS.md), 화면은 [SCREEN_SPEC.md](SCREEN_SPEC.md).
> **2026-11-14 갱신**: 백엔드 · 프론트엔드 1단계 구현(커밋 `be79a9d`)과 대조해 반영. 바뀐 것 · 새 가정(A-27~A-31) · 후속 작업(BE-xx · FE-xx)은 [7절](#7-1단계-구현-반영--후속-작업-2026-11-14). 같은 날 S-10 공식 전망 대조 결정 반영(A-32 · R-CASH-03 · BE-10 · FE-06).
> **2026-11-14 갱신(2)**: 백엔드 2단계(DB · API 24개 · AI 에이전트, 미커밋 작업본) 코드 대조 반영 — 판단안 타입 · 도구 호출 기록, 외부 회신 최종 입력 · 상대별 효과, 보충요청 초안 오류, BE-09, DB 스키마 일반화(`raw_rows` · `data jsonb`), 새 가정 A-33 · A-34, BE-01~10 상태, 완료 조건 점검. 목록은 [8절](#8-2단계-백엔드-반영--완료-조건-점검--후속-작업-2026-11-14).
> **2026-11-14 갱신(3)**: 프론트엔드 2단계(커밋 `f2ba215` 이후, devlog LOG-017) 반영 — **실시간 AI 판단안 보류(사용자 결정)**, 프론트엔드가 문서와 다르게 만든 6건 판정, **쓰기 행위별 허용 역할**([1-3 역할](#쓰기-행위별-허용-역할-2026-11-14)), 새 가정 A-35 · A-36, 완료 조건 재판정, 후속 작업 BE-17~20 · FE-12~14. 목록은 [9절](#9-2단계-프론트엔드-반영--쓰기-권한--실시간-ai-보류-2026-11-14).
> **2026-11-14 갱신(4)**: 3단계(백엔드 LOG-022 · 025, 프론트엔드 LOG-023) 반영 — BE-17~20 · FE-12~14 완료 표시, **판단 3건**(판단안 미확인 목록의 공백 상태 · ④ 프리셋 판단안 v1 · 재검토 작업 자동 종료), **재상신 근거 판단안 규칙**(1-3 ApprovalRequest), 3-4 작업 자동 종료, A-33 · A-35 문구 보완, 후속 작업 BE-21~24 · FE-15~17. 목록은 [10절](#10-3단계-반영--판단-3건--재상신-규칙--후속-작업-2026-11-14).
> **2026-11-14 갱신(5)**: 백엔드 4단계(LOG-030) 반영 — BE-21~24 **구현됨** 표시와 타입(`AssessmentUnknown` · `AiTurnTrace` · `proposedSource` 판정 기준 · 점검 항목 AC-4-06a), **AI 방식 사용자 결정 (b)**: 실제 Claude 실행 1회(2026-11-14 17:19 KST) + 기록 재생으로 9-1 을 다시 씀(심사 관점별 증거 표 · **실제 작동 / 모의 처리 / 설계 단계 구분표**), 배포 A안 확정(BE-14), 후속 작업 FE-18 ~ FE-20 · BE-25(알려진 결함 — 수정 중), 프론트엔드 4단계 판정 6건(11-6). 목록은 [11절](#11-4단계-반영--ai-실행-기록--배포-a안--후속-작업-2026-11-14).

## 0. 표기

| 라벨 (enum) | 화면 배지 | 뜻 |
|---|---|---|
| `ORIGINAL` | 원본 | 원본 파일에서 그대로 읽은 값 · 규칙 문구 |
| `AGGREGATED` | 집계 | 원본을 코드로 계산한 값 (계산식 · 가정 ID 함께 표시) |
| `INTERPRETED` | 원본근거해석 | 원본에 직접 쓰여 있지 않지만 원본 문구를 근거로 정한 해석 (근거 문구 표시) |
| `ASSUMPTION` | 가정 | 원본에 없어 우리가 정한 값 · 규칙 (가정 ID `A-xx`) |
| `CLAIM` | 주장 | 회의록 · 부서 메모 · 기안 예상 GMV · 재무팀 공식 전망 |
| `MOCK` | 모의 | 모의 회신 · 모의 사건 입력 · 모의 모드 AI 출력 |

- **실시간 AI 가 쓴 문장**(판단안의 권고 이유 · 관점별 근거 · 대안 설명)은 위 6종 중 어느 것도 아니다 — 값이 아니라 AI 가 쓴 문장이다. 화면은 출처 배지 대신 **「AI 작성」 표지**를 달고, 문장 속 숫자의 출처는 `facts` 배지와 숫자 출처 검증(`provenance`)으로 보인다. `원본근거해석` 을 쓰지 않는 이유: 그 라벨은 "원본 문구를 근거로 정한 해석"이며 근거 문구를 함께 보여야 하는데(위 표), AI 문장에는 하나의 근거 문구가 정해지지 않아 원본에 근거한 해석처럼 보이게 된다(2026-11-14 결정, 9-2 ⑥). 모의 모드 문장은 지금처럼 `모의`. 운영 화면(S-05)은 시연 런타임이 모의 모드라(9-1) 이 표지가 나오지 않는다. **기록 재생 화면**(SCREEN_SPEC S-05R)의 문장은 실제 Claude 가 쓴 것이므로 「AI 작성」 표지에 **`기록 재생` 표지**를 함께 단다 — `실시간` 도 `모의` 도 아니다(9-1 표시 규칙).

| 스케일 (enum `Scale`) | 대상 |
|---|---|
| `FULL` | 계약(28억) · 재고 · 발주 · 자금(현금 · AR · AP) — 회사 실제 규모 (`data_dictionary` 6항) |
| `SAMPLE` | `mkt_orders_ms` · `mkt_returns_ms` · `mkt_coupons_ms` · `mkt_ad_spend_ms` · `mkt_budget_plan_ms` · `mkt_traffic_inflow_ms` — 대표 표본 |
| `NONE` | 수량 · 날짜 · 비율 등 금액 아님 |

- 기안(`mkt_budget_plan_ms`)은 **표본 계열 파일**이지만, 승인 권한 판정(1천만 · 1억 비교)에는 **기안 요청액 그대로** 쓴다 — [W02_TASK.md 3-3](W02_TASK.md) 의 `원본근거해석`. 이 금액도 `scale = SAMPLE` 로 두어 **풀스케일 금액(계약 · 현금)과 더하거나 곱하지 못하게** 한다.
- 기준 시점(as-of) **2026-07-01** (`data_dictionary` 1항, `ORIGINAL`). 재고 스냅샷 2026-06-30, 자금일보 마지막 행 2026-06-30.

### 0-1. 공통 타입 제안 (`types.ts`)

```ts
type SourceLabel = 'ORIGINAL' | 'AGGREGATED' | 'INTERPRETED' | 'ASSUMPTION' | 'CLAIM' | 'MOCK';
type Scale = 'FULL' | 'SAMPLE' | 'NONE';
interface SourceRef { file: string; column?: string; rowKey?: string; note?: string } // 예: {file:'02_masil/marketing/mkt_budget_plan_ms.csv', column:'requested_budget_krw', rowKey:'PLAN-001'}
interface Sourced<T> { value: T; label: SourceLabel; refs: SourceRef[]; scale: Scale; method?: string; assumptionIds?: string[] }
// 금액 혼합 방지: 브랜드 타입
type Krw<S extends 'FULL' | 'SAMPLE'> = number & { readonly __scale: S };
// add(a: Krw<S>, b: Krw<S>): Krw<S> 만 허용 — FULL + SAMPLE 은 타입 오류 (R-SCALE-01)
```

- 날짜는 `YYYY-MM-DD` 문자열(`IsoDate`), 시각은 ISO 문자열. 시스템 시간은 **가상 기준시각 `simNow`** 를 쓴다(A-21). 실제 오늘(2026-11) 날짜로 기한을 판정하지 않는다.
- 금액은 원 단위 정수(`number`), VAT 제외 (`data_dictionary` 2항). 비율은 소수(0.406) 저장, 화면에서 % 표시.

## 1. 대상 (엔티티)

### 1-1. 원본 적재 테이블 (읽기 전용)

원본 CSV 를 그대로 적재한다(`|` 구분, `NONE` 은 `null` 이 아니라 문자열 `'NONE'` 로 보존하고 도메인 변환 시 `null` 로 바꾼다 — A05 "NONE 은 0 과 구분"). 모든 행에 `src_file`, `src_row`(헤더 제외 1부터)를 단다.

- **물리 저장 (2단계 구현, 2026-11-14 채택)**: 파일마다 테이블을 만들지 않고 **두 테이블로 일반화**했다 — `raw_files`(`file` 경로 · `header` · `row_count` · `scale` · `label` · `source='original'` · `loaded_at`) 와 `raw_rows`(`src_file` · `src_row` · `values` jsonb = 열 이름 → 원문 문자열, 키 (`src_file`, `src_row`)). 이유: 열 이름 · `'NONE'` 문자열을 바꾸지 않고 보존하고, 파일이 늘어도 마이그레이션이 필요 없다. 아래 표 1열의 `raw_<파일명>` 은 **논리 이름**이고, 실제 조회는 `raw_rows.src_file = <원본 파일 경로>` 다.
- 적재 결과: 17 파일, 데이터 행 합계 **24,290** (헤더 제외, 2026-11-14 원본 파일에서 다시 셈 — `mkt_orders_ms` 15,650 · `mkt_coupons_ms` 4,672 · `mkt_returns_ms` 1,719 · `sku_weekly_sales_ms` 1,092 · `fin_cash_daily_ms` 652 · 나머지 12 파일 505) [집계].
- 원본 위치: 환경변수 `RAW_DATA_DIR`(없으면 `app/` 기준 `../01_참가자_배포용/04_원본데이터`)의 파일을 먼저 읽고, 폴더가 없으면 DB `raw_rows` 에서 읽는다. `GET /api/meta` 의 `rawSource` 가 `FILES` / `DB` 로 어느 쪽인지 알려 준다. 두 경로로 만든 데이터셋이 같다는 것은 테스트로 확인(백엔드 보고). 배포 이미지에 CSV 를 넣을지는 **사용자 결정 대기**([TECH_STACK 5절](TECH_STACK.md#5-남은-결정--후속-작업)).

| 논리 이름 | 원본 파일 | 키 | 스케일 | 라벨 | W02 에서 쓰는 곳 |
|---|---|---|---|---|---|
| `raw_m_influencer_ms` | `02_masil/master/m_influencer_ms.csv` | `influencer_id` | NONE | ORIGINAL | 인플루언서 |
| `raw_m_campaign_ms` | `02_masil/master/m_campaign_ms.csv` | `campaign_id` | NONE | ORIGINAL | 캠페인 → 인플루언서 |
| `raw_m_channel_ms` | `02_masil/master/m_channel_ms.csv` | `channel_id` | NONE | ORIGINAL | 채널 · 결제조건 |
| `raw_m_sku_ms` | `02_masil/master/m_sku_ms.csv` | `sku_id` | NONE | ORIGINAL | 안전재고 · MOQ · 리드타임 |
| `raw_mkt_budget_plan_ms` | `02_masil/marketing/mkt_budget_plan_ms.csv` | `plan_id` | SAMPLE | ORIGINAL (단 `expected_gmv_krw` 는 CLAIM) | 확대 기안 25건 |
| `raw_mkt_orders_ms` | `02_masil/marketing/mkt_orders_ms.csv` | `order_id` | SAMPLE | ORIGINAL | GMV · 쿠폰 (15,650행) |
| `raw_mkt_returns_ms` | `02_masil/marketing/mkt_returns_ms.csv` | `return_id` | SAMPLE | ORIGINAL | 반품환불 (1,719행, 주문당 최대 1건 — 집계 확인) |
| `raw_mkt_coupons_ms` | `02_masil/marketing/mkt_coupons_ms.csv` | `coupon_use_id` | SAMPLE | ORIGINAL | `stacked_flag` (4,672행, 주문 쿠폰액과 전부 일치 — 집계 확인) |
| `raw_mkt_ad_spend_ms` | `02_masil/marketing/mkt_ad_spend_ms.csv` | `spend_id` | SAMPLE | ORIGINAL | Marketing Spend (225행) |
| `raw_mkt_cost_master_ms` | `02_masil/marketing/mkt_cost_master_ms.csv` | `sku_id`×`channel_id` | — | ORIGINAL | 원가 · 수수료율 · 배송/반품물류비 |
| `raw_sku_inventory_ms` | `02_masil/inventory/sku_inventory_ms.csv` | `sku_id` | FULL | ORIGINAL | 현재고 · 이동중 |
| `raw_sku_weekly_sales_ms` | `02_masil/inventory/sku_weekly_sales_ms.csv` | `week`×`sku_id` | FULL | ORIGINAL | 최근 4주 평균 (2025-01-06 ~ 2026-06-29, 78주) |
| `raw_sc_purchase_orders_ms` | `02_masil/inventory/sc_purchase_orders_ms.csv` | `po_id` | FULL | ORIGINAL | 기발주 · 지급일 |
| `raw_fin_cash_daily_ms` | `02_masil/financials/fin_cash_daily_ms.csv` | `date` | FULL | ORIGINAL | 기초 현금 |
| `raw_fin_ar_aging_ms` | `02_masil/financials/fin_ar_aging_ms.csv` | `ar_id` | FULL | ORIGINAL | 예정 회수 |
| `raw_fin_ap_aging_ms` | `02_masil/financials/fin_ap_aging_ms.csv` | `ap_id` | FULL | ORIGINAL | 예정 지급(`po_id='NONE'` 만) |
| `raw_fin_cash_forecast_ms` | `02_masil/financials/fin_cash_forecast_ms.csv` | `week` | FULL | **CLAIM** | 재무팀 공식 전망 — 대조용 |

문서형 원본(`.md`)은 테이블 대신 **시드 상수**로 옮기고 `refs` 에 파일을 단다: `inf001_exclusive_contract_notice.md`(계약 1건), `approval_authority_policy.md`(권한 상수), `covenant_terms_ms.md`(30억 · 우선 규정), `calculation_definitions.md`(산식), `mkt_meeting_notes_ms.md`(CLAIM 인용문).

### 1-2. 도메인 엔티티 (마스터 · 사실)

#### Influencer — 인플루언서 [ORIGINAL `m_influencer_ms`]
| 필드 | 타입 | 원본 컬럼 | 비고 |
|---|---|---|---|
| `id` | `string` (`INF-nnn`) | `influencer_id` | 10명 |
| `name` | `string` | `influencer_name` | |
| `tier` | `'대형' \| '중형' \| '마이크로'` | `tier` | |
| `primaryCountry` | `'국내' \| '일본' \| '미국' \| '동남아'` | `primary_country` | |
| `platform` | `'YouTube' \| 'Instagram' \| 'TikTok'` | `platform` | |
| `feeType` | `'고정+성과' \| '성과' \| '고정' \| '혼합'` | `fee_type` | |

#### Campaign — 캠페인 [ORIGINAL `m_campaign_ms`]
`id`(`campaign_id`) · `name` · `influencerId` · `country` · `snsChannel` · `snsFormat` · `salesChannel`(`'대형파트너'|'마켓플레이스'|'라이브'|'자사몰'`) · `productLine`(`'색조'|'기초'|'선케어'|'더마'`) · `startDate` · `endDate` · `attributionWindowDays`(=7). 25건, 2025-01-01 ~ 2026-06-30.

#### Channel — 판매채널 [ORIGINAL `m_channel_ms`]
`id` · `name` · `channelType` · `partnerCode`(`LC-nnnn | null`) · `country` · `paymentTermsDays` · `effectiveDate`.
- 주의: CH-03(LC-0001) 결제조건은 마스터상 45일이지만 `lc0001_payment_term_notice.md` 로 2026-03 청구분부터 **90일**로 변경 통보됨 [ORIGINAL]. AR `MAR-0004~0006` 의 만기(청구 + 90일)가 이를 반영한다 [AGGREGATED].

#### Sku — 상품 [ORIGINAL `m_sku_ms`]
`id` · `name` · `category`(`'더마'|'기초'|'색조'|'선케어'|'헤어'|'바디'`) · `productId`(`PL-0n`, Corevia 제품군) · `sourceCompany`(전부 `Corevia`) · `safetyStockWeeksMin`(4) · `safetyStockWeeksMax`(6) · `moq` · `leadTimeWeeks`(더마 12 · 기초/선케어/헤어/바디 8 · 색조 6).

#### InventorySnapshot — 재고 스냅샷 [ORIGINAL `sku_inventory_ms`, FULL]
`skuId` · `snapshotDate`(2026-06-30) · `onHandQty` · `inTransitQty` · `stockCoverWeeksReported`(원본 컬럼 `stock_cover_weeks` — 우리 재계산값과 소수 1자리까지 일치함, 집계 확인).

#### PurchaseOrder — 기발주 [ORIGINAL `sc_purchase_orders_ms`, FULL]
`id`(`SPO-nnnn`) · `skuId` · `supplierId`(`Corevia`) · `orderDate` · `orderQty` · `moq` · `leadTimeWeeks` · `amountKrw` · `paymentDueDate`(14건 모두 **2026-07-21**, 합계 3,749,760,000원).
- 파생 `expectedArrivalDate = orderDate + leadTimeWeeks×7` [AGGREGATED, 가정 A-20: 리드타임을 입고일로 간주]. 예: SPO-0001 2026-06-26 + 12주 = **2026-09-18**.

#### ExclusiveContract — 인플루언서 연간 전속계약 [ORIGINAL `inf001_exclusive_contract_notice.md`, FULL]
| 필드 | 타입 | 값(INF-001) | 라벨 |
|---|---|---|---|
| `id` | `string` | `CTR-INF-001-2026` | ASSUMPTION (ID 규칙 원본에 없음) |
| `influencerId` | `string` | `INF-001` | ORIGINAL |
| `contractType` | `'ANNUAL_EXCLUSIVE'` | 연간 전속(경쟁 브랜드 활동 제한) | ORIGINAL |
| `fixedFeeAnnualKrw` | `Krw<'FULL'>` | 2,800,000,000 | ORIGINAL |
| `performanceFeeTerms` | `string \| null` | `null` — "GMV 연동, 별도 정산", 산식 없음 | ORIGINAL(존재) · 조건은 **미확인**(G-02). 에이전시 모의 회신 「정보 제공」이 오면 회신 문구가 들어가고 **MOCK** 으로 표시(A-33). 문구는 숫자로 바꾸지 않는다 — 권한 판정 연 금액은 계속 "하한 28억" |
| `currentTermEnd` | `IsoDate` | 2026-08-31 | ORIGINAL |
| `noticeDeadline` | `IsoDate` | 2026-07-17 | ORIGINAL |
| `autoRenewalTermMonths` | `number` | 12 | ORIGINAL ("동일 조건 1년 자동 갱신") |
| `earlyTerminationPenaltyRate` | `number` | 0.5 (잔여 고정 피의 50%) | ORIGINAL |
| `feePaymentSchedule` | `null` | 미확인 (G-09) | — |
| `status` | `ContractStatus` | 2절 상태 머신 | — |
| `decision` | `'RENEW_SAME' \| 'RENEGOTIATE' \| 'TERMINATE' \| null` | 승인된 결정 | — |

#### ExpansionProposal — 캠페인 확대 기안(묶음) [INTERPRETED]
`mkt_budget_plan_ms.csv` 25행 전체를 **기안 1건**으로 본다 — 회의록 "마케팅팀이 캠페인 확대 기안을 상신(`mkt_budget_plan_ms.csv`, 25건)" · "본 기안(1.8억)" [INTERPRETED].
| 필드 | 타입 | 값 | 라벨 |
|---|---|---|---|
| `id` | `string` | `PROP-2026-07` | ASSUMPTION |
| `submittedBy` | `'MARKETING_TEAM'` | | INTERPRETED (회의록) |
| `totalRequestedKrw` | `Krw<'SAMPLE'>` | **180,803,272** | AGGREGATED (25행 합) |
| `lineCount` | `number` | 25 | AGGREGATED |
| `expectedGmvTotalKrw` | `Krw<'SAMPLE'>` | 1,923,937,023 | **CLAIM** (차감 전 — 승인 근거 불가) |

#### ExpansionLine — 기안 건(행) [ORIGINAL `mkt_budget_plan_ms`]
| 필드 | 타입 | 원본 컬럼 | 비고 |
|---|---|---|---|
| `id` | `string` (`PLAN-nnn`) | `plan_id` | |
| `proposalId` | `string` | — | `PROP-2026-07` |
| `campaignId` | `string` | `campaign_id` | 확대 대상 기존 캠페인 |
| `influencerId` | `string` | — | `m_campaign_ms` 조인 [AGGREGATED] |
| `requestedKrw` | `Krw<'SAMPLE'>` | `requested_budget_krw` | |
| `expectedGmvKrw` | `Krw<'SAMPLE'>` | `expected_gmv_krw` | **CLAIM** |
| `settlementDate` | `IsoDate` | `settlement_date` | **현금 유출일로 해석** [INTERPRETED: 회의록 "집행 예정일(`settlement_date`)이 자금일보 · 현금 전망과 겹치는지 대조"] |
| `contractDeadline` | `IsoDate` | `contract_deadline` | 자동 확정 기한 [ORIGINAL 정책] |
| `status` | `LineStatus` | — | 2절 |
| `routing` | `Routing` | — | R-AUTH-01/03 계산 결과. `Routing = {requiredRole, alsoReportTo, reasons, forecastRunId?}` — `forecastRunId` 는 라우팅 계산에 쓴 재전망 ID(AC-2-02 사유 기록) |
| `flags` | `LineFlag[]` | — | 아래 enum |
| `approvedByRole` | `ApproverRole \| null` (선택) | — | 이 건에 승인 · 조건부 승인을 준 회신자 역할. R-AUTH-06 이 "하위 권한자의 승인인가"를 판정할 때 쓴다. 재승인 필요로 바뀌면 `null` |
| `approvalRequestId` | `string \| null` (선택) | — | 지금 이 건이 걸려 있는(마지막) 승인요청 ID. 회신이 이 요청의 대기 건인지 확인(R-AUTH-05)과 재상신에 쓴다 |
| `supplyOutlook` | `'UNKNOWN' \| 'INBOUND_CONFIRMED' \| 'NO_SUPPLY'` (선택) | — | 공급 전망. 보충요청 초안 생성 시 `UNKNOWN`, SCM 회신 "불필요 · 입고 예정" → `INBOUND_CONFIRMED`, 보충 거절 → `NO_SUPPLY`. R-INV-03 권고에 반영(4-4) · MOCK 회신 결과 |
| `inboundExpectedDate` | `IsoDate \| null` (선택) | — | SCM 이 회신한 입고 예정일 (MOCK). ④-a 에서 2026-09-18 |

```ts
type LineFlag =
  | 'OVER_10M'                 // 건별 1천만원 초과 (5건: PLAN-001~005)
  | 'IN_COVENANT_WINDOW'       // settlementDate 가 covenant 하회 예상 구간 안
  | 'SETTLEMENT_BEFORE_DEADLINE' // settlementDate < contractDeadline (12건, G-11)
  | 'CONTRACT_PENDING'         // 같은 인플루언서의 전속계약이 미결정 (INF-001 건)
  | 'CP_NEGATIVE' | 'CP_POSITIVE'   // R-CP-05 공식값(A05) 부호
  | 'CP_REF_SIGN_DIFFERS'           // 1.4 참고값 부호가 다름 — 참고 표시만
  | 'INVENTORY_BELOW_MIN'      // 주력 SKU 커버 < 안전재고 min (R-INV-03)
  | 'STOCKOUT_BEFORE_SETTLEMENT'; // 집행일 전에 예상 품절 (R-INV-02)
```

#### CampaignPerformance — 캠페인/인플루언서 실질 성과 [AGGREGATED, SAMPLE] (저장하지 않고 계산, 캐시 가능)
`key`(campaignId 또는 influencerId) · `orderCount` · `returnOrderCount`(반품 주문 수 — 반품물류비 A-03 의 횟수) · `scale: 'SAMPLE'`(항상 표본) · `gmv` · `couponDiscount` · `returnRefund` · `netRevenue` · `cogs` · `channelFee` · `fulfillmentCost` · `returnLogisticsCost` · `marketingSpend` · `cp`(공식값, A05 단일 차감) · `cpRefDef14`(참고값, 1.4 문자 그대로) · `nominalRoas` · `realRoas`(공식) · `realRoasRefDef14`(참고) · `returnRate` · `adSpendShare` · `requestShare` · `ranks`. 값은 4절 R-CP 와 [DEMO_SCENARIOS.md 부록 A](DEMO_SCENARIOS.md#부록-a-계산-기대값-골든-값).

#### CashForecastRun — 자금 재전망 [AGGREGATED, FULL]
`id` · `asOf` · `inputsVersion`(조건 변경 이벤트 ID 목록) · `assumptionIds` · `daily: {date, closingKrw}[]`(영업일) · `minClosing: {date, krw}` · `breachWindows: {start, end}[]`(30억 미만 연속 영업일) · `createdAt`.
- `OfficialForecast`(`fin_cash_forecast_ms`) 는 **CLAIM** 으로 별도 표시하고 재전망과 차이를 보여준다(R-CASH-03).
- `OfficialComparisonRow` [AGGREGATED, FULL, 저장하지 않고 계산] — 공식 전망 1행(`week`)과 재전망 1개 run 의 대응: `week` · `periodStart` · `periodEnd`(A-32: 직전 화 ~ 해당 월, 첫 주 7/1 ~ 7/6) · `official`(CLAIM, `projected_closing_krw`) · `recalculated`(AGGREGATED, `week` 날짜 영업일 종가) · `diff`(재전망 − 공식) · `belowThreshold` · `belowDays`(기간 내 종가 < 30억 영업일 수, 재전망 기준). **대조 전용** — 권한 판정 · `breachWindows` · 경고 · 권고의 입력이 아니다. 기대값은 [DEMO 부록 A-4-1](DEMO_SCENARIOS.md).

### 1-3. 도메인 엔티티 (운영 · 새로 생성) — 모두 원본에 없음

| 엔티티 | 테이블 (2단계 구현) | 생성 주체 | 라벨 |
|---|---|---|---|
| `Event` 사건 입력 | `events` | 사람(시연 입력) · 시스템(시점 이동) | 원본 문서 접수는 ORIGINAL 참조, 조건 변경 · 회신은 MOCK |
| `Assessment` AI 판단안 | `assessments` | AI(도구 호출) + 규칙 엔진 | 숫자는 AGGREGATED(도구 반환값), 문장은 AI(모의 모드면 MOCK) |
| `ApprovalRequest` 승인 요청 | `approval_requests` | 도구(규칙 엔진이 권한자 결정) | ASSUMPTION(절차) + ORIGINAL(권한 규칙) |
| `ApprovalReply` 승인 회신 | `approval_replies` | 사람(권한자 역할로 입력) | **MOCK** |
| `Task` 작업 | `tasks` | 도구(상태 전이 부수효과) | ASSUMPTION |
| `Notice` 통보 기록 | `notices` | 계약 담당(작업 완료) | MOCK |
| `NoticeReceipt` 수령확인 (확장) | `notice_receipts` | 상대방 모의 회신 | MOCK |
| `ReplenishmentRequest` 재고 보충 요청 | `replenishment_requests` | 도구(R-INV-04) | AGGREGATED 수량 + ASSUMPTION |
| `AuditLog` 처리 이력 | `audit_log` | 모든 상태 변경 | — |
| `SimClock` 가상 기준시각 · 현재 재전망 | `sim_state` (1행) | 시연 입력 | ASSUMPTION A-21 |
| 계약 · 기안 건 · 기안 묶음 | `contracts` · `expansion_lines` · `sim_state.proposal` | 시드 · 접수 이벤트 | 1-2 라벨 그대로 |
| 가정 목록 사본 | `assumptions` (`source='assumption'`) | 시드(5절 사본) | ASSUMPTION |

#### DB 스키마 원칙 (2단계 구현, 2026-11-14 채택)
- **운영 테이블 = 조회용 핵심 열 + `data` jsonb**: 각 엔티티 테이블은 `id` · `status` · `ord`(생성 순서) · 조회 열(예: `expansion_lines.required_role` · `contract_deadline`, `approval_requests.subject_type` · `required_role` · `assessment_id` · `supersedes_id`, `tasks.type` · `owner_role` · `subject_id` · `due_at`, `assessments.subject_type` · `ai_mode`)과 도메인 객체 전체를 담은 `data` jsonb 를 가진다. **이 문서의 필드 정의가 `data` 의 모양**이고, 조회 열은 그 사본이다. 객체를 jsonb 로 넣고 다시 읽어도 같다는 왕복 테스트가 있다. 이유: 타입이 바뀔 때마다 마이그레이션하지 않으면서, 처리 이력 화면(S-11) · 승인함 필터는 SQL 열로 보인다(백엔드 설계, 기록은 devlog).
- **`events` · `audit_log` 는 추가만 한다**(수정 · 삭제 없음, 시나리오 초기화 때만 비움). `audit_log` 열: `id` · `ord` · `entity_type` · `entity_id` · `from_status` · `to_status` · `actor_role` · `actor_kind` · `rule_ids` · `event_id` · `reason` · `sim_at`(가상 기준시각) · **`recorded_at`(실제 기록 시각)** · `snapshot`. 도메인 타입의 `createdAt` 이 DB 의 `recorded_at` 이다. `events` 도 `sim_at` 과 `recorded_at` 을 함께 둔다.
- **`sim_state` 1행**: `sim_now` · `version`(낙관적 잠금 · 응답의 `stateVersion`) · `preset`(마지막 재생 프리셋) · `forecast`(현재 재전망) · `ar_due_overrides` · `seq`(ID 일련번호) · `proposal`.
- 상태 계산 · 전이는 `domain/workflow` 순수 함수가 하고 DB 는 결과를 저장만 한다. 테스트는 같은 인터페이스의 메모리 저장소로 돌고, DB 통합 테스트는 `TEST_DATABASE_URL` 이 있을 때만 돈다.

#### Event
```ts
type EventType =
  | 'RENEWAL_NOTICE_RECEIVED'      // 갱신 통보 접수 (inf001 통보서) — payload: {contractId}
  | 'EXPANSION_PROPOSAL_RECEIVED'  // 확대 기안 접수 — payload: {proposalId} (25건 전체. 건 범위 선택 없음 — 아래)
  | 'AR_COLLECTION_DELAYED'        // 조건 변경: 회수 지연 통보 — payload: {arId, newDueDate}
  | 'LINE_TERMS_CHANGED'           // 조건 변경: 기안 금액/집행일 정정 — payload: {lineId, requestedKrw?, settlementDate?}
  | 'APPROVAL_REPLY'               // 모의 회신 — payload: ApprovalReply
  | 'COUNTERPARTY_REPLY'           // 에이전시 · SCM · Corevia 모의 회신 (승인 회신이 아닌 수령확인 · 정보 회신 · 검토 회신)
  | 'CLOCK_ADVANCED';              // 시점 이동 — payload: {from, to}
interface Event { id: string; type: EventType; payload: unknown; label: 'ORIGINAL' | 'MOCK'; simAt: string; createdAt: string; createdBy: ActorRole }
```
- **기안 접수는 25건 전체로만 한다** (2026-11-14 결정, 9-2 ①). 첫 판의 `lineIds?`(건 범위 선택)는 없앤다. 이유: 권한 판정의 기안 총액은 25건 현재 요청액 합이다(R-AUTH-01, [W02_TASK 3-3](W02_TASK.md)). 일부만 접수하면 총액이 줄어 — 예: 7/17 마감 5건만이면 70,902,290 < 1억 — 건별 1천만 이하 건이 Masil 대표에서 마케팅팀 전결로 내려간다. 입력 범위로 승인 권한 제약을 없애는 결과라 막는다(CLAUDE.md 규칙 7). 판단 범위를 나누는 일은 접수가 아니라 S-04 행 선택 → 판단안(대상 건 지정)이 한다. payload 에 `lineIds` 가 오면 422 `VALIDATION`(BE-20).
- `COUNTERPARTY_REPLY` 입력 (2단계 최종, `types.ts` — 2026-11-14 코드 확인). S-02 「외부 회신」 · S-03 통보 탭 · S-07/S-09 SCM [보충 검토 회신]이 모두 이 모양으로 `POST /api/events` 에 보낸다:

  ```ts
  type CounterpartyRole = 'AGENCY' | 'SCM' | 'COREVIA';
  type CounterpartyOutcome = 'RECEIPT_CONFIRMED' | 'INFO_PROVIDED' | 'INSUFFICIENT' | 'REJECTED'; // 수령확인 · 정보 제공 · 정보 부족 · 거절
  interface CounterpartyReplyInput {
    from: CounterpartyRole; outcome: CounterpartyOutcome; note: string;
    inboundExpectedDate?: IsoDate;   // SCM · Corevia 가 확인한 입고 예정일
    replenishmentNeeded?: boolean;   // SCM 정보 제공일 때 필수 (없으면 422 VALIDATION)
    label: 'MOCK';                   // API 요청에는 넣지 않는다 — 서버가 MOCK 으로 붙임
  }
  type ScmReviewInput = CounterpartyReplyInput & { from: 'SCM' };   // 도메인 함수 scmReview 입력
  ```
  단일 입구 `counterpartyReply` 가 상대별 함수로 보낸다. **상대별 효과** (모두 `actorKind = MOCK`, 맞는 열린 작업 · 초안이 없으면 404 `NOT_FOUND`):

  | 보내는 쪽 | 회신 결과 | 도메인 함수 | 상태 변경 | 근거 |
  |---|---|---|---|---|
  | AGENCY | 수령확인 | `recordNoticeReceipt` | `NoticeReceipt` 생성, 계약 `NOTICE_SENT → NOTICE_ACKNOWLEDGED → NEGOTIATING/TERMINATING`, `CONFIRM_RECEIPT` · `RENOTIFY` 작업 `DONE`. 계약이 `NOTICE_SENT` 가 아니면 409 | R-EXT-01 |
  | AGENCY | 정보 제공 | `recordCounterpartyReply` | 열린 계약 `INFO_REQUEST` 작업 `DONE` + 결과 메모, **`contract.performanceFeeTerms` = 회신 문구(MOCK)**, 계약 이력 1행(상태 유지). 다음 판단안의 사실 「성과 피 조건」이 `모의` 값으로 바뀌고, `unknowns` 의 G-02 는 **빠지지 않고 `status = 'FILLED_BY_MOCK'`("모의 회신으로 보완 — 원본 공백은 그대로")로 남는다**(2026-11-14 결정 10-1 ⓐ, BE-21 — 지금 구현은 목록에서 뺌). 권한 판정 연 금액은 하한 28억 그대로 | **A-33** |
  | AGENCY | 정보 부족 · 거절 | `recordCounterpartyReply` | 열린 계약 `INFO_REQUEST` 작업 `DONE` + 결과 메모만. G-02 유지. 계약 · 통보 상태는 바꾸지 않는다(통보는 일방 통지라 상대 거절로 효력이 바뀌지 않음) | ③ S3-2 |
  | SCM | 정보 제공 + 보충 불필요(`replenishmentNeeded:false`, 입고 예정일) | `scmReview` | SCM `REPLENISHMENT_REVIEW` · `INFO_REQUEST` `DONE`, 초안 전부 `DRAFT → REJECTED`(사유 "불필요: …"), 연결 건 `supplyOutlook = INBOUND_CONFIRMED` + `inboundExpectedDate` | A-30 (④-a) |
  | SCM | 정보 제공 + 보충 필요(`true`) | `scmReview` | SCM 두 작업 `DONE`, 초안 `DRAFT → SUBMITTED` + 보충 승인요청 1건(R-AUTH-04: SCM, 지급일이 하회 구간이면 그룹 CEO/이사회) | ④-b |
  | SCM | 정보 부족 | `scmReview` | SCM `INFO_REQUEST` 만 `DONE`. 초안 · `REPLENISHMENT_REVIEW` 는 그대로(G-08 미해결) | — |
  | SCM | 거절 (보충 불가) | `scmReview` | SCM 두 작업 `DONE`, 초안 전부 `DRAFT → REJECTED`(사유 "보충 불가: …"), 연결 건 `supplyOutlook = NO_SUPPLY` → 다음 권고가 부결(R-INV-03) | **A-34** |
  | COREVIA | 정보 제공(입고 예정일) | `coreviaReply` | SCM 이 연 `INFO_REQUEST` `DONE`, 입고 예정일이 있으면 연결 건 `inboundExpectedDate` 기록(공급 전망은 그대로 — 권고 조건 문구의 날짜만 바뀜) | G-08 |
  | COREVIA | 정보 부족 · 거절 | `coreviaReply` | SCM `INFO_REQUEST` `DONE` + 결과 메모만 | — |
  | SCM · COREVIA | 수령확인 | — | **422 `VALIDATION`** (통보 수령확인은 에이전시만) | — |

- 이벤트 처리 결과에 붙는 `routingChanges` 항목 = `{lineId, from, to, ruleId, action}`. `action` 은 R-AUTH-06 처리 방식(4-1 표).

#### Assessment (판단안)
`id` · `subjectType`(`'CONTRACT' | 'EXPANSION_LINES' | 'REPLENISHMENT'`) · `subjectIds` · `triggerEventId` · `facts: AssessmentFact[]`(도구가 돌려준 값만) · `ruleResults: AssessmentRuleResult[]` · `alternatives: Alternative[]` · `recommendation: {alternativeId, rationale}` · `perspectives: {marketing, finance, contract, scm}`(관점별 근거 문장) · `claimsCited: {text, ref}[]`(주장 인용은 분리) · `unknowns: AssessmentUnknown[]`(= `{gapId, impact, status, statusText}` — 아래 「미확인 목록의 공백 상태」) · `aiMode: 'LIVE' | 'MOCK'`(운영 판단안은 이 둘뿐 — 기록 재생의 `RECORDED` 는 재생 전용 타입에만 있다, 9-1) · `model` · `version`(같은 대상(`subjectType` + 정렬한 `subjectIds`) 판단안의 버전, 다시 판단하면 +1 — AC-3-02 판단안 v2 · AC-4-06 "버전이 올라간다") · `createdAt` · 아래 2단계 필드.

```ts
interface AssessmentFact { key: string; name: string; value: Sourced<unknown> }   // key = 안정 식별자 예 'line.PLAN-004.cp', name = 화면 표시명
interface AssessmentRuleResult { ruleId: RuleId; result: unknown; inputs: unknown; subjectId?: string } // subjectId = 어느 계약 · 건 · 보충요청의 결과인가
interface ToolCallLog { name: string; input: unknown; output: unknown; actor: 'AI' | 'SYSTEM' } // AI = 모델이 호출, SYSTEM = 모의 모드에서 코드가 같은 도구를 직접 실행
// Assessment 추가 필드 (2단계)
proposedDecisions?: { itemId; decision; condition? }[]  // 규칙 기반 건별 권고 — 승인요청 proposed 의 원천 (AI 가 정하지 않음)
toolCalls?: ToolCallLog[]        // S-05 「도구 호출 목록」
fallbackReason?: string | null   // 실시간 호출 실패 · 거절(refusal) · 숫자 출처 위반으로 모의 대체된 이유 (오류 원문 · 키는 넣지 않음)
stopReason?: string | null       // 모델 stop_reason (모의면 null)
warnings?: string[]
aiTrace?: AiTurnTrace[]          // 4단계: 실시간 호출 추적 — 모델 응답마다 1행. 모의 판단안에는 없다. 키 · 헤더 · 본문은 넣지 않는다
interface AssessmentUnknown { gapId: string; impact: string; status: 'OPEN' | 'FILLED_BY_MOCK'; statusText: string } // 4단계 (BE-21)
interface AiTurnTrace { messageId: string; model: string; stopReason: string | null; inputTokens: number | null; outputTokens: number | null } // model = API 응답의 model 필드
```
- `Alternative = { id, title, decision, effects: Sourced<unknown>[], risks: string[], requiresRole: ApproverRole }`.
- **미확인 목록의 공백 상태** (2026-11-14 결정, 10-1 ⓐ · BE-21): `unknowns[].status` = `'OPEN'`(미확인) 또는 `'FILLED_BY_MOCK'`(모의 회신으로 보완 — 원본 공백은 그대로), `statusText` 는 그 표시 문구. 판정은 S-12 공백 상태(BE-12)와 **같은 함수 · 같은 값**을 쓴다: G-02 = 에이전시 모의 「정보 제공」으로 `performanceFeeTerms` 가 채워짐, G-03 = 모의 수령확인(`NoticeReceipt`)이 있음, G-08 = SCM · Corevia 모의 회신으로 공급 전망 · 입고 예정일이 기록됨. **모의 회신으로 채워졌다고 `unknowns` 에서 빼지 않는다** — 원본 공백은 그대로이고(A-33), 판단안이 해소된 것처럼 보이면 S-12 와 어긋난다. 그 판단안을 만든 시점의 상태를 저장한다(나중에 바뀌어도 저장된 판단안은 그대로 — 스냅샷). **구현됨**(BE-21, LOG-030 — 코드 확인): 판정 함수는 `domain/gaps.ts` 의 `gapStatus` · `gapState` 하나이고 `GAP_STATUS_TEXT` 가 문구("미확인" / "모의 회신으로 보완 — 원본 공백은 그대로")를 정한다. S-12(`registryView`)와 판단안(`assessment.ts`)이 같은 함수를 쓴다. AI 도구 `get_open_gaps` 의 반환값에도 `status` · `statusText` 가 들어간다(기록 `rec-001` 의 도구 출력으로 확인). 테스트 `tests/api/be-21-24.test.ts` BE-21 5건.
- **AI 가 만든 숫자는 저장하지 않는다.** 판단안의 모든 숫자는 `facts` / `ruleResults` 의 값을 참조한다(CLAUDE.md 규칙 9). 2단계 구현은 이를 **숫자 출처 검증**(`domain/provenance.ts`)으로 강제한다: 문장(권고 이유 · 관점 · 대안 제목 · 효과 · 위험)의 숫자는 `facts` · `ruleResults` 값만 허용, 주장 숫자(예상 GMV 등)는 `claimsCited` 에만, `facts` 에 `CLAIM` 값이 있으면 위반. 날짜 · ID · 절 번호 · 0~12 작은 정수 · 연도는 숫자로 보지 않는다. 실시간 AI 결과가 검증을 통과하지 못하면 저장하지 않고 결정적 모의 문장으로 대체한다(`aiMode = MOCK`, `fallbackReason` 기록).
- **AI 가 정하는 것은 문장과 계약 대안(A/B/C) 권고 하나뿐**이다. 숫자 · 권한자 · 건별 권고(`proposedDecisions`)는 `domain/assessment.ts` 가 결정적으로 만든다. 권고 대안 ID 는 제출 도구 스키마의 enum 으로 제한된다.
- **시연 런타임의 판단안은 모의다** (2026-11-14 사용자 결정 (b), 9-1 — `AOURA_AI_MODE=mock`). 실제 Claude 실행은 **1회 확인**했고(2026-11-14 17:19 KST, 계약 판단안) 그 기록을 운영 판단안과 **따로** 보여준다(기록 재생 — 운영 상태 `assessments` 에 넣지 않는다, DD-050). 모의 모드에서는 같은 도구 6개(조회 5개 + 제출 1개)를 코드가 직접 실행하고(`toolCalls[].actor = 'SYSTEM'`), 문장은 결정적 문장, 계약 대안 권고는 규칙(`domain/assessment.ts`)이 정한다. 숫자 · 권한자 · 건별 권고 · 상태 전이는 실시간이든 모의든 같으므로 시연 흐름(상신 → 회신 → 상태 변경 → 다음 판단)에 영향이 없다. 화면은 헤더 · 판단안에 `모의` 표시를 유지한다(UI-06).
- **판단안 저장 · 이력** (2단계): `WorldState.assessments` 에 쌓인다. 저장할 때 이력 1행 — `entityType = 'ASSESSMENT'`, `fromStatus = null → toStatus = 'CREATED'`, `actorRole = 'AI_AGENT'`, `actorKind = 'AI'`(실시간) 또는 `'MOCK'`, `ruleIds` = 판단안이 쓴 규칙, 사유에 버전 · 권고 · 모의 대체 이유. **판단안은 어떤 엔티티의 상태도 바꾸지 않는다**(3-1 "AI 는 어떤 전이도 직접 일으키지 않는다").
- **빈 대기 요청에 판단안 자동 연결**: 판단안을 저장할 때, `assessmentId` 가 비어 있는 `PENDING` 승인요청 중 같은 `subjectType` 이고 대상이 판단안 대상에 모두 들어 있는 요청에 판단안 ID 를 채운다(이력 1행, 승인요청 상태 유지). 예: ② 권한 재판정으로 시스템이 만든 PLAN-004 재승인 요청에 ASM-004 가 붙는다.
- **동시성**: 판단안은 상태를 읽은 버전에서만 저장된다. AI 호출 중 다른 처리로 상태가 바뀌었으면 409 `CONFLICT`("판단안을 만드는 사이 상태가 바뀌었습니다 — 다시 만드세요").
- API 응답(`AssessmentView`)은 여기에 `mock`(= `aiMode === 'MOCK'`) · `provenance`(`{ok, violations[]}`, 저장된 판단안은 항상 ok) · `approvalRequestIds`(이 판단안을 근거로 한 승인요청)를 더한다.
- **기록 재생 타입** (4단계, `api-types.ts`): `RecordedAssessmentView` = `AssessmentView` 에서 `aiMode` 만 `'RECORDED'` 로 바꾼 것. `RecordedRunView` = `{id(REC-nnn), aiMode: 'RECORDED', label, calledNow: false, inOperationalState: false, executedAt, finishedAt, executedAtKst, model, request{sdk, thinking, effort, maxTokens, system, user, tools[]}, scenario{steps[], simNow, persistence, rawSource, invokedVia}, assessment: RecordedAssessmentView, followUp{approvalRequests[], audit[]}, basisCheck{ok, replayedSteps, mismatches[]}}`. 운영 타입의 `aiMode` 는 넓히지 않았다 — `LIVE` 는 "지금 모델이 만든 것"만 뜻하게 둔다(9-1 표시 규칙).

#### ApprovalRequest
| 필드 | 타입 | 비고 |
|---|---|---|
| `id` | `string` | `APR-nnn` |
| `subjectType` | `'CONTRACT' \| 'EXPANSION_LINES' \| 'REPLENISHMENT'` | |
| `subjectIds` | `string[]` | 묶음 단위 A-11 |
| `requiredRole` | `ApproverRole` | 규칙 엔진 결과 (AI 가 정하지 않음) |
| `alsoReportTo` | `ApproverRole[]` | 예: `['GROUP_CEO_BOARD']` (그룹 보고) |
| `routingReasons` | `{ruleId, text, label}[]` | 예: R-AUTH-03 covenant 우선 |
| `assessmentId` | `string` | 근거 판단안 (숫자 스냅샷) |
| `proposed` | `{itemId, decision}[]` | 권고안 |
| `internalDueAt` | `string` | 내부 처리 기한 A-12 |
| `hardDeadline` | `IsoDate` | 원본 기한 (7/17 등) |
| `status` | `ApprovalStatus` | 2-3절 |
| `version` | `number` | 첫 상신 1. `supersedesId` 가 있으면 **이전 요청 version + 1** (재상신 · 재승인 · 권한 재판정 재상신 모두 같은 규칙) |
| `supersedesId` | `string \| null` | 권한 재판정 · 재상신 시 이전 요청 |
| `proposedSource` | `'SUBMITTER'` (선택) | 4단계(BE-22): 권고안이 근거 판단안 권고와 **다른** 상신자 지정 결정일 때만 저장. 없으면 판단안 · 규칙 권고 그대로. API(`ApprovalView.proposedSource`)는 항상 `'ASSESSMENT' \| 'SUBMITTER'` 로 준다 |

- **요청 ID(`APR-nnn`)는 생성 순서 일련번호일 뿐 의미가 없다.** 프리셋마다 재생하는 이벤트가 달라 같은 의미의 요청도 번호가 달라진다(예: ③ 재상신 요청은 ③ 프리셋에서 `APR-004`). 수용 기준 · 테스트 · 모의 회신은 번호가 아니라 **의미(대상 · requiredRole · version · supersedesId)** 로 요청을 찾는다. 문서의 `APR-00n` 표기는 해당 프리셋에서의 예시다.
- **재상신 근거 판단안 · 권고 결정** (2026-11-14 확정, 계약 `RESUBMIT` 작업 완료 — LOG-023 결함 · LOG-025 수정 · 10-2):
  1. **근거 판단안** = 작업 완료 요청이 지정한 판단안(`payload.assessmentId`), 지정하지 않으면 **그 시점 최신 계약 판단안**(같은 계약 대상 중 버전이 가장 높은 것). 새 요청의 `assessmentId` 에 넣는다. 없는 판단안 ID → 404 `NOT_FOUND`, 계약 판단안이 아닌 것 → 422 `VALIDATION`, 어느 경우든 상태 불변(작업도 열린 채).
  2. **권고 결정(`proposed`)** = 근거 판단안의 권고 대안의 결정. 이전 요청의 권고를 복사하지 않는다 — 반려된 권고안을 그대로 다시 올리면 근거 판단안과 요청 권고가 어긋나 권한자가 틀린 안에 회신한다(③ 분기 A: ASM-003 권고 C 해지인데 재상신 요청이 `RENEGOTIATE` 였던 결함).
  3. **상신자 지정 결정**: `payload.proposedDecision`(`RENEW_SAME` · `RENEGOTIATE` · `TERMINATE`)이 오면 그 값이 우선한다 — 무엇을 올릴지는 상신자(계약 담당)의 일이고 결정은 여전히 권한자 회신으로만 확정된다(R-AUTH-05). 단 판단안 권고와 다르면 **숨기지 않는다**: 승인요청 생성 이력 사유에 "상신자 지정 결정 {결정} — 근거 판단안 {ID} 권고 {결정} 와 다름"을 남기고, API(`ApprovalView`)가 `proposedSource: 'ASSESSMENT' | 'SUBMITTER'` 와 판단안 권고 문구(`assessmentDecisionText` — 계약 요청만, 판단안이 없거나 권고 없음이면 null)를 준다(BE-22 **구현됨**, LOG-030). **`SUBMITTER` 판정 기준 (4단계 확정 — 구현을 채택)**: 상신자가 결정을 지정했고 **그 값이 근거 판단안 권고와 다를 때만** `SUBMITTER` 다. 지정했지만 판단안 권고와 같으면 `ASSESSMENT` 이고, 지정 사실은 이력 사유 "상신자 지정 결정 {결정} — 근거 판단안 {ID} 권고와 같음"으로만 남는다. 이유: 화면 문구가 "상신자 지정 — 판단안 권고와 다름"이라, 같은 값에 `SUBMITTER` 를 붙이면 그 문구가 거짓이 된다(이전 판의 "지정이면 `SUBMITTER`"를 고침). 화면 입력은 두지 않는다(API 전용).
  4. **계약 판단안이 하나도 없으면 재상신을 거부한다** — 422 `INFO_MISSING` "근거 판단안이 없습니다 — 판단안을 만든 뒤 재상신하세요", 상태 불변(BE-22 **구현됨** — `domain/workflow.ts` `completeTask`, 테스트 `be-21-24.test.ts` "계약 판단안이 하나도 없으면 재상신 거부". 이전 요청의 권고를 유지하던 ③ 순위는 삭제됐다). 이유: 승인요청은 근거 판단안의 숫자 스냅샷 위에서 결정된다(위 `assessmentId`). 근거 없이, 그것도 반려된 권고를 그대로 실어 28억 계약을 권한자에게 올리는 경로를 두지 않는다. API 경로에서는 첫 상신이 판단안에서 만들어지므로 이 경우가 생기지 않고, 도메인 함수 직접 호출(테스트)에서만 생긴다. 근거 판단안의 권고가 "권고 없음"(`NONE`)이고 상신자 지정도 없으면 지금처럼 422.
  5. **반려 뒤 판단안을 다시 만들지 않고 재상신**(최신 판단안 = 반려된 요청의 근거)하는 것은 막지 않는다 — 요청 권고와 근거 판단안이 서로 맞고, 다시 올릴지는 상신자 판단이다. 시연 절차는 재판단(v2) 뒤 재상신이고(DEMO S3-2 → S3-3), S-07 재상신 양식이 근거 판단안의 버전 · 권고를 보여 무엇이 올라가는지 알 수 있게 한다(FE-16).
- 이전 요청의 상태 처리: 이전 요청이 아직 `PENDING` 이면 `SUPERSEDED` 로 닫는다. 이미 회신된 요청(`APPROVED` · `REJECTED` 등)은 **상태를 그대로 두고** 새 요청의 `supersedesId` 로만 연결한다(회신 기록은 사실이므로 바꾸지 않는다). 회신된 요청 안의 일부 건만 재승인이 필요해진 경우(② APR-003 의 PLAN-004)도 같다 — 그 건의 승인 효력 상실은 건의 이력(`APPROVED → REAPPROVAL_REQUIRED`)으로 남긴다.

#### ApprovalReply [MOCK]
`id` · `requestId` · `respondentRole` · `outcome: 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED' | 'INFO_REQUESTED'` · `itemDecisions: {itemId, decision: 'APPROVE' | 'REJECT' | 'HOLD' | 'CONDITIONAL', condition?: string}[]` · `decision?: ContractDecision`(계약 회신) · `reason` · `infoRequest?: {target: ActorRole, question: string}`(반려 · 정보요청 회신에 붙는 정보 요청 — 있으면 `INFO_REQUEST` 작업을 만든다) · `simAt` · `label: 'MOCK'`.
- 검증: `respondentRole === request.requiredRole` 이 아니면 **거부(422 `FORBIDDEN_ROLE`)**. 메시지는 "권한 없음: 이 요청은 {권한자 한국어 이름}만 결정할 수 있습니다 (회신자 …)" — 화면은 이 문구를 그대로 보여준다(UI-04). 건별 현재 권한자가 요청 권한자보다 높아진 경우(R-AUTH-06)는 "권한 없음: {건} 은(는) {권한자}만 결정할 수 있습니다 (권한자 변경 — R-AUTH-06)". 하위 권한자의 승인으로 상위 권한 건을 확정할 수 없다(R-AUTH-05).
- **회신 대상 지정** (2단계, BE-05): API 회신은 경로의 요청 ID(`/api/approval-requests/:id/replies`)로 한다. 모의 회신 데이터셋 · 프리셋 재생은 번호 대신 의미로 대기 요청을 찾는다 — `RequestTarget = {subjectType, requiredRole?, includes?: string[]}`(대상 종류 · 권한자 · 이 대상들을 모두 포함), 도메인 입력 `ReplyInput = {requestId? | target?, respondentRole, outcome, itemDecisions?, decision?, reason, infoRequest?}`. 맞는 `PENDING` 요청이 여럿이면 가장 최근 것, 없으면 404 `NOT_FOUND`, 둘 다 없으면 422 `VALIDATION`.
- 입력 검증(2단계 API): 반려(`REJECTED`)는 사유, 정보 요청(`INFO_REQUESTED`)은 질문이 없으면 422 `VALIDATION`. 계약 승인에 `decision` 이 없으면 422 `INFO_MISSING`. 조건부 건에 조건 문구가 없으면 422 `INFO_MISSING`(요청 본문의 `conditions` 를 건별 조건 기본값으로 쓸 수 있음).
- **`outcome` 과 건별 결정의 관계** (2026-11-14 확정):
  - `outcome` 은 요청 전체에 대한 회신 유형이고, 건의 상태는 `itemDecisions` 로 정한다. 건별 결정이 없는 건은 `outcome` 에서 정한다: `REJECTED` → REJECT, `INFO_REQUESTED` → HOLD, `APPROVED` 류 → 요청의 권고안(`proposed`)대로.
  - **승인과 부결이 섞인 회신(권고안 승인 포함)의 `outcome` 은 `APPROVED`** 다. 예: ① APR-002 "권고안 승인 = 3건 REJECT", APR-003 "PLAN-004 승인 · PLAN-005 부결". 권한자가 권고안 · 건별 결정을 **승인**한 것이고, 부결은 그 승인된 결정의 내용이기 때문이다 [가정 — 원본에 회신 유형 정의 없음, A-24 모의 회신 규칙].
  - 건별 결정에 `CONDITIONAL` 이 하나라도 있으면 `outcome` 은 `APPROVED_WITH_CONDITIONS` 다.
  - `REJECTED` 는 **권고안 자체를 반려**한 회신이다(계약 S3-1, 보충요청 ④-b). 권고안이 "전부 부결"이고 권한자가 그 권고안을 받아들였다면 `REJECTED` 가 아니라 `APPROVED` 다(APR-002).
  - 2단계 API 는 `CONDITIONAL` 건이 있는데 `outcome` 이 `APPROVED` 인 회신, `APPROVED_WITH_CONDITIONS` 인데 `CONDITIONAL` 건이 없는 회신을 조용히 고치지 않고 **422 `VALIDATION`** 으로 돌려준다(BE-08 구현됨). 승인 · 부결이 섞인 `APPROVED` 회신은 통과.

#### Task
```ts
type TaskType =
  | 'SEND_NOTICE'            // 상대방 통보 발송 (BPMN t5)
  | 'CONFIRM_RECEIPT'        // 수령확인 (확장 E1)
  | 'RENOTIFY'               // 재통보 (확장 E1)
  | 'DOCUMENT_CONDITIONS'    // 승인조건 문서화 (BPMN t4)
  | 'REVIEW_BEFORE_DEADLINE' // 기한 전 재검토 (BPMN '아니오' 종료)
  | 'RESUBMIT'               // 재상신
  | 'INFO_REQUEST'           // 정보 요청 (성과 피 조건, 입고일 등)
  | 'REPORT_TO_GROUP'        // 그룹 보고 (Masil 대표 승인 건)
  | 'RESCHEDULE_CAMPAIGN'    // 캠페인 집행일 조정 (부서 영향 D2)
  | 'REPLENISHMENT_REVIEW'   // SCM 재고 보충 검토 (부서 영향 D2)
  | 'INCIDENT_AUTO_RENEWAL'  // 권한 미경유 체결(AUTO_RENEWED) 사고 기록 · 후속 대응 — 자동 갱신일 때만
  | 'ESCALATE_NOTICE_UNCONFIRMED' // 통보 수령 미확인(NOTICE_UNCONFIRMED) 에스컬레이션 (확장 E1) — 2026-11-14 추가
  | 'POST_DEADLINE_REPORT';  // 기한 경과 자동 확정 건 사후 보고
type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'OVERDUE';
interface Task { id: string; type: TaskType; subjectType: 'CONTRACT' | 'EXPANSION_LINE' | 'APPROVAL_REQUEST' | 'REPLENISHMENT'; subjectId: string; ownerRole: ActorRole; dueAt: string; status: TaskStatus; createdByEventId: string | null; resultNote?: string; instruction?: string }
```
- `instruction`: 작업 지시 문구(예: 조건부 승인 조건 "집행일 2026-08-31 이후로 조정", 정보 요청 질문 "[AGENCY] 성과 피 산식 · 정산 주기"). 작업 화면(S-07)에 그대로 보인다.
- **`ESCALATE_NOTICE_UNCONFIRMED` 를 따로 두는 이유** (2026-11-14 결정): 1단계 구현은 수령 미확인 에스컬레이션에 `INCIDENT_AUTO_RENEWAL` 을 재사용했다. 그러나 `NOTICE_UNCONFIRMED` 는 "자동 갱신으로도, 통보 완료로도 처리하지 않는다"(A-14)가 핵심이라, 작업 유형 이름이 "자동 갱신 사고"이면 화면 · AI 판단안이 계약을 자동 갱신된 것으로 읽을 위험이 있다. 그래서 유형을 분리한다(BE-01). 담당 · 기한은 그대로(그룹 CEO/이사회 · 계약 담당 각 1건, 기한 A-28).

#### 작업 기한 규칙 (`dueAt`) — 2026-11-14 정리
모든 기한 시각은 해당일 23:59:59 KST(A-13). 1단계 구현값을 기준으로 정리했고, 바꾸는 항목은 BE 번호를 달았다.

| 작업 | 기한 | 근거 | 예 (시연) |
|---|---|---|---|
| `SEND_NOTICE` · `DOCUMENT_CONDITIONS` | 계약 통보 기한 D-1 | R-DL-04 (A-12) | 7/16 |
| `CONFIRM_RECEIPT` · `RENOTIFY` | 계약 통보 기한 당일 | R-DL-04 · R-EXT-01 (A-12) | 7/17 |
| 계약 `REVIEW_BEFORE_DEADLINE` · `RESUBMIT` | 계약 통보 기한 D-2 (= 계약 승인 내부 기한) | R-DL-04 (A-12) | 7/15 |
| `INFO_REQUEST` (모든 대상) | **min(생성일 + 3일, 관련 원본 기한 − 2일)** | **A-27** | ③ 7/10 생성 → 7/13 / ④ 7/20 생성 → **7/23** (BE-03) |
| 기안 건 `RESCHEDULE_CAMPAIGN` · `REVIEW_BEFORE_DEADLINE`(보류) | 그 건 확정기한 D-1 | R-DL-04 (A-12) | PLAN-004 7/16 |
| `REPLENISHMENT_REVIEW` | `INFO_REQUEST` 와 같은 기한 (SCM 회신 하나로 둘 다 닫히므로) | A-27 | ④ **7/23** (BE-03) |
| `REPORT_TO_GROUP` | 승인요청의 원본 기한 당일 | **A-29** | APR-003 → 7/17 |
| `POST_DEADLINE_REPORT` (기한 경과 자동 확정) | 그 건 확정기한 + 7일 | **A-28** | ③-B 7/24 |
| `POST_DEADLINE_REPORT` (기한 후 권한 상향 감지, R-AUTH-06) | 감지 시점(simNow) + 7일 | **A-28** | ②-변형 7/20 감지 → 7/27 |
| `INCIDENT_AUTO_RENEWAL` · `ESCALATE_NOTICE_UNCONFIRMED` | 계약 통보 기한 + 7일 | **A-28** | 7/24 |

#### Notice / NoticeReceipt (확장 E1)
- `Notice`: `id` · `contractId` · `decision`(통보 내용: 해지 · 조건변경) · `sentAt`(sim) · `channel`(`'EMAIL' | 'DOCUMENT'` — ASSUMPTION) · `label: 'MOCK'`.
- `NoticeReceipt`: `id` · `noticeId` · `receivedAt` · `evidence`(문자열: "에이전시 회신 메일" 등) · `label: 'MOCK'`.

#### ReplenishmentRequest (부서 영향 D2)
`id` · `skuId` · `triggerLineId` · `avg4wDemand` · `coverWeeks` · `targetQty`(A-17) · `suggestedQty` · `finalQty`(MOQ, A-18) · `unitCostKrw`(기발주 단가 = `amount_krw/order_qty`, 예 SKU-1001 21,840원 [AGGREGATED]) · `amountKrw: Krw<'FULL'>` · `neededBy`(IsoDate) · `expectedPaymentDate`(A-19) · `requiredRole`(`SCM` 또는 covenant 구간이면 `GROUP_CEO_BOARD`) · `status`(`'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED'`) · `openQuestions`(G-08).
- 기안 건에서 만드는 보충요청 초안은 **그 건 주력 SKU 중 안전재고 min 미달 SKU 만** 대상이다(R-INV-04 적용 범위, 4-4). ④ PLAN-011 → SKU-1001 · 1002 · 1004 3건, SKU-1003 은 없음.
- **초안 만들기 `draftReplenishment(triggerLineId, skuIds?)`** (2단계 확정, `POST /api/replenishment-requests`): `skuIds` 를 주면 그 SKU 만, 없으면 대상 SKU 전부(SKU 마다 초안 1건). 지급일 = 오늘(simNow) + 25일(A-19), 권한자는 그 지급일로 R-AUTH-04 · R-AUTH-03 판정. 함께 SCM 작업 `REPLENISHMENT_REVIEW` · `INFO_REQUEST`(G-08) 2건(기한 A-27), 연결 건 `supplyOutlook = UNKNOWN`. 오류:
  - 그 건에 min 미달 주력 SKU 가 없음(대상 아님) · `skuIds` 에 대상이 아닌 SKU 가 있음 → **422 `VALIDATION`** (예: PLAN-011 에 SKU-1003 지정)
  - 같은 건에 아직 `DRAFT` 인 초안이 있음(중복 초안) → **409 `INVALID_TRANSITION`**
  - 없는 건 ID → 404 `NOT_FOUND`

#### AuditLog
`id` · `entityType` · `entityId` · `fromStatus` · `toStatus` · `actorRole` · `actorKind: 'AI' | 'HUMAN' | 'SYSTEM' | 'MOCK'` · `ruleIds` · `eventId` · `reason` · `simAt` · `createdAt`(DB 열 `recorded_at`, 실제 기록 시각) · `snapshot`(변경 시점 주요 값 JSON).
- **모든 상태 변경은 이 테이블에 1행 이상** 남긴다. 화면 「처리 이력」의 원천.
- `entityType` 값 (2단계 코드 기준): `CONTRACT` · `EXPANSION_LINE` · `APPROVAL_REQUEST` · `TASK` · `REPLENISHMENT` · **`ASSESSMENT`**(판단안 생성 `null → CREATED`) · **`CASH_FORECAST`**(재전망 교체 — `fromStatus`/`toStatus` 에 이전 · 새 재전망 ID, 예 `CF-v1 → CF-v2`). S-11 대상 필터는 이 7개를 쓴다(FE-07).

#### 역할 (Actor / ApproverRole)
```ts
type ApproverRole = 'MARKETING_TEAM' | 'MASIL_CEO' | 'GROUP_CEO_BOARD' | 'SCM';
type ActorRole = ApproverRole | 'CONTRACT_OFFICER' | 'FINANCE' | 'AGENCY' | 'COREVIA' | 'AI_AGENT' | 'SYSTEM';
```
| 역할 | 화면 이름 | 근거 | 라벨 |
|---|---|---|---|
| `MARKETING_TEAM` | 마케팅팀(전결) | `approval_authority_policy` | ORIGINAL |
| `MASIL_CEO` | Masil 대표 (한지우) | 정책 · 회의록 "한지우 대표" | ORIGINAL |
| `GROUP_CEO_BOARD` | 그룹 CEO/이사회 (강세연 CEO) | 정책 "CEO/이사회" · `covenant_terms_ms` "그룹 CEO" · `Business_Process_Map` 1.1 | INTERPRETED (정책의 "CEO/이사회" = 그룹 CEO/이사회) |
| `SCM` | SCM | 정책 "재고 발주 승인 SCM" | ORIGINAL |

- **SCM 은 역할 하나로 두 가지 행동을 한다** (2026-11-14 정리, 프론트엔드 보고 "SCM 회신(모의)과 ActorRole SCM 이 구분 안 됨"):
  1. **보충 검토 회신** — `REPLENISHMENT_REVIEW` · `INFO_REQUEST` 작업에 대한 SCM 부서의 사실 회신(기발주 포함 여부 · 입고일 · 보충 필요 여부). 승인이 아니다. 이벤트 `COUNTERPARTY_REPLY`(보내는 쪽 SCM), 도메인 함수 `scmReview`.
  2. **보충 발주 승인 회신** — 보충요청 승인요청의 `requiredRole` 이 `SCM` 일 때만(평시 구간). 이벤트 `APPROVAL_REPLY`, R-AUTH-05 검증. covenant 구간이면 requiredRole 이 그룹 CEO/이사회라 SCM 은 회신할 수 없다(④-b).
  - 두 행동은 **행위자(역할)가 아니라 행동 종류(이벤트 유형 · 화면 버튼)** 로 구분한다. 시연 중 사람이 입력하는 회신은 승인이든 검토든 모두 `MOCK` 이므로 "SCM 회신(모의)" 이라는 별도 역할은 두지 않는다. 화면 역할 목록은 `SCM` 하나로 합친다(FE-01). `AGENCY` 는 외부 상대라 "에이전시(모의)" 로 유지.
| `CONTRACT_OFFICER` | 계약 담당 | BPMN W02 레인 — 주최 교육용 가정 | ASSUMPTION (A-22) |
| `FINANCE` | 재무팀 | 회의록 · 통보서 메모 작성자 | ORIGINAL(존재) |
| `AGENCY` | 혜인 소속 에이전시 | 통보서 발신자 | ORIGINAL(존재) · 회신은 MOCK |
| `COREVIA` | Corevia(공급사) | `m_sku_ms.source_company` | ORIGINAL(존재) · 회신은 MOCK |

#### 쓰기 행위별 허용 역할 (2026-11-14)

상태를 바꾸는 API 마다 **누가 그 행위를 할 수 있는가**와 **서버가 검사하는가**를 정한다. 원칙:
- 서버가 역할을 검사하는 쓰기는 **행위자가 누구인지가 권한 · 책임의 뜻을 갖는 쓰기**다 — 승인 회신(원본 정책, R-AUTH-05), 작업 처리(작업 담당, A-35), 보충요청 초안(SCM, A-35). `AI_AGENT` · `SYSTEM` 은 이 행위들의 행위자가 될 수 없다(3-1).
- 결정을 확정하지 않는 쓰기(사건 기록 · 판단안 · 상신)와 시연 운영 행위(시점 이동 · 리셋)는 역할을 검사하지 않는다(A-36). 이들은 승인 효력을 만들지 않고, 권한자 · 기한 · 공급 제약은 규칙 코드가 정하므로 누가 눌러도 결과가 같다. 그래서 검사하지 않아도 원본 제약이 사라지지 않는다(CLAUDE.md 규칙 7 · 10).
- 이력의 `actorRole` 은 화면 역할이 아니라 아래 「이력의 행위자」 값으로 남는다(지금 구현 그대로).

| 쓰기 행위 | API | 허용 역할 | 이력의 행위자 (`actorRole` / `actorKind`) | 서버 검사 | 근거 · 출처 태그 |
|---|---|---|---|---|---|
| **승인 회신** | `POST /api/approval-requests/:id/replies` (= 사건 `APPROVAL_REPLY`) | 요청의 `requiredRole` 이면서 대상 건의 **현재 권한자**(R-AUTH-06 상향 반영) | `respondentRole` / `MOCK` | **함 — 구현됨**. 아니면 422 `FORBIDDEN_ROLE`, 상태 불변 | `approval_authority_policy.md` 권한 표 · "Agent 는 경계를 넘는 결정을 자동 확정하지 않는다" [원본] · R-AUTH-05 |
| **작업 상태 변경** (시작 · 완료 · 취소) | `PATCH /api/tasks/:id` | 작업 **담당 역할(`ownerRole`)만**. 요청의 `actorRole` 필수 | 화면 역할(= `ownerRole`) / `HUMAN` | **함 — 구현됨**(BE-17, LOG-022: 도메인 함수 `domain/permissions.ts` `assertTaskActor` — 프리셋 재생 경로에도 적용, 상위 권한자라도 담당이 아니면 거부). `actorRole` 없음 → 422 `VALIDATION`, `ownerRole` 과 다름 → 422 `FORBIDDEN_ROLE`, 상태 불변 | 담당은 BPMN W02 레인(계약 담당: t1 접수 · t3 조건 확인 · t4 승인조건 문서화 · t5 통보 · t6 기록) [원본 — 레인 자체는 주최 교육용 가정 A-22]과 작업 생성 규칙(1-3 작업 기한 규칙)이 정한 값. 작업을 담당 외 역할이 처리해도 되는지는 원본에 없음 → **A-35** [가정] |
| └ SCM 보충 검토 작업 (`REPLENISHMENT_REVIEW` · SCM `INFO_REQUEST`) 의 완료 | `PATCH` 완료 **불가** — 아래 「외부 회신 입력」(SCM)으로만 닫힘 | — | — | **함 — 구현됨**(BE-18). 409 `INVALID_TRANSITION` "SCM 보충 검토 회신으로 닫습니다". 시작 · 취소(사유)는 SCM 이 `PATCH` 로 가능 | 3-4 · 3-5 (회신이 보충요청 전이를 일으킴) [가정 A-35] |
| **외부 회신 입력** | `POST /api/events` `COUNTERPARTY_REPLY` | 회신을 보낸 상대 = `from`(AGENCY · SCM · COREVIA). 시연에서는 시연자가 그 상대를 대신 입력한다 — 화면 역할 목록에 없는 COREVIA 포함. 화면 버튼은 S-03 통보 탭 · S-07 에이전시 회신은 에이전시(모의) 역할, S-07 · S-09 [보충 검토 회신]은 SCM 역할에서 보이고, S-02 「외부 회신」 양식은 역할과 무관 | `from` / `MOCK` | 하지 않음 — `from` 이 곧 행위자이고, 상태는 맞는 열린 작업 · 초안이 있을 때만 바뀐다(없으면 404). 상대가 하는 행동 종류는 상대별 효과 표로 제한(SCM · Corevia 수령확인 422) | 상대 존재: 통보서 발신자(에이전시) · `m_sku_ms.source_company`(Corevia) [원본] · 정책 "재고 발주 승인 SCM" [원본]. 회신 내용 [모의]. 검사 없음 **A-36** [가정] |
| **사건 입력** — 갱신 통보 접수 · 확대 기안 접수 · 회수 지연 통보 · 기안 조건 정정 | `POST /api/events` | 역할 무관(시연자) | 사건 유형별 고정: 통보 접수 `CONTRACT_OFFICER`(BPMN t1) · 기안 접수 `MARKETING_TEAM`(기안 주체) · 회수 지연 `FINANCE` · 기안 정정 `MARKETING_TEAM` / 통보 · 기안 접수 `HUMAN`(라벨 `ORIGINAL`), 회수 지연 · 정정 `MOCK` | 하지 않음 | 사건 입력은 밖에서 일어난 일을 시스템에 들여오는 입구이고 결정이 아니다. 행위자 고정값은 BPMN 레인 · 원본 문서 작성자 [원본근거해석], 검사 없음 **A-36** [가정] |
| **판단안 생성** | `POST /api/assessments` | 역할 무관. 화면은 내부 역할(마케팅팀 · Masil 대표 · 그룹 CEO/이사회 · SCM · 계약 담당)에서 버튼을 보이고 에이전시(모의)에서는 숨긴다(FE-14) | `AI_AGENT` / `AI`(실시간) 또는 `MOCK` | 하지 않음 — 판단안은 어떤 엔티티의 상태도 바꾸지 않는다(1-3 Assessment, 3-1) | ONTOLOGY 3-1 "AI 는 어떤 전이도 직접 일으키지 않는다" · **A-36** [가정] |
| **승인요청 상신** | `POST /api/approval-requests` | 업무상 상신자: 계약 = 계약 담당(BPMN t3 → 승인 분기), 기안 건 = 마케팅팀(기안 주체). 서버는 역할을 받지 않는다 | `SYSTEM` / `SYSTEM`(도구가 판단안에서 요청 생성) | 하지 않음 — 상신은 `PENDING_APPROVAL` 로 올릴 뿐 승인 효력이 없고, 권한자(`requiredRole`)는 규칙 엔진이 정한다(누가 상신해도 같은 권한자). 보충 판단안은 409(보충 상신은 SCM 회신으로만) | BPMN W02 [원본 — 주최 가정 레인] · 정책 권한 표 [원본] · 검사 없음 **A-36** [가정] |
| **보충요청 생성** (초안) | `POST /api/replenishment-requests` | **SCM 만**. 요청의 `actorRole` 필수 (화면 S-09 [보충 요청 만들기]도 SCM 역할에서만) | `SYSTEM` / `SYSTEM` (초안 생성 이력) | **함 — 구현됨**(BE-17, `assertReplenishmentDrafter`). `actorRole` 없음 → 422 `VALIDATION`, SCM 아님 → 422 `FORBIDDEN_ROLE`, 상태 불변 | 정책 "재고 발주 승인 SCM" [원본] → 발주 준비 주체를 SCM 으로 봄 [원본근거해석]. 초안은 현금 약정이 아니지만(A-30) SCM 작업 2건 · G-08 질문을 여는 SCM 절차의 시작점이라 담당 부서가 연다 **A-35** [가정]. 승인 권한자는 지급일로 규칙이 정한다(R-AUTH-04 · R-AUTH-03) |
| **시점 이동** | `POST /api/clock/advance` (= 사건 `CLOCK_ADVANCED`) · 미리보기 `GET /api/clock/preview` | 시연자(역할 무관) — **시연 운영 행위** | `SYSTEM` / `SYSTEM` (기한 감시 전이) | 하지 않음. 과거로는 409 `CLOCK_BACKWARD` | 가상 기준시각은 시연 장치(A-21) [가정]. 기한이 지나면 무엇이 되는지는 원본 정책(자동 확정 · 자동 갱신)이 정한다 [원본] |
| **시나리오 리셋** | `POST /api/scenarios/:id/reset` | 시연자(역할 무관) — **시연 운영 행위** | 이력을 비우고 프리셋 재생(재생 이력의 행위자는 각 단계 그대로) | 하지 않음. 원본 적재 테이블은 건드리지 않는다 | 시연 재현 장치 [가정 A-36]. 서버 상태가 하나라 모든 사용자에게 같은 상태가 보인다(DEMO 0-4 시연 운영 주의) |

- **배포 환경의 접근 통제(로그인 · 사용자별 권한)는 이번 범위가 아니다** [가정]. 위 검사는 "역할을 바꿔 누른 요청이 권한 · 담당 경계를 넘지 못한다"를 서버가 보장하는 것이고, 사람의 신원 확인은 하지 않는다(화면 역할 전환은 시연 장치). 제출 설명에 "역할 전환은 시연용, 신원 확인 미구현"으로 적는다.

## 2. 관계

| 관계 | 카디널리티 | 연결 키 | 라벨 |
|---|---|---|---|
| Influencer — Campaign | 1:N | `m_campaign_ms.influencer_id` | ORIGINAL |
| Influencer — ExclusiveContract | 1:0..1 (INF-001 만) | 통보서 | ORIGINAL |
| ExclusiveContract — ExpansionLine | 1:N ("하위 집행분") | `line.influencerId = contract.influencerId` | INTERPRETED (통보서 재무팀 메모 · 회의록 = CLAIM 문구이나 정책 "기안 부결해도 계약은 갱신될 수 있다 · 두 건 기한을 함께 확인" 이 근거) |
| ExpansionProposal — ExpansionLine | 1:25 | 파일 전체 | INTERPRETED |
| ExpansionLine — Campaign | N:1 | `campaign_id` | ORIGINAL (25행이 캠페인 25개에 1:1) |
| Campaign — Order | 1:N | `mkt_orders_ms.campaign_id` (NONE 없음) | ORIGINAL — last-click 7일 귀속이 이미 반영된 값으로 본다 (A-05, INTERPRETED) |
| Order — Return | 1:0..1 | `order_id` | ORIGINAL (주문당 반품 최대 1건, 집계 확인) |
| Order — CouponUse | 1:0..1 | `order_id` | ORIGINAL |
| Order — CostMaster | N:1 | `sku_id`×`channel_id` | ORIGINAL |
| Campaign — AdSpend | 1:N | `campaign_id` | ORIGINAL |
| Campaign — Sku (주력 SKU) | N:M | 주문 GMV 비중 ≥ 20% (A-16) | AGGREGATED + ASSUMPTION |
| Sku — InventorySnapshot / WeeklySales / PurchaseOrder | 1:1 / 1:N / 1:N | `sku_id` | ORIGINAL |
| Sku — Corevia 제품군 | N:1 | `m_sku_ms.product_id` (예: 더마 → PL-02) | ORIGINAL |
| ExpansionLine — CovenantWindow | N:M (시점 대조) | `settlementDate ∈ window` | AGGREGATED |
| ApprovalRequest — subject | 1:N | `subjectIds` | — |
| ApprovalRequest — ApprovalReply | 1:N (재회신 허용, 마지막이 유효) | `requestId` | MOCK |
| 모든 상태 변경 — AuditLog | 1:N | `entityId` | — |

## 3. 상태와 전이 (상태 머신)

전이는 **도메인 순수 함수** `transition(entity, event, ctx) → {next, sideEffects[]}` 로 구현하고, 허용되지 않은 전이는 예외로 막는다. "누가"는 전이를 일으킬 수 있는 `ActorRole`.

**오류 코드** (`domain/errors.ts` `DomainError` — 2단계 확정 7종 + 서버 오류. API 응답 `{error:{code, message, details?}}`). 오류가 나면 **아무 상태도 저장하지 않는다**(검증을 상태 변경 전에 끝냄).

| 코드 | HTTP | 언제 |
|---|---|---|
| `FORBIDDEN_ROLE` | 422 | 회신자가 `requiredRole`(또는 건의 현재 권한자)이 아님 — R-AUTH-05. **작업 처리(`PATCH /api/tasks/:id`)의 행위 역할이 작업 담당(`ownerRole`)이 아님 — A-35 (BE-17, 1-3 쓰기 행위별 허용 역할)** |
| `VALIDATION` | 422 | 입력 형식 · 조합 오류: 필수 필드 · 형식(날짜 · 정수 · enum), JSON 아님, 반려 사유 · 정보 요청 질문 없음, 회신 유형과 건별 결정 불일치(BE-08), SCM · Corevia 수령확인, SCM 정보 제공에 `replenishmentNeeded` 없음, 보충 대상 아닌 SKU, 작업 취소 사유 없음, 기준시각 이전 날짜의 사건 · 집행일, **작업 처리에 `actorRole` 없음(BE-17) · 기안 접수에 `lineIds`(BE-20)** |
| `INFO_MISSING` | 422 | 업무상 필요한 값 없음: 계약 승인 결정(`decision`), 조건부 승인 조건 문구, 기안 정정의 바꿀 값 |
| `INVALID_TRANSITION` | 409 | 전이표에 없는 전이, 이미 처리된 요청 · 작업, 원본 기한 지난 요청 회신, 기한 지난 통보 발송, 같은 건 보충 초안 중복, **SCM 보충 검토 작업을 `PATCH` 로 완료(BE-18 — SCM 보충 검토 회신으로만 닫힘)** |
| `CLOCK_BACKWARD` | 409 | 시점을 과거로 이동 |
| `CONFLICT` | 409 | 낙관적 잠금 — 읽은 뒤 상태 버전이 바뀜(판단안 생성 중 다른 처리) |
| `NOT_FOUND` | 404 | 없는 ID, 맞는 대기 요청 · 열린 작업 · 보충 초안 없음, 없는 프리셋 |
| `INTERNAL` | 500 | 그 밖의 서버 오류. 내부 메시지 · 비밀값은 응답에 넣지 않고 "서버 처리 중 오류가 발생했습니다" 만 |

### 3-1. ExclusiveContract (`ContractStatus`)

```
ACTIVE ──(RENEWAL_NOTICE_RECEIVED)──▶ UNDER_REVIEW
UNDER_REVIEW ──(판단안 확정 · 승인요청 생성)──▶ PENDING_APPROVAL
PENDING_APPROVAL ──(회신 APPROVED, decision=RENEW_SAME)──▶ RENEWED_APPROVED (종결)
PENDING_APPROVAL ──(회신 APPROVED, decision=RENEGOTIATE|TERMINATE)──▶ NOTICE_PENDING  [+Task SEND_NOTICE, DOCUMENT_CONDITIONS]
PENDING_APPROVAL ──(회신 REJECTED | INFO_REQUESTED)──▶ REVIEW_BEFORE_DEADLINE  [+Task REVIEW_BEFORE_DEADLINE, RESUBMIT(, INFO_REQUEST)]
REVIEW_BEFORE_DEADLINE ──(재상신: RESUBMIT 작업 완료)──▶ PENDING_APPROVAL (version+1, 권고 = 근거 판단안 — 1-3 ApprovalRequest)  [열린 Task REVIEW_BEFORE_DEADLINE 자동 종료 — 3-4, BE-23]
NOTICE_PENDING ──(SEND_NOTICE 완료)──▶ NOTICE_SENT  [+Task CONFIRM_RECEIPT]
NOTICE_SENT ──(NoticeReceipt 입력)──▶ NOTICE_ACKNOWLEDGED  → decision 별로 NEGOTIATING | TERMINATING
NOTICE_SENT ──(수령 미확인 + [발송 후 2영업일 경과 또는 기한 당일 09:00] 중 먼저)──▶ (상태 유지) [+Task RENOTIFY 1회]  ← 확장 E1
NOTICE_SENT ──(기한 경과, 수령 미확인)──▶ NOTICE_UNCONFIRMED [+Task ESCALATE_NOTICE_UNCONFIRMED × 2 (그룹 CEO/이사회 · 계약 담당)]  ← 확장 E1
{ACTIVE, UNDER_REVIEW, PENDING_APPROVAL, REVIEW_BEFORE_DEADLINE, NOTICE_PENDING}
      ──(기한 경과: simNow > noticeDeadline 23:59)──▶ AUTO_RENEWED  [+Task INCIDENT_AUTO_RENEWAL]
```

| 상태 | 뜻 | 누가 바꾸나 | 조건 | 라벨 |
|---|---|---|---|---|
| `ACTIVE` | 현 계약 유효, 갱신 검토 전 | — | 시드 | ORIGINAL(계약 존재) |
| `UNDER_REVIEW` | 통보 접수, 성과 · 비용 취합 중 (BPMN t1~t3) | `CONTRACT_OFFICER` (사건 입력) | 통보 접수 이벤트 | ASSUMPTION(절차) |
| `PENDING_APPROVAL` | 권한자에게 상신됨 | `SYSTEM`(도구) | 판단안 존재 + 권한자 결정됨 | ASSUMPTION |
| `REVIEW_BEFORE_DEADLINE` | 반려 · 정보요청 → **기한 전 재검토** (미갱신 확정 아님) | `SYSTEM` (회신 처리) | 회신 REJECTED/INFO_REQUESTED | ORIGINAL (BPMN 교육용 가정 문구 "'아니오' 종료는 재검토 상태") |
| `RENEWED_APPROVED` | 권한자 승인을 거친 동일 조건 갱신 | `SYSTEM` | 회신 APPROVED + RENEW_SAME | — |
| `NOTICE_PENDING` | 해지 · 조건변경 승인됨, 통보 전 | `SYSTEM` | 회신 APPROVED | — |
| `NOTICE_SENT` | 통보 발송 기록 (수령 미확인) | `CONTRACT_OFFICER` | SEND_NOTICE 완료, `sentAt ≤ noticeDeadline` | MOCK |
| `NOTICE_ACKNOWLEDGED` | 상대방 수령 확인 | `AGENCY`(모의 회신) | NoticeReceipt | MOCK (확장 E1) |
| `NEGOTIATING` / `TERMINATING` | 조건변경 협상중 / 만료(8/31) 후 종료 예정 | `SYSTEM` | 수령확인 후 | 설계 단계(협상 결과는 범위 밖) |
| `NOTICE_UNCONFIRMED` | 기한까지 수령 미확인 → 통보 효력 미확인 | `SYSTEM`(기한 감시) | A-14 | ASSUMPTION (확장 E1) |
| `AUTO_RENEWED` | 미통보 자동 갱신 = **권한 미경유 체결** | `SYSTEM`(기한 감시) | 기한 경과 + 유효 통보 없음 + 승인 갱신 아님 | ORIGINAL (통보서 · 정책 "미통보 자동 갱신도 체결로 본다") |

- **AI 는 어떤 전이도 직접 일으키지 않는다.** AI 출력은 `Assessment` 로만 저장되고, 상태 전이는 도구(코드)가 이벤트를 받아 수행한다.
- `AUTO_RENEWED` 후 해지는 위약금 R-PEN-01 이 붙는 **새 결정**(GROUP_CEO_BOARD)으로만 다룬다.

### 3-2. ExpansionLine (`LineStatus`)

```
RECEIVED ──(확인 도구 실행)──▶ VALIDATED | INFO_MISSING
VALIDATED ──(승인요청 생성)──▶ PENDING_APPROVAL
PENDING_APPROVAL ──(회신 item=APPROVE)──▶ APPROVED
PENDING_APPROVAL ──(회신 item=CONDITIONAL)──▶ CONDITIONALLY_APPROVED [+Task RESCHEDULE_CAMPAIGN 등]
PENDING_APPROVAL ──(회신 item=REJECT)──▶ REJECTED
PENDING_APPROVAL ──(회신 item=HOLD | INFO_REQUESTED)──▶ ON_HOLD [+Task REVIEW_BEFORE_DEADLINE]
ON_HOLD ──(재상신)──▶ PENDING_APPROVAL
{APPROVED, CONDITIONALLY_APPROVED} ──(조건 변경으로 requiredRole 상향, 기한 전)──▶ REAPPROVAL_REQUIRED [+새 승인요청(supersedes 이전 요청), 이전 요청은 회신 상태 유지]
REAPPROVAL_REQUIRED ──(새 승인요청 생성, 같은 이벤트 안에서)──▶ PENDING_APPROVAL
PENDING_APPROVAL ──(조건 변경으로 requiredRole 상향, R-AUTH-06 RESUBMIT_PENDING)──▶ PENDING_APPROVAL (상태 유지, 걸린 요청만 교체)
      [이전 요청 PENDING → SUPERSEDED, 새 권한자에게 새 요청(version+1), approvalRequestId 교체]
기한 경과 시(simNow > contractDeadline 23:59):
  APPROVED | CONDITIONALLY_APPROVED ──▶ CONFIRMED
  REJECTED ──▶ CANCELLED
  그 외 미결(RECEIVED…REAPPROVAL_REQUIRED) ──▶ AUTO_CONFIRMED [+Task POST_DEADLINE_REPORT]
```

| 상태 | 누가 | 조건 · 비고 | 라벨 |
|---|---|---|---|
| `VALIDATED` | `SYSTEM` | 권한 · 기한 · 성과 · 재고 · covenant 계산 완료 | — |
| `INFO_MISSING` | `SYSTEM` | 필수 입력 누락(예: 조건 변경 입력에 집행일 없음) | — |
| `APPROVED` 등 | `SYSTEM` (회신 처리) | 회신자의 역할 = `routing.requiredRole` 일 때만 | MOCK 회신 |
| `REAPPROVAL_REQUIRED` | `SYSTEM` | 이미 승인된 건의 권한자가 재전망 등으로 **상향**됨 · 기한 전 | ASSUMPTION (규칙은 ORIGINAL 우선 규정) |
| `AUTO_CONFIRMED` | `SYSTEM`(기한 감시) | **묵시적 승인과 같은 효과, 철회 불가** | ORIGINAL (정책) |
| `CONFIRMED` / `CANCELLED` | `SYSTEM` | 기한 도래 확정 | — |

- 기한이 이미 지난 건에 권한 상향이 생기면 `REAPPROVAL_REQUIRED` 로 가지 않고 `POST_DEADLINE_REPORT` 작업만 만든다(되돌릴 수 없음 — `covenant_terms_ms` "기한을 넘겨 자동 확정되면 사후에 되돌릴 수 없다").
- `REAPPROVAL_REQUIRED` 는 **같은 이벤트 처리 안에서** 새 승인요청이 생기며 곧바로 `PENDING_APPROVAL` 로 넘어간다. 그래서 조건 변경 이벤트 직후 건의 **최종 상태는 `PENDING_APPROVAL`** 이고, `REAPPROVAL_REQUIRED` 는 이력(`APPROVED → REAPPROVAL_REQUIRED → PENDING_APPROVAL`)에 남는다. 화면은 이 이력과 새 요청의 `supersedesId` 로 "재승인 필요 → 재상신됨"을 보여준다(AC-2-03).
- **이력 연속성**: 한 건의 이력 행은 `fromStatus` 가 직전 행의 `toStatus` 와 같아야 한다. 상태가 바뀌지 않는 처리(권한 재판정 · `RESUBMIT_PENDING` 재상신)는 `fromStatus = toStatus` 인 행으로 남기고, 전이표에 없는 중간 상태를 거치지 않는다(BE-02).

### 3-3. ApprovalRequest (`ApprovalStatus`)
`PENDING` → `APPROVED` | `APPROVED_WITH_CONDITIONS` | `REJECTED` | `INFO_REQUESTED` | `SUPERSEDED`(재상신 · 권한 재판정) | `EXPIRED`(hardDeadline 경과 시 미회신). 회신은 `requiredRole` 만 가능.
- 요청 상태 = 회신의 `outcome` (혼합 승인 · 부결 회신은 `APPROVED`, 1-3 ApprovalReply).
- `SUPERSEDED` 는 `PENDING` 요청에만 적용한다. 이미 회신된 요청은 대체돼도 상태를 바꾸지 않는다(1-3 ApprovalRequest).
- `PENDING` 이 아닌 요청 · 원본 기한이 지난 요청에 회신하면 409 `INVALID_TRANSITION`.

### 3-4. Task (`TaskStatus`)
`OPEN` → `IN_PROGRESS` → `DONE` | `CANCELLED`. `simNow > dueAt` 이고 미완료면 `OVERDUE`(기한 감시가 표시만 바꿈). 작업 완료가 다른 엔티티 전이를 일으키는 경우: `SEND_NOTICE` → 계약 `NOTICE_SENT`, `RESUBMIT` → 새 승인요청, `RESCHEDULE_CAMPAIGN` → 건 집행일 변경(→ 권한 재판정 R-AUTH-06). SCM 의 `REPLENISHMENT_REVIEW` · `INFO_REQUEST` 는 작업 완료(`PATCH`)가 아니라 **SCM 보충 검토 회신**(`COUNTERPARTY_REPLY`, 1-3 Event 상대별 효과)으로 닫히고 보충요청 전이(`DRAFT → SUBMITTED | REJECTED`)도 그 회신이 일으킨다 — 첫 판의 "`REPLENISHMENT_REVIEW` 완료 → 보충요청 `SUBMITTED`" 는 구현과 달라 고쳤다(2026-11-14): 보충 검토 작업은 **회신으로만 닫히고**, `PATCH` 로 완료하면 **409 `INVALID_TRANSITION`** 이다(BE-18 **구현됨** — `domain/workflow.ts` `completeTask`, LOG-022. 회신 효과 없이 작업만 닫히면 G-08 · 초안이 방치되기 때문). SCM 의 시작 · 취소(사유)는 `PATCH` 로 가능하다. 작업을 누가 처리할 수 있는지는 [1-3 쓰기 행위별 허용 역할](#쓰기-행위별-허용-역할-2026-11-14).

**다른 처리의 결과로 닫히는 작업** (사람의 `PATCH` 없이 — 2026-11-14 정리). 담당 역할 검사(A-35)는 사람이 `PATCH` 로 처리하는 경우의 규칙이고, 아래는 규칙 코드가 사건의 결과로 닫는 경우다. 모두 이력 1행을 남긴다.

| 작업 | 닫는 사건 | 결과 상태 · 이력 행위자 | 상태 |
|---|---|---|---|
| `CONFIRM_RECEIPT` · `RENOTIFY` | 에이전시 수령확인 회신 | `DONE` · `AGENCY` / `MOCK` | 구현됨 |
| 계약 `INFO_REQUEST` | 에이전시 정보 제공 · 정보 부족 · 거절 회신 | `DONE` + 결과 메모 · `AGENCY` / `MOCK` | 구현됨 |
| SCM `REPLENISHMENT_REVIEW` · `INFO_REQUEST` | SCM · Corevia 회신(1-3 Event 상대별 효과) | `DONE` · 회신자 / `MOCK` | 구현됨 |
| 계약 **`REVIEW_BEFORE_DEADLINE`** | 같은 계약의 **`RESUBMIT` 완료**(새 승인요청 생성) | **`CANCELLED`** · `SYSTEM` / `SYSTEM`, 사유 "재상신 완료로 종료 — 재검토 결과는 재상신 요청 {ID} · 근거 판단안 {ID}" | **구현됨** (BE-23, LOG-030 — 결정 10-1 ⓒ). 이미 `DONE` 인 재검토 작업은 그대로 둔다 |

- `REVIEW_BEFORE_DEADLINE` 을 `DONE` 이 아니라 `CANCELLED` 로 닫는 이유: 사람이 재검토 완료를 기록한 것이 아니라 재상신으로 더 할 일이 없어진 것이다(이력을 사실대로). 계약 담당이 재상신 전에 직접 완료했다면 그 `DONE` 을 그대로 둔다. 재상신이 다시 반려되면 새 재검토 · 재상신 작업이 생긴다(3-1, 지금 동작 유지).
- **자동으로 닫지 않는 작업**: `DOCUMENT_CONDITIONS`(승인조건 문서화, BPMN t4)는 사람이 실제로 해야 하는 일이라 통보 발송 · 수령확인이 끝나도 닫지 않는다 — 완료하지 않으면 기한(통보 기한 D-1) 뒤 `OVERDUE` 로 보이는 것이 맞다. `REPORT_TO_GROUP` 도 같다. 시연 절차에 완료 단계를 둔다(DEMO S1-6 · S3-3). 자동 갱신(③-B) 뒤 남은 재검토 · 재상신 작업도 닫지 않는다(하지 않은 일이다).

### 3-5. ReplenishmentRequest
```
DRAFT ──(SCM 검토 회신 '보충 필요')──▶ SUBMITTED [+승인요청 → requiredRole]
DRAFT ──(SCM 검토 회신 '보충 불필요')──▶ REJECTED  (사유 '불필요', 승인 절차 없음 — A-30)
DRAFT ──(SCM 검토 회신 '거절 = 보충 불가')──▶ REJECTED  (사유 '보충 불가', 승인 절차 없음 — A-34)
DRAFT ──(SCM 검토 회신 '정보 부족')──▶ DRAFT  (그대로, SCM 정보 요청 작업만 닫힘)
SUBMITTED ──(권한자 회신)──▶ APPROVED | REJECTED | INFO_REQUESTED
SUBMITTED ──(재전망으로 권한자 상향, BE-09)──▶ SUBMITTED  (걸린 대기 승인요청 SUPERSEDED → 새 권한자에게 재상신 version+1)
INFO_REQUESTED ──(재제출)──▶ SUBMITTED
```
- 회신자 = `requiredRole`(SCM, covenant 구간 지급이면 GROUP_CEO_BOARD).
- `DRAFT → REJECTED` 는 **승인 거절이 아니라 SCM 검토 결과의 종결**이다. 초안은 아직 현금 약정이 아니므로 권한자 승인 없이 닫을 수 있다(A-30 · A-34). 이력 `actorRole = SCM`, `actorKind = MOCK`, 사유 "불필요: …" 또는 "보충 불가: …". 화면은 세 가지를 다르게 표시한다(FE-04): "SCM 검토: 불필요로 종결 (승인 거절 아님)" · "SCM 검토: 보충 불가로 종결 (승인 거절 아님)" · 권한자 거절(`SUBMITTED → REJECTED`) "승인 거절". 구분 기준은 이력의 이전 상태(`DRAFT`/`SUBMITTED`)와 사유 접두어("불필요:" / "보충 불가:") — 백엔드가 화면용 문구 필드를 주면 그것을 쓴다(BE-13).
- 보충요청 결과는 연결된 기안 건의 `supplyOutlook` 을 바꿔 다음 권고에 반영된다(4-4 R-INV-03): SCM '불필요'(입고 예정 확인) → `INBOUND_CONFIRMED` + `inboundExpectedDate` / **SCM '보충 불가'(A-34) → `NO_SUPPLY`** / 권한자 거절 → `NO_SUPPLY` / 권한자 승인 → 바꾸지 않음(`UNKNOWN` 유지 — 새 발주도 리드타임 때문에 집행일 전 도착 불가이므로 권고는 조건부 그대로). 공급 전망이 바뀌면 연결 건 이력에 상태 유지 1행(사유 "공급 전망 … (다음 권고에 반영)")이 남는다.
- **보충요청 권한 재판정 (BE-09, 2단계 구현)**: 회수 지연 등으로 재전망이 바뀌면(`AR_COLLECTION_DELAYED`) 보충요청도 다시 판정한다. `DRAFT` 는 `requiredRole` 표시만 갱신(이력 1행). `SUBMITTED` 로 대기 중인 승인요청은 새 권한자가 **상향**이면 `SUPERSEDED` 로 닫고 같은 대상으로 새 요청(version + 1, `supersedesId`)을 만든다. 하향이면 기존 상위 권한자 요청을 유지한다(R-AUTH-06 과 같은 원칙).

### 3-6. 기한 감시 (deadline watchdog)
`advanceClock(to)` 가 호출될 때(그리고 모든 이벤트 처리 전) 순서대로 실행한다: ① Task OVERDUE 표시 ② 수령확인 재통보(E1) ③ 기안 건 기한 처리(3-2) ④ 계약 기한 처리(3-1) ⑤ 승인요청 EXPIRED ⑥ 각 전이를 AuditLog 에 `actorKind='SYSTEM'` 으로 기록. 시점을 되돌리는 이동은 허용하지 않고 「시나리오 초기화」로만 처음으로 돌아간다.

## 4. 규칙 (규칙 ID 는 테스트 이름에 그대로 쓴다)

### 4-1. 승인 권한 — `approval_authority_policy.md` [ORIGINAL]

| ID | 규칙 | 함수 제안 | 라벨 |
|---|---|---|---|
| R-AUTH-01 | 확대 기안 건: `requestedKrw ≤ 10,000,000` 이고 기안 총액 `≤ 100,000,000` → `MARKETING_TEAM` 전결. 건별 `> 10,000,000` **또는** 기안 총액 `> 100,000,000` → `MASIL_CEO` + 그룹 보고(`alsoReportTo=['GROUP_CEO_BOARD']`, Task `REPORT_TO_GROUP`). 기안 총액 = 25건 현재 요청액 합(부결 · 취소 건 포함). **기안 금액 정정(`LINE_TERMS_CHANGED` 의 `requestedKrw`)이 들어오면 총액을 다시 계산하고 25건 전부 재판정**한다(A-31). 부결은 총액을 줄이지 않는다(R-CP-06) | `routeExpansionLine(line, proposalTotal, windows)` | ORIGINAL 규칙 · 기안 총액 = 실제 요청액 INTERPRETED · 정정 시 재계산 ASSUMPTION A-31 |
| R-AUTH-02 | 전속계약 체결 · 갱신: 연 금액 `> 1,000,000,000` → `GROUP_CEO_BOARD`, 이하 → `MASIL_CEO`. 연 금액 = 고정 피(28억) + 성과 피(미확인 → 0 이 아니라 "하한 28억"으로 표시). **미통보 자동 갱신도 체결** | `routeContract(contract)` | ORIGINAL |
| R-AUTH-03 | covenant 우선: `settlementDate`(또는 신규 약정의 현금 유출일)가 하회 예상 구간 안이면 금액 · 종류 불문 `GROUP_CEO_BOARD`. R-AUTH-01/04 보다 **우선** | `applyCovenantPriority(routing, cashOutDate, windows)` | ORIGINAL |
| R-AUTH-04 | 재고 발주: 평시 `SCM`, 지급일이 하회 구간이면 `GROUP_CEO_BOARD` | `routeReplenishment(req, windows)` | ORIGINAL |
| R-AUTH-05 | 권한 경계를 넘는 결정은 자동 확정하지 않는다: 상태를 `APPROVED` 류로 바꾸는 유일한 경로는 `requiredRole` 의 회신. AI · 시스템 · 하위 권한자는 불가 | `assertCanReply(role, request)` | ORIGINAL |
| R-AUTH-06 | 권한 재판정: 조건 변경(재전망 · 기안 정정)마다 모든 건(확정 건 포함)의 라우팅을 다시 계산한다. 권한자가 **상향**되고 이미 하위 권한자의 승인이 있으면(기한 전) `REAPPROVAL_REQUIRED` + 새 요청, 기한 후면 `POST_DEADLINE_REPORT`. **상향**됐는데 그 건이 아직 **승인 대기(`PENDING_APPROVAL`)** 면 `RESUBMIT_PENDING`(아래). **하향**이면 기존 상위 권한자 승인을 유지(재상신 없음). 권한 서열: MARKETING_TEAM < MASIL_CEO < GROUP_CEO_BOARD (SCM 은 발주 전용) | `rerouteAll(lines, next, simNow)` (계획) + workflow 적용 | ASSUMPTION (서열은 정책 표 구조에서 INTERPRETED) |

- 경계값: "1천만원 이하"는 전결 → `10,000,000` 은 마케팅팀, `10,000,001` 부터 Masil 대표. "1억원 초과" → `100,000,000` 은 해당 없음. "10억원 초과" → `1,000,000,000` 은 Masil 대표.
- 현재 데이터 결과: 기안 총액 180,803,272 > 1억 → 25건 모두 최소 `MASIL_CEO` [AGGREGATED]. 건별 1천만 초과 5건(PLAN-001~005).
- 계약에 covenant 대조(R-AUTH-03)는 **고정 피 지급 일정이 없어 판정 불가**(G-09) → `unknowns` 로 표시. 계약은 이미 최상위 권한이라 권한자는 바뀌지 않는다.

#### R-AUTH-06 처리 방식 (`RoutingAction`) — 2026-11-14 확정 (1단계 구현 반영)
재판정은 **계획(순수 함수 `rerouteAll`이 건별 처리 방식 결정)** 과 **적용(workflow 가 상태 · 요청 · 작업 변경)** 으로 나눈다.

| 처리 방식 | 조건 (권한자 변경 `from → to`) | 적용 결과 |
|---|---|---|
| `ROUTING_UPDATED` | 권한자 그대로, 또는 미상신 건(`VALIDATED` 등)의 변경, 또는 상향이지만 기존 승인자가 이미 새 권한자 이상, 또는 하향인데 기존 승인이 없음 | 라우팅 · 플래그만 갱신. 바뀐 경우 화면 "권한자 변경" 배지(②의 PLAN-024) |
| `REAPPROVAL_REQUIRED` | 상향 · 건이 `APPROVED`/`CONDITIONALLY_APPROVED` · 승인자 서열 < 새 권한자 · 기한 전 | 건 `→ REAPPROVAL_REQUIRED → PENDING_APPROVAL`, `approvedByRole = null`, 새 요청(그 건만, `supersedesId` = 이전 요청, version = 이전 + 1). 이전 요청은 회신 상태 유지(②의 PLAN-004) |
| `POST_DEADLINE_REPORT` | 상향 · 하위 승인 또는 자동 확정 건 · 기한 후(`APPROVED` 류 기한 후, `CONFIRMED` · `AUTO_CONFIRMED`) | 상태 불변, 작업 `POST_DEADLINE_REPORT`(새 권한자, 기한 A-28) (②-변형) |
| **`RESUBMIT_PENDING`** | 상향 · 건이 **`PENDING_APPROVAL`**(아직 회신 전) | 그 건이 걸린 이전 요청이 `PENDING` 이면 `SUPERSEDED` 로 닫고, **그 요청에 들어 있던 대기 건 전부**를 A-11 로 다시 묶어 새 요청(들)로 재상신(version = 이전 + 1, `supersedesId` = 이전 요청, 권고안 유지). 건 상태는 `PENDING_APPROVAL` 유지, `approvalRequestId` 만 새 요청으로 바뀐다. 상향되지 않은 같은 요청의 건도 함께 재상신되는 이유: 요청 하나를 일부만 유효하게 남기면 권한자가 무엇에 회신하는지 흐려지기 때문 [가정] |
| `KEEP_HIGHER_APPROVAL` | 하향 · 이미 새 권한자 이상 서열의 승인이 있음 | 승인 유지, 재상신 없음(② S2-4 집행일 8/31 조정 뒤 PLAN-004) |

- `RESUBMIT_PENDING` 은 문서에 없던 경우(대기 중인 건의 권한 상향)를 백엔드가 정했고 기획이 채택했다(devlog DD-014). 근거: R-AUTH-05 — 대기 중 요청의 `requiredRole` 이 하위 권한자로 남아 있으면 하위 권한자의 회신으로 상위 권한 건이 확정될 수 있다. 1단계 구현은 이를 두 겹으로 막는다: ① 요청 교체(`SUPERSEDED`) ② 회신 시 건별 현재 권한자 서열 확인(남은 옛 요청에 하위 권한자가 회신해도 422).
- 서열 비교에서 `SCM` 은 보충요청 전용이라 기안 건 비교에 나오지 않는다. 코드는 비교 편의상 `MASIL_CEO` 와 같은 단계로 둔다 — 보충요청의 `SCM → GROUP_CEO_BOARD` 는 상향이다.
- 보충요청의 권한 재판정(재전망 뒤 지급일이 새 하회 구간에 들어가는 경우)은 **2단계에서 구현됐다(BE-09)** — 3-5 의 마지막 항목. `DRAFT` 는 권한자 표시만 갱신하고, `SUBMITTED` 의 대기 승인요청은 상향이면 `SUPERSEDED` + 새 권한자에게 재상신(version + 1), 하향이면 유지. 시연 ②→④ 순서에서는 보충요청이 ② 이후에 만들어지므로 시연 화면에는 나오지 않는다(테스트로만 확인 — 시연 필수 아님).

### 4-2. 기한

| ID | 규칙 | 라벨 |
|---|---|---|
| R-DL-01 | 기안 건 `contractDeadline` 경과 시 미결 건은 `AUTO_CONFIRMED`(철회 불가 · 묵시적 승인) | ORIGINAL |
| R-DL-02 | 계약 `noticeDeadline`(2026-07-17) 경과 시 유효 통보 없으면 `AUTO_RENEWED` (= 체결) | ORIGINAL |
| R-DL-03 | 경고 단계: 남은 달력일 `> 7` 정보 · `≤ 7` 경고 · `≤ 3` 위험 · 경과 후 상태 전이 | ASSUMPTION A-25 |
| R-DL-04 | 내부 처리 기한: 계약 승인 회신 D-2(7/15) · 통보 발송 D-1(7/16) · 수령확인 D-0(7/17). 기안 승인 회신 D-1 | ASSUMPTION A-12 |
| R-DL-05 | `settlementDate < contractDeadline` 이면 플래그 `SETTLEMENT_BEFORE_DEADLINE` — 결정 필요 시점 = `min(settlementDate, contractDeadline)` 로 표시(기한 전이 자체는 `contractDeadline` 기준 유지) | ASSUMPTION A-26 (G-11) |
| R-DL-06 | 기한 시각 = 해당일 23:59:59 KST. 영업일은 월~금, 공휴일 없음 | 영업일 ORIGINAL(`data_dictionary` 2항) · 시각 ASSUMPTION A-13 |

### 4-3. 실질 공헌이익 — 공식값 = `A05` 5절 단일 차감 (2026-11-13 사용자 결정)

**공식값은 A05(v1.5) 5절 방식**이다: Net Revenue(GMV − 반품환불)에서 원가 · 마케팅비 · 채널수수료 · 출고/반품 물류비를 **각 한 번씩** 빼고, 쿠폰과 환불은 다시 빼지 않는다. 근거: A05 1절(이번 지침이 원본 폴더의 이전 안내에 우선) · A01 4절("데이터의 적용 범위, 알려진 한계, 구판 문서와의 충돌은 A05 데이터 이용 기준을 따릅니다") · A01 8절("데이터 해석과 원본 별첨의 충돌은 A05 데이터 이용 기준을 따른다"). `calculation_definitions.md` 1.4 를 문자 그대로 적용한 값(쿠폰 · 환불 이중 차감)은 **비교용 참고값**으로만 계산 · 표시하고 판단 · 권고 · 순위에는 쓰지 않는다.

```
GMV            = Σ mkt_orders_ms.gmv_krw            (쿠폰 반영 후, VAT 제외)
CouponDiscount = Σ mkt_orders_ms.coupon_discount_krw
ReturnRefund   = Σ mkt_returns_ms.refund_amount_krw  (주문 집단 기준, 2026-06-30 까지 확인된 환불)
NetRevenue     = GMV − ReturnRefund
COGS           = Σ cost_master.product_cost_krw          × 1EA/주문 (A-01)
ChannelFee     = round(Σ gmv × channel_fee_pct / 100)    (A-02: 주문별 소수 유지, 마지막에 1회 반올림 half-up)
Fulfillment    = Σ cost_master.shipping_cost_krw         × 1회/주문 (A-01)
ReturnLogistics= Σ cost_master.return_logistics_cost_krw × 1회/반품주문 (A-03)
MarketingSpend = Σ mkt_ad_spend_ms.ad_cost_krw (인플루언서+퍼포먼스+오프라인 전액)
                 (influencer_fee_krw 는 media='인플루언서' 행의 ad_cost_krw 와 75행 모두 같고, 다른 행은 NONE → 별도 가산 안 함, 집계 확인)

R-CP-01 cp (공식값) = NetRevenue − COGS − MarketingSpend − ChannelFee − Fulfillment − ReturnLogistics
        (A05 5절 "동일 주문에 대해 쿠폰과 환불을 다시 차감하지 않습니다" — 각 비용 1회 차감)
R-CP-02 cpRefDef14 (참고값) = NetRevenue − COGS − CouponDiscount − MarketingSpend − ChannelFee − Fulfillment − ReturnRefund − ReturnLogistics
        (calculation_definitions 1.4 문자 그대로 — 쿠폰 · 반품환불 이중 차감. 비교용, 판단에 쓰지 않음)
R-CP-03 nominalRoas = GMV / MarketingSpend ;  realRoas = cp / MarketingSpend (공식) ;  realRoasRefDef14 = cpRefDef14 / MarketingSpend (참고)
        (분모 0 → null "계산 불가")
R-CP-04 adSpendShare_i = Spend_i / ΣSpend ; requestShare_i = Request_i / ΣRequest ; 순위는 내림차순, 동점은 ID 오름차순
R-CP-06 배분 점검(다음 판단 반영): 남은 기안 = 상태가 CANCELLED/REJECTED 가 아닌 건. requestShareRemaining_i = Σ남은 요청_i / Σ남은 요청.
        단, 권한 판정용 '기안 총액'(R-AUTH-01)은 부결과 무관하게 180,803,272 고정 (INTERPRETED: 기안 금액 자체는 바뀌지 않음)
R-CP-05 권고 등급(건 단위, 확대 대상 캠페인의 공식 cp 부호만으로 정함):
        cp ≤ 0 → CP_NEGATIVE (부결 권고)
        cp > 0 → CP_POSITIVE (승인 가능 — 재고 게이트 R-INV-03 · 계약 연결 R-CON-01 등 다른 규칙이 우선할 수 있음)
        참고 플래그: sign(cpRefDef14) ≠ sign(cp) → CP_REF_SIGN_DIFFERS (화면 참고 표시만, 등급 · 권고 불변)
        (cp 순위 · 실질 ROAS 순위도 공식값 기준)
```

- 화면 표시: 공식값(A05)을 주 값으로, 1.4 참고값은 「참고: 1.4 문자 그대로(이중 차감)」 접힘 영역 또는 보조 열로만 표시한다. 참고값과 공식값의 부호가 다른 경우(인플루언서 INF-003 · INF-007, 기안 건 PLAN-006 · 008 · 010 · 011 · 012)는 `CP_REF_SIGN_DIFFERS` 참고 칩만 단다.
- 비용 가정 A-01~A-04 는 A05 5절이 "명시하라"고 요구한 항목이다. 가정이 바뀌면 값이 바뀌므로 테스트 골든 값은 이 가정에 묶인다.
- **표본 결론의 범위**: 비중 · 순위 · 부호(방향) · ROAS 까지. cp 금액을 28억 · 연간 계획치(65억 등)와 더하거나 곱하지 않는다(R-SCALE-01).

### 4-4. 재고 커버 — `calculation_definitions.md` 1.3 [ORIGINAL 산식]

| ID | 규칙 | 라벨 |
|---|---|---|
| R-INV-01 | `avg4w = 최근 4주(2026-06-08 · 06-15 · 06-22 · 06-29) sold_qty 평균`, `coverWeeks = onHandQty / avg4w` (`in_transit` 미합산, `reserved_qty` 없음) | ORIGINAL 산식 · AGGREGATED 값 |
| R-INV-02 | 예상 품절일(캠페인 증분 없이) `= snapshotDate + coverWeeks×7일`. `inTransit` 포함 버전은 **입고일 미상**이라 "최선 가정(즉시 입고)" 참고값으로만 표시 | AGGREGATED + ASSUMPTION A-20 |
| R-INV-03 | 재고 게이트: 확대 건의 주력 SKU(A-16) 중 하나라도 `coverWeeks < safetyStockWeeksMin` → `INVENTORY_BELOW_MIN`. `INVENTORY_BELOW_MIN` 인 SKU 에 대해 예상 품절일(R-INV-02, in_transit 제외) `< settlementDate` **이고** 지금 새로 발주해도 도착(`simNow + leadTimeWeeks×7`)이 `> settlementDate` 면 `STOCKOUT_BEFORE_SETTLEMENT` → 권고는 `CONDITIONAL`(집행일 조정) 또는 `REJECT` 만 허용, `APPROVE` 불가. (안전재고 이상인 SKU 는 in_transit 입고일 미상이라 품절 플래그를 붙이지 않는다 — 과잉 경고 방지). 게이트에 걸린 건의 권고는 공급 전망(`supplyOutlook`)으로 정한다: `NO_SUPPLY`(보충 거절) → `REJECT`, 그 외 → `CONDITIONAL`(조건 "집행일을 {입고 예정일 또는 기발주 입고} 이후로 조정") | ASSUMPTION (게이트 정책) · 산식 ORIGINAL |
| R-INV-04 | 보충 제안 수량: `targetQty = safetyStockWeeksMax × avg4w`(A-17), `suggested = max(targetQty − onHand − inTransit, 0)`, `finalQty = suggested>0 ? ceil(suggested/moq)×moq : 0`(A-18). **적용 범위: 기안 건에서 만드는 보충 제안은 그 건 주력 SKU 중 `coverWeeks < safetyStockWeeksMin` 인 SKU 만**이다. min 이상 SKU 는 식으로 `suggested > 0` 이 나와도 제안하지 않는다(예 SKU-1003: cover 4.286주 ≥ 4, 식으로는 22,693.5 − 16,210 − 598 = 5,885.5 > 0 이지만 제안 없음 — AC-4-04). 이유: 보충 제안은 재고 게이트(R-INV-03)가 문제 삼은 SKU 에 대한 후속 처리이고, 게이트를 통과한 SKU 까지 발주를 제안하면 covenant 구간에 불필요한 현금 약정을 늘린다 | 산식 ORIGINAL(1.3) · Target · MOQ 처리 ASSUMPTION · 적용 범위 ASSUMPTION(게이트 정책과 같음) |

- 캠페인 증분 수요는 **표본 주문으로 풀스케일 판매량에 더하지 않는다**(R-SCALE-01). 게이트는 "캠페인 없이도 부족한가"로만 판단하고, 캠페인은 방향(+)으로만 표시한다.
- **게이트 플래그는 시점과 무관하게 조건이 맞으면 붙는다** (2026-11-14 확인). PLAN-011 은 7/1 접수 · 확인 시점에도 조건을 만족한다: SKU-1001 · 1002 예상 품절 7/20 · 1004 7/15 < 집행일 8/31, 지금 발주 시 도착 = 7/1 + 12주 = **9/23** > 8/31. 그래서 `INVENTORY_BELOW_MIN` · `STOCKOUT_BEFORE_SETTLEMENT` 는 7/1 시드(기안 접수) 때부터 PLAN-011 에 있다. 7/20 에 다시 확인하면 도착 예상만 10/12 로 늦어지고 결론은 같다. "지금 발주 시 도착"은 `simNow` 에 따라 바뀌는 값이므로 화면 · 판단안은 고정 날짜를 쓰지 않고 그때의 계산값을 쓴다.

### 4-5. 자금 재전망 · covenant — `calculation_definitions.md` 1.2, `covenant_terms_ms.md` [ORIGINAL 산식]

| ID | 규칙 | 라벨 |
|---|---|---|
| R-CASH-01 | `Opening = fin_cash_daily_ms` 2026-06-30 `closing_balance` = **5,148,063,540**. 일별: `+ AR.outstanding_krw @due_date`, `− AP.amount_krw @payment_due_date (po_id='NONE' 만)`, `− PO.amount_krw @payment_due_date`. AP 중 `po_id` 가 PO 에 있는 14행은 **이중계상 금지로 제외** | ORIGINAL 산식 |
| R-CASH-02 | 기준일 이전 만기(연체) 항목: 기본 = 제외(A-08), 민감도 = as-of 일괄 반영. 주말 만기 = 다음 영업일 잔액에 반영(A-09) | ASSUMPTION |
| R-CASH-03 | 영업일 `closing < 3,000,000,000` 인 연속 구간 = 하회 예상 구간. 재무팀 공식 전망(CLAIM)과 나란히 표시하고 차이 원인(7/21 발주대금 37.5억 — 추정, 원인 미확인)을 설명. 대조는 주 단위 비교표(`OfficialComparisonRow`, A-32)로 하고 차이 절댓값 최대 주에 원인 메모를 단다. **공식 전망은 판단 입력이 아니다** — 하회 구간 · 권한 판정 · 경고는 재전망만 쓴다(2026-11-14 사용자 결정) | ORIGINAL(30억 · 매 영업일, "반드시 대조" — `calculation_definitions` 1.2) · AGGREGATED · ASSUMPTION(A-32) |
| R-CASH-04 | 기안 요청액(SAMPLE)은 재전망 유출에 **넣지 않는다**(회의록 "본 기안은 자금 전망 유출 산식에 포함되지 않는다" + R-SCALE-01). 신규 재고 보충 발주(FULL)는 "추가 유출" 시나리오로 **원본 전망분과 분리**해 넣을 수 있다(A05 "원본 전망 포함분과 추가 유출을 분리") | ORIGINAL · ASSUMPTION |

- 현재 결과(기본 가정): 하회 구간 **2026-07-21 ~ 2026-08-21**(24영업일), 최저 **1,921,839,555원 (7/27)**. 민감도(연체 AR 제외 · 연체 AP 7/1 지급): 7/21 ~ 8/28, 최저 1,467,664,440원. **시작일 7/21 은 모든 가정에서 같다** [AGGREGATED]. 재무팀 공식 전망은 하회 없음(주간 최저 5,468,884,369원) [CLAIM].

### 4-6. 확장 · 기타

| ID | 규칙 | 라벨 |
|---|---|---|
| R-EXT-01 (확장 E1) | 통보는 **수령확인이 있어야 "통보 완료"**. `NOTICE_SENT` 상태로 수령 미확인인 채 "발송 후 2영업일 경과" 또는 "기한 당일 09:00" 중 먼저 오는 시점이 되면 `RENOTIFY` 작업 1회(중복 생성 금지), 기한까지 미확인이면 `NOTICE_UNCONFIRMED` + 그룹 CEO/이사회 · 계약 담당 에스컬레이션(작업 `ESCALATE_NOTICE_UNCONFIRMED` 각 1건, 기한 A-28). 수령확인 없이는 다음 판단에서 "자동 갱신 차단됨"으로 쓰지 않는다 | ASSUMPTION A-14 (W02 "실제 통보 수령 증빙이 없다" 공백 보완) |
| R-PEN-01 | 자동 갱신 후 중도 해지 위약금 `= 2,800,000,000 × 잔여개월/12 × 0.5` (예: 2026-12-31 해지 → 잔여 8개월 → **933,333,333원**). 월할 균등은 가정 | 50% ORIGINAL · 월할 ASSUMPTION A-15 |
| R-CON-01 | 같은 인플루언서의 전속계약이 미결정이면 그 인플루언서 기안 건에 `CONTRACT_PENDING` 경고: "기안만 결정해도 계약은 자동 갱신될 수 있음". 기안 결정과 계약 결정은 **별개 승인요청**으로 만든다 | ORIGINAL (정책 "둘은 별개 결정 · 두 건의 기한을 함께 확인") |
| R-SCALE-01 | `Krw<'FULL'>` 와 `Krw<'SAMPLE'>` 의 덧셈 · 곱셈 금지(타입 + 런타임 assert). 표본 비율을 풀스케일 금액에 곱하는 함수도 두지 않는다 | ORIGINAL (`data_dictionary` 6항, A05 3절) |
| R-CLAIM-01 | `expectedGmvKrw` · 공식 현금 전망 · 회의록 문장은 판단의 **입력 근거로 쓰지 않고** `claimsCited` 로만 인용 | ORIGINAL (정책 "예상 GMV 는 승인 근거가 될 수 없다") |

## 5. 가정 목록 (A-xx) — 화면 「데이터 출처」 페이지에 그대로 노출

| ID | 가정 | 이유 · 근거 | 쓰는 곳 |
|---|---|---|---|
| A-01 | 주문 1건 = 1EA → 제품원가 · 배송비를 주문당 1회 | 주문 행에 수량 없음 (A05 5절 "가정이 필요") | R-CP |
| A-02 | 채널수수료 = GMV(쿠폰 반영 후) × `channel_fee_pct` | 수수료 매출 기준 원본 없음 | R-CP |
| A-03 | 반품물류비 = 반품 주문당 1회 | 적용 횟수 원본 없음 | R-CP |
| A-04 | 환불 시 원가 · 수수료 회수 없음 | A05 "자료가 없는 비용 회수는 확정 사실로 가정하지 않는다" | R-CP |
| A-05 | `mkt_orders_ms.campaign_id` = last-click 7일 귀속 결과 | `calculation_definitions` 1.4 "캠페인 귀속 = last-click 7일", 주문 행에 campaign_id 가 모두 채워져 있음 (INTERPRETED) | R-CP |
| A-06 | 성과 집계 기간 = 표본 전 기간(주문 2025-01-01~2026-06-30, 광고비 ~2026-06-26), 주문 집단 기준 | A05 "채택한 기준을 설명" | R-CP |
| A-07 | 권고 등급 = 공식 cp(A05) 부호, cp ≤ 0 이면 부결 권고(R-CP-05) | 원본에 권고 기준 없음. 정책 "실질 공헌이익 기준으로 판단"을 부호로 단순화 | 판단안 |
| A-08 | 재전망에서 기준일 이전 만기 항목은 제외(기본), 민감도로 as-of 반영 | 1.2 는 "due_date 에 배치"만 규정 | R-CASH |
| A-09 | 주말 만기 현금은 다음 영업일 잔액에 반영 | covenant 는 영업일 판정 | R-CASH |
| A-10 | `settlement_date` = 기안 현금 유출일 | 회의록 문구 (INTERPRETED) | R-AUTH-03 |
| A-11 | 승인요청 묶음 = (requiredRole × contractDeadline × subjectType) | 원본에 상신 단위 없음 | 승인요청 |
| A-12 | 내부 처리 기한 D-2/D-1/D-0 | 통보 도달 시간 확보 | R-DL-04 |
| A-13 | 기한 시각 23:59:59 KST | 원본에 시각 없음 | 기한 감시 |
| A-14 | 수령 미확인 통보는 효력 미확인으로 관리 | 통보 수령 증빙 공백 (W02 5절) | 확장 E1 |
| A-15 | 고정 피는 12개월 균등 | 지급 일정 없음 | R-PEN-01 |
| A-16 | 주력 SKU = 캠페인 표본 GMV 비중 ≥ 20% | 캠페인 → SKU 대응표 없음 (A05 3절 "대응표 가정을 별도로 정의") | R-INV-03 |
| A-17 | Target Qty = 안전재고 max 주수 × 4주 평균 | 1.3 에 Target 정의 없음 | R-INV-04 |
| A-18 | 최종 발주량 = MOQ 배수 올림 | "MOQ 제약 반영"의 방식 미정 | R-INV-04 |
| A-19 | 신규 발주 지급일 = 발주일 + 25일 | 기발주 14건 발주일 6/22~6/26 → 지급 7/21 (25~29일) 패턴 | R-AUTH-04 |
| A-20 | 리드타임 = 발주일→입고 소요, in_transit 입고일은 미상 | 원본에 입고일 없음 | R-INV-02 |
| A-21 | 가상 기준시각 시작 2026-07-01 09:00 KST, 앞으로만 이동 | 데이터 as-of | 전체 |
| A-22 | 계약 담당 역할 존재 | BPMN 교육용 가정, 법무 독립 부서는 미확정 | 작업 담당 |
| A-23 | 조건변경안의 구체 조건(고정 피 인하율 등)은 **수치로 만들지 않는다** — "고정 피 비중 축소 · 성과 연동 강화 협의 요청"까지만 | 원본 근거 없음, 수치 생성 시 사실처럼 보일 위험 | 대안 |
| A-24 | 모의 회신 문구 · 날짜 (시연 시나리오). 회신 유형 규칙: 승인 · 부결이 섞인 회신(권고안 승인 포함)의 `outcome` 은 `APPROVED`, 조건부 건이 있으면 `APPROVED_WITH_CONDITIONS`, 권고안 자체 반려만 `REJECTED` (2026-11-14 명시) | 외부 승인 대체 (PROBLEM 4절 조건 1). 원본에 회신 유형 정의 없음 | 시연 · 1-3 ApprovalReply |
| A-25 | 기한 경고 단계 D-7/D-3 | 화면 표시용 | R-DL-03 |
| A-26 | 집행일이 확정기한보다 앞선 건은 결정 필요 시점을 앞당겨 표시 | `settlement_date` 의미 미확정 | R-DL-05 |
| A-27 | 정보 요청 작업(`INFO_REQUEST`, SCM `REPLENISHMENT_REVIEW` 포함) 기한 = min(생성일 + 3일, 관련 원본 기한 − 2일) | 원본에 회신 기한 없음. 답을 받은 뒤 재판단 · 재상신할 시간(원본 기한 D-2 = 계약 승인 내부 기한 A-12)을 남긴다. 1단계 백엔드가 계약 정보 요청에 정한 값(③ 7/10 → 7/13)을 채택하고 ④ 에도 같은 규칙 적용(2026-11-14) | 작업 기한 (1-3 Task) |
| A-28 | 사후 보고 · 사고 대응 작업 기한 = 계기 시점 + 7일(달력일): 자동 확정 · 자동 갱신 · 수령 미확인은 원본 기한 + 7일, 기한 후 권한 상향 감지는 감지 시점 + 7일 | 원본에 사후 보고 기한 없음. 1주 안 보고로 정함(③-B 7/24). 1단계 백엔드 결정 채택(2026-11-14) | `POST_DEADLINE_REPORT` · `INCIDENT_AUTO_RENEWAL` · `ESCALATE_NOTICE_UNCONFIRMED` |
| A-29 | 그룹 보고(`REPORT_TO_GROUP`) 기한 = 해당 승인요청의 원본 기한 당일 | 정책은 "그룹 보고"만 규정, 시점 없음. 결정이 확정(기한 도래)되기 전에 그룹이 알게 한다. 1단계 백엔드 결정 채택(2026-11-14) | R-AUTH-01 |
| A-30 | SCM 검토에서 "보충 불필요"로 회신된 보충요청 초안은 승인 절차 없이 `DRAFT → REJECTED`(사유 '불필요')로 종결 | 초안은 현금 약정이 아니므로 권한자 승인이 필요 없다(정책의 승인 대상은 발주). 1단계 백엔드 결정 채택(2026-11-14). 화면은 승인 거절과 구분 표시 | 3-5 ReplenishmentRequest |
| A-31 | 기안 금액 정정(`LINE_TERMS_CHANGED.requestedKrw`)이 들어오면 권한 판정용 기안 총액을 다시 계산하고 25건 전부 재판정. 부결 · 취소는 총액을 줄이지 않음(R-CP-06 과 구분) | 원본에 기안 정정 절차 없음. 정정은 기안 금액 자체가 바뀐 것이고, 부결은 금액이 아니라 결정이 바뀐 것이라는 구분(W02_TASK 3-3 해석의 연장). 1단계 백엔드 결정 채택(2026-11-14). 시연 시나리오에는 금액 정정이 없음(②는 집행일 정정만) | R-AUTH-01 · R-AUTH-06 |
| A-32 | 재무팀 공식 전망 `week`(월요일) = **그 월요일에 끝나는 기간**(직전 화 ~ 해당 월, 첫 주 7/1 ~ 7/6). 재전망과의 주간 대조값 = 재전망의 `week` 날짜 종가, 하회 여부 = 기간 내 영업일 중 종가 < 30억 이 있는지 | `week` 정의가 원본에 없음(미확인). 근거: `forecast_date` 6/30, `week` 13개 모두 월요일, 첫 행 종가 = 6/30 자금일보 종가 + 유입 − 유출이고 13행이 직전 종가에서 이어짐(집계 확인) → 7/1 부터 빈틈 없이 이어지는 해석. 흐름(유입 · 유출) 대조로는 검증 불가(공식 흐름이 원본 스케줄과 어느 묶음으로도 맞지 않음). 하회를 기간 전체로 보는 이유: covenant 는 매 영업일 판정. 2026-11-14 사용자 결정(S-10 대조)에 따라 기획이 정함 | R-CASH-03 · S-10 비교표 · BE-10 |
| A-33 | 에이전시가 성과 피 정보 요청에 「정보 제공」으로 모의 회신하면 회신 문구를 계약 `performanceFeeTerms` 에 **모의(MOCK) 값으로** 기록하고 그 정보 요청을 닫는다. 다음 판단안의 「성과 피 조건」 사실은 이 모의 문구가 되고, `unknowns` 의 G-02 는 빠지지 않고 "모의 회신으로 보완 — 원본 공백은 그대로"(`FILLED_BY_MOCK`)로 남는다(2026-11-14 보완, 10-1 ⓐ — 첫 채택 때의 "G-02 가 빠진다"를 고침). **문구를 금액 · 비율로 바꾸지 않으며**, 권한 판정(R-AUTH-02)의 연 금액은 계속 "하한 28억"(`lowerBound = true`). 원본 공백 G-02 자체는 해소된 것이 아니다 — S-12 는 "모의 회신으로 보완(원본 공백 그대로)"으로 표시(BE-12) | 원본에 성과 피 산식이 없고(G-02) 회신은 모의다. 회신을 버리면 "정보 제공" 결과가 다음 판단에 반영되지 않고, 숫자로 바꾸면 모의 문구가 사실 · 계산값처럼 보인다(A-23 과 같은 이유). 하한만으로도 권한자는 그룹 CEO/이사회로 확정(28억 > 10억)이라 권한 결과는 바뀌지 않는다. 2단계 백엔드 결정을 검토 후 채택(2026-11-14) | 1-2 ExclusiveContract · 1-3 Event 상대별 효과 · R-AUTH-02 · G-02 |
| A-34 | SCM 이 보충 검토에 「거절(보충 불가)」로 모의 회신하면 그 건의 보충요청 초안을 승인 절차 없이 `DRAFT → REJECTED`(사유 '보충 불가')로 종결하고, 연결 기안 건의 공급 전망을 `NO_SUPPLY` 로 바꾼다 → 재고 게이트(R-INV-03)에 걸린 건의 권고는 부결 | 원본에 SCM 검토 거절 절차가 없음. 보충이 안 된다는 회신을 받고도 권고를 조건부로 두면 집행일 전 품절 제약(R-INV-03)을 회신 결과로 지우는 셈이다 — 권한자 거절(3-5)과 같은 결과로 둔다. 초안은 현금 약정이 아니라 종결에 권한자 승인이 필요 없다(A-30 과 같은 이유). 권고 변경은 권고일 뿐이고 건의 결정은 여전히 권한자 회신으로만 한다(R-AUTH-05). 2단계 백엔드 결정을 검토 후 채택(2026-11-14) | 3-5 ReplenishmentRequest · 1-3 Event 상대별 효과 · R-INV-03 |
| A-35 | 작업(Task)의 시작 · 완료 · 취소는 **작업 담당 역할(`ownerRole`)만**, 보충요청 초안 생성은 **SCM 만** 할 수 있다(`AI_AGENT` · `SYSTEM` 은 행위자가 될 수 없음). 서버는 요청의 `actorRole` 이 허용 역할과 다르면 422 `FORBIDDEN_ROLE`, 없으면 422 `VALIDATION` 으로 거부하고 상태를 바꾸지 않는다. SCM 보충 검토 작업(`REPLENISHMENT_REVIEW` · SCM `INFO_REQUEST`)은 `PATCH` 로 완료하지 않고 SCM 보충 검토 회신으로만 닫는다. 이 규칙은 **사람이 `PATCH` 로 처리하는 경우**의 것이다 — 사건의 결과로 규칙 코드가 닫는 작업(수령확인 · 외부 회신 · 재상신 완료 → 재검토 작업 종료)은 3-4 표가 정하고, 이력에 그 사건의 행위자(`MOCK` 회신자 또는 `SYSTEM`)와 사유를 남긴다(2026-11-14 보완) | 원본에 작업 처리 권한 규정이 없다. 작업 담당은 BPMN W02 레인(계약 담당 t1 · t3 · t4 · t5 · t6)과 작업 생성 규칙이 정한 값이고, 작업 완료는 다른 엔티티를 바꾼다(통보 발송 → 계약 `NOTICE_SENT`, 재상신 → 새 승인요청, 집행일 조정 → 권한 재판정). 담당 아닌 역할이 처리하면 책임 경계가 흐려지고 이력의 행위자가 사실과 달라진다. 화면에서만 막으면 API 를 직접 부르는 경로가 남는다(LOG-017 프론트엔드 보고). 2026-11-14 기획 결정 | 1-3 쓰기 행위별 허용 역할 · 3-4 · BE-17 · BE-18 |
| A-36 | 결정을 확정하지 않는 쓰기 — 사건 입력(통보 · 기안 접수, 회수 지연, 기안 정정, 외부 회신) · 판단안 생성 · 승인요청 상신 — 와 시연 운영 행위(시점 이동 · 시나리오 리셋)는 서버가 호출 역할을 검사하지 않는다. 이력의 행위자는 사건 유형별 고정값(통보 접수 계약 담당 · 기안 접수 마케팅팀 · 회수 지연 재무팀 · 외부 회신 `from`) 또는 `SYSTEM` · `AI_AGENT` 다. 사용자 신원 확인(로그인)은 범위 밖 | 이 쓰기들은 승인 효력을 만들지 않고, 권한자 · 기한 · 공급 제약은 규칙 코드가 정해 누가 눌러도 결과가 같다 — 검사가 없어도 원본 제약(권한 · 기한 · 계약 · 생산능력)이 사라지지 않는다. 시점 이동 · 리셋은 시연 재현 장치다(A-21). 2026-11-14 기획 결정 | 1-3 쓰기 행위별 허용 역할 · DEMO 0-4 |

## 6. 데이터 공백 (W02_TASK 5절 연결)

| ID | 공백 | W02_TASK 연결 | 영향받는 판단 | 처리 |
|---|---|---|---|---|
| G-01 | 계약 원문 없음 | 5절 1번 | 조건변경 가능 범위 | 통보서 조건만 사용, 원문 필요 시 `INFO_REQUEST` |
| G-02 | 성과 피 정산조건 없음 | 5절 1번 | 연 총 보수(하한 28억만 확정) · 대안 비교 | 판단안 `unknowns` + `INFO_REQUEST`(AGENCY), 권한자는 하한으로도 확정(>10억). 에이전시 모의 「정보 제공」이 오면 문구만 MOCK 으로 기록(A-33) — 원본 공백은 그대로 |
| G-03 | 실제 통보 수령 증빙 없음 | 5절 1번 | "통보 완료" 판정 | **확장 E1** (NoticeReceipt · RENOTIFY · NOTICE_UNCONFIRMED) |
| G-04 | 연간 계약 vs 캠페인 비용 귀속 · 중복 | 5절 2번 | INF-001 `ad_spend`(인플루언서 매체, 표본)에 고정 피가 들어 있는지 | 대사하지 않음(스케일 다름). 화면에 "미확인" 표시 |
| G-05 | 담당자별 검토 · 상신 · 통보 이력 없음 | 5절 3번 | 과거 지연 원인 | 시스템 도입 이후 `AuditLog` 로 쌓음. 과거는 미확인 |
| G-06 | 법무 · 계약 독립 부서 · 서명 절차 미확정 | 5절 4번 | 작업 담당자 | A-22 |
| G-07 | 물류 추가비용 · CS 문의 원본 없음 | 3-7절 | "회사가 실제로 얻은 것" | 이번 범위에서 **가정 데이터 만들지 않음**. 화면에 "공헌이익에 미포함(원본 없음)" 표시. 필요 시 추가 확장 |
| G-08 | `in_transit_qty` 입고일 · 기발주(SPO) 포함 여부 | 3-6절 | 품절 시점 · 보충 수량 | `INFO_REQUEST`(SCM/COREVIA), R-INV-02 는 입고 제외 기준 |
| G-09 | 고정 피 지급 일정 | 3-5절 | 계약의 covenant 대조 | 판정 불가 표시 (권한자는 이미 최상위) |
| G-10 | `covenant_terms_ms.md` "완충 목표" 문장이 끊겨 있음 | 3-5절 | 30억 외 완충 기준 | 30억만 사용, 완충 목표는 미확인 |
| G-11 | `settlement_date` 가 `contract_deadline` 보다 앞선 12건(PLAN-007 · 008 · 009 · 014 · 015 · 016 · 018 · 021 · 022 · 023 · 024 · 025) | 3-3절 | 결정 필요 시점 | A-26 플래그 |
| G-12 | `reserved_qty` 없음 | 3-6절 | 가용재고 | 원본 규칙대로 on_hand 만 |
| G-13 | 캠페인 증분 수요(풀스케일) | 3-6절 | 재고 소진 속도 | 금액 · 수량 환산 안 함, 방향만 |

## 7. 1단계 구현 반영 · 후속 작업 (2026-11-14)

> 2026-11-14 이후 바뀐 것: 실시간 AI 판단안은 한때 보류였다가 **실제 실행 1회 + 기록 재생**으로 정해졌다(사용자 결정 (b) — 시연 런타임은 모의 판단안, [9-1](#9-1-사용자-결정--ai-방식-b-실제-실행-1회--기록-재생)). 아래 7-3 의 프론트 작업은 모두 처리됨(LOG-017).

기준: 백엔드 · 프론트엔드 1단계(커밋 `be79a9d`, `npm run check` 141 테스트 통과 — devlog LOG-002 · LOG-004) 보고와 `app/src/domain/` 코드 대조. 코드 동작은 `workflow.ts` · `authority.ts` · `inventory.ts` · `types.ts` 와 `app/tests/` 를 읽어 확인했다.

### 7-1. 이번에 문서에 반영한 것

| # | 항목 | 처리 | 반영 위치 |
|---|---|---|---|
| 1 | AC-3-03 승인요청 번호 → 의미 기준 | 반영 — 요청 ID 는 일련번호일 뿐, 의미(version · supersedesId)로 검증 | 1-3 ApprovalRequest, DEMO AC-3-03 |
| 2 | AC-2-03 최종 상태 · 이력 기준 | 반영 — 최종 `PENDING_APPROVAL`, 이력 `APPROVED → REAPPROVAL_REQUIRED → PENDING_APPROVAL` | 3-2, DEMO AC-2-03 |
| 3 | R-INV-04 기안 건 보충은 min 미달 SKU 만 | 반영 | 4-4 R-INV-04, 1-3 ReplenishmentRequest |
| 4 | 수령 미확인 에스컬레이션 작업 유형 | **결정: `ESCALATE_NOTICE_UNCONFIRMED` 추가** (`INCIDENT_AUTO_RENEWAL` 재사용 안 함) → BE-01 | 1-3 Task, 3-1, R-EXT-01 |
| 5 | 추가 필드 · 작업 기한 · 보충요청 `DRAFT → REJECTED` | 반영 (필드 10개, 작업 기한 표, 3-5 전이) | 1-2 · 1-3 · 3-5 |
| 6 | R-AUTH-06 대기 건 상향(`RESUBMIT_PENDING`) | 채택 · 반영. 이력 연속성 결함은 BE-02 | 4-1 처리 방식 표 |
| 7 | 혼합 승인 · 부결 회신 outcome | 반영 — `APPROVED` (A-24 에 회신 유형 규칙 명시), 검증은 BE-08 | 1-3 ApprovalReply, 3-3 |
| 8 | 백엔드가 새로 정한 것 6건 | 5건 채택(A-27~A-31), 1건(작업 유형 재사용) 기각 → BE-01. 정보 요청 기한은 ④ 에도 같은 규칙 → BE-03 | 5절, 1-3 작업 기한 표 |
| 9 | 프론트 "SCM 회신(모의)" 역할 | 결정: 역할 `SCM` 하나, 행동 종류로 구분 → FE-01 | 1-3 역할 |
| 10 | 재고 게이트 플래그가 7/1 부터 PLAN-011 에 있음 | 결정: **맞다**(조건이 7/1 에도 성립). DEMO ④ 문구 수정 | 4-4, DEMO S4-1 · AC-4-02 |
| 11 | S-10 재무팀 공식 전망 표시 방식 (프론트 1단계 보고 「다른 점」) | **결정됨(2026-11-14, 사용자)**: 공식 전망(주장)을 재전망 차트에 다른 색 · 모양 점으로 겹치고, 차트 아래 접지 않은 비교표로 대조. `주장` 배지 필수, 판단(권한 · 하회 구간 · 경고 · 권고)에는 재전망만. 주간 대응 기준 A-32 → BE-10 · FE-06 | 1-2 OfficialComparisonRow, 4-5 R-CASH-03, 5절 A-32, SCREEN_SPEC 0-2 · S-10 · 4절 · UI-03 · 5-1, DEMO S2-2 · AC-2-10 · 부록 A-4-1 |

### 7-2. 백엔드 작업 (2단계에 함께 처리)

**상태 (2026-11-14, 백엔드 2단계 보고 + 코드 대조. 미커밋 작업본. 백엔드 보고 시점: 테스트 212 통과 · 2 건너뜀(DB 통합) · lint 통과 · typecheck 1건 실패(FE-03 — 프론트 소유). 기획이 다시 돌린 `tsc --noEmit`: 프론트 2단계(API 전환) 진행 중이라 페이지 타입 오류 여러 건 — `npm run check` 판정은 프론트 2단계 뒤. 그 전에는 "완료"로 보지 않는다)**

| ID | 상태 | 확인한 것 |
|---|---|---|
| BE-01 | **구현** — 화면 라벨 FE-03 남음 | `TaskType` 에 `ESCALATE_NOTICE_UNCONFIRMED`, `advanceClock` ④ 에서 그룹 CEO/이사회 · 계약 담당 2건, 기한 통보 기한 + 7일. `components/labels.ts` 에 라벨이 없어 typecheck 실패 |
| BE-02 | **구현** | `RESUBMIT_PENDING` 대기 건 `PENDING_APPROVAL` 유지 + 같은 상태 이력 1행, `approvalRequestId` 교체, 옛 요청 회신 409. AC-2-09 테스트 |
| BE-03 | **구현** | `draftReplenishment` 두 작업 기한 = min(생성일 + 3일, 확정기한 − 2일) → ④ 7/23 23:59:59 |
| BE-04 | **구현** | 재승인 · 재상신 요청 version = 이전 + 1 |
| BE-05 | **구현** | 모의 회신 `requestId` 하드코딩 제거 → `target: RequestTarget`(`findPendingRequest`), 없으면 404 |
| BE-06 | **구현** | `CounterpartyReplyInput` 최종 모양 · 상대별 효과(1-3 Event 표). 백엔드가 정한 2건은 검토 후 채택 → A-33 · A-34 |
| BE-07 | **구현** | `GET /api/clock/preview`(저장 안 함) · `POST /api/clock/advance`, 미리보기 = 실제 `transitions` 테스트, 과거 409 |
| BE-08 | **구현** | 조건부 불일치 422 `VALIDATION`, 혼합 회신 `APPROVED` 통과 |
| BE-09 (선택) | **구현** | 3-5 마지막 항목 · 4-1 문장 변경 |
| BE-10 | **구현** | `compareOfficialForecast` · `largestOfficialGap`, 부록 A-4-1 v1 · v2 13행 일치, `largestGap` v1 08-17 · v2 08-24, 공식 전망을 바꿔도 하회 · 권한 불변. `/api/analytics/cash` 의 `compareVersion` · `officialComparison[]` · `largestGap` |

| ID | 파일 | 할 일 | 수용 기준 |
|---|---|---|---|
| **BE-01** | `domain/types.ts` · `domain/workflow.ts`(`advanceClock` ④) · `tests/scenarios/s3-info-reject.test.ts` | `TaskType` 에 `ESCALATE_NOTICE_UNCONFIRMED` 추가. 계약 `NOTICE_SENT → NOTICE_UNCONFIRMED` 때 이 유형으로 작업 2건(그룹 CEO/이사회 · 계약 담당, 기한 통보 기한 + 7일 A-28) | AC-3-05: `ESCALATE_NOTICE_UNCONFIRMED` 2건(ownerRole 2종), `INCIDENT_AUTO_RENEWAL` 0건. AC-3-06(자동 갱신)은 `INCIDENT_AUTO_RENEWAL` 1건 그대로 |
| **BE-02** | `domain/workflow.ts`(`applyReroute` 의 `RESUBMIT_PENDING`) · 단위/시나리오 테스트 | 건 상태를 `VALIDATED` 로 직접 대입하지 않는다(전이표에 없는 `PENDING_APPROVAL → VALIDATED` 가 이력 없이 생김). 건은 `PENDING_APPROVAL` 유지, 이력 1행(`PENDING_APPROVAL → PENDING_APPROVAL`, 사유 "{이전 요청} 대체 → {새 요청} 재상신", R-AUTH-06), `approvalRequestId` 교체 | 새 테스트: ①을 S1-4 까지 재생(APR-003 대기) → 7/10 `AR_COLLECTION_DELAYED(MAR-0004 → 2026-08-30)` → APR-003 `SUPERSEDED`, PLAN-004 는 `GROUP_CEO_BOARD` 새 요청 · PLAN-005 는 `MASIL_CEO` 새 요청(둘 다 version 2, supersedesId APR-003), 두 건 상태 `PENDING_APPROVAL`, 각 건 이력에서 모든 행의 `fromStatus` = 직전 행 `toStatus`. APR-003 에 `MASIL_CEO` 가 회신하면 409(이미 SUPERSEDED) |
| **BE-03** | `domain/workflow.ts`(`draftReplenishment`) · `tests/scenarios/s4-inventory-scm.test.ts` | ④ SCM `INFO_REQUEST` · `REPLENISHMENT_REVIEW` 기한을 A-27 로: min(생성일 + 3일, 확정기한 − 2일) | 7/20 09:00 초안 생성 → 두 작업 `dueAt = 2026-07-23T23:59:59+09:00`. 계약 정보 요청(③ 7/13)은 그대로 |
| **BE-04** | `domain/workflow.ts`(`REAPPROVAL_REQUIRED` 새 요청) · `tests/scenarios/s2-condition-change.test.ts` | `supersedesId` 가 있는 새 요청은 version = 이전 요청 version + 1 (지금은 1) | AC-2-03: 새 요청 `version = 2`, `supersedesId` = PLAN-004 의 이전 요청 |
| **BE-05** | `domain/mockReplies.ts` · 프리셋 재생 · 2단계 API | 모의 회신의 `requestId` 하드코딩(`APR-001` · `APR-004` · `APR-005` 등)에 기대지 않는다. 재생 시 대상 · 상태로 요청을 찾아 채운다(예: "계약 대상 `PENDING` 요청") | 프리셋 ①~④ 를 어떤 순서로 재생해도 모의 회신이 의도한 요청에 붙는다. `S3_3_APPROVE_TERMINATE` 를 `requestId` 덮어쓰기 없이 ③ 프리셋에 적용 가능 |
| **BE-06** | `domain/workflow.ts` 입력 타입 · `app/src/app/api/events` | `COUNTERPARTY_REPLY` 입력을 S-02 양식(수령확인 · 정보 제공 · 정보 부족 · 거절)과 보내는 쪽(AGENCY · SCM · COREVIA)으로 받는다. 백엔드가 2단계에서 `types.ts` 에 만들고 있는 `CounterpartyReplyInput`(outcome 4종 + `replenishmentNeeded` · `inboundExpectedDate`)과 같은 방향이며, 처리는 [SCREEN_SPEC 4-1](SCREEN_SPEC.md#4-1-외부-회신-양식--도메인-처리-대응-2026-11-14) 표를 따른다. 거절은 계약 · 통보 상태를 바꾸지 않고 열린 작업에 결과 메모 · 이력만. SCM 거절의 공급 전망 처리는 백엔드가 정해 보고 | S-02 에서 네 가지 결과를 각각 넣을 수 있고, 처리 결과 응답에 `transitions` · `createdTasks` 가 온다. 맞는 열린 작업이 없으면 404 |
| **BE-07** | `app/src/app/api/clock/` | `POST /api/clock/advance` + `GET /api/clock/preview?to=` (저장 없이 `advanceClock` 을 돌려 지나갈 기한 · 일어날 전이 · 생길 작업 목록 반환 — 순수 리듀서라 가능) | 미리보기 결과와 실제 이동 결과의 `transitions` 가 같다. 과거 시각이면 409 `CLOCK_BACKWARD` |
| **BE-08** | `domain/workflow.ts`(`replyToApproval`) · API | 기안 건 회신(`EXPANSION_LINES`) 검증: `CONDITIONAL` 건이 있는데 `outcome` 이 `APPROVED`, 또는 `APPROVED_WITH_CONDITIONS` 인데 `CONDITIONAL` 건이 없으면 상태를 바꾸지 않고 422 오류(코드는 백엔드가 정하고 SCREEN_SPEC 4절에 보고 — 작업 중인 `VALIDATION` 422 를 써도 된다) | 두 경우 모두 422 · 상태 불변. 혼합 승인 · 부결(APR-002 · APR-003)은 `APPROVED` 로 통과 |
| **BE-10** | `domain/cash.ts`(새 순수 함수, 예 `compareOfficialForecast(run, official)`) · `server/` 공식 전망 적재 · `app/src/app/api/analytics/cash` · 단위 테스트 | 공식 전망 13행과 재전망 run 1개로 `officialComparison` · `largestGap` 계산(A-32: 기간 = 직전 화 ~ `week` 월, 첫 행은 asOf ~ `week` · 재전망 값 = `week` 날짜 종가(영업일이 아니면 직전 영업일) · `diff` = 재전망 − 공식 · `belowDays` = 기간 내 종가 < 30억 영업일 수 · `belowThreshold` = belowDays > 0). `official` 은 `Sourced` CLAIM(`fin_cash_forecast_ms.csv` · `week` · `projected_closing_krw`), `recalculated` · `diff` 는 AGGREGATED + `assumptionIds` [A-08, A-09, A-32]. `largestGap` = 차이 절댓값 최대 주, `notes` 는 "7/21 기발주 대금 3,749,760,000 미반영 추정 — 원인 미확인"(INTERPRETED)과 나머지 금액 "미확인". 응답 형태는 [SCREEN_SPEC 4절](SCREEN_SPEC.md#4-api-제안-확정은-백엔드) | 단위: v1 · v2 각 13행이 [DEMO 부록 A-4-1](DEMO_SCENARIOS.md) 과 같다(예 v1 주 07-06 diff +441,709,421 · v2 주 08-24 recalculated 1,921,839,555 · belowDays 5). `largestGap.week` v1 = 2026-08-17 · v2 = 2026-08-24. 공식 전망 값을 바꿔도 `breachWindows` · 라우팅 결과가 같다(판단 입력 아님). AC-2-10 |
| BE-09 (선택) | `domain/workflow.ts` | 재전망 뒤 `SUBMITTED` 보충요청의 지급일이 새 하회 구간에 들어가면 R-AUTH-06 처럼 권한 재판정 | 시연 필수 아님. **2단계 구현됨** — 4-1 문장을 "구현됨"으로 바꿨다(3-5 참고) |

- 백엔드 2단계 계획(Drizzle · API · AI)과 충돌하지 않는다. 위 항목은 도메인 함수 수정이 대부분이고, API 계약은 SCREEN_SPEC 4절 · 4-1 에 반영했다.
- 1단계에서 이미 맞게 구현돼 문서만 따라간 것: `approvedByRole` · `approvalRequestId` · `supplyOutlook` · `inboundExpectedDate` · `instruction` · `infoRequest` · `Assessment.version` · `returnOrderCount` · `scale` · `Routing.forecastRunId`, 오류 코드 5종(`FORBIDDEN_ROLE` 422 · `INVALID_TRANSITION` 409 · `NOT_FOUND` 404 · `INFO_MISSING` 422 · `CLOCK_BACKWARD` 409).

### 7-3. 프론트엔드 작업

| ID | 파일 | 할 일 | 수용 기준 |
|---|---|---|---|
| **FE-01** | `app/src/app/_data/views.ts`(`DEMO_ROLES`) · 역할 전환 · S-06 · S-07 · S-09 | 역할 목록에서 "SCM 회신(모의)" 제거, `SCM` 하나로. SCM 역할일 때 S-07 · S-09 에 [보충 검토 회신](불필요 + 입고 예정일 / 필요) 버튼, S-06 승인 버튼은 `requiredRole = SCM` 요청에서만 활성 | 역할이 7개 → 6개. ④-a · ④-b 를 SCM 역할 하나로 진행 가능. ④-b 그룹 CEO/이사회 구간 요청에서 SCM 승인 버튼 비활성 + "그룹 CEO/이사회만 결정할 수 있습니다" |
| **FE-02** | S-01 시점 이동 모달 | BE-07 연결: 날짜 입력 → 미리보기 목록 → [확인] → 서버 재조회. BE-07 전까지는 지금처럼 비활성 + 프리셋 안내 허용 | UI-05 의 시점 이동 부분. ① 7/18 이동 후 7/17 경고 사라짐 |
| **FE-03** | `components/labels.ts` | BE-01 뒤 `ESCALATE_NOTICE_UNCONFIRMED` 라벨 "통보 수령 미확인 에스컬레이션", `INCIDENT_AUTO_RENEWAL` 라벨은 "자동 갱신 사고 대응"으로 좁힘 | ③-A' 화면에 "자동 갱신" 문구가 나오지 않는다 |
| **FE-04** | S-07 · S-09 · S-11 | 보충요청 `DRAFT → REJECTED`(SCM '불필요')는 "SCM 검토: 불필요로 종결 (승인 거절 아님)", **SCM '보충 불가'(A-34)는 "SCM 검토: 보충 불가로 종결 (승인 거절 아님)"**, 권한자 거절은 "승인 거절" — 이력의 이전 상태 · 사유 접두어로 구분(BE-13 문구 필드가 오면 그것을 씀) | ④-a 와 ④-b 의 보충요청 종결 문구가 다르고, SCM 거절 회신 뒤 문구가 셋째 문구다 |
| **FE-05** | S-04 · S-06 | 재승인 · 재상신 표시를 요청 번호가 아니라 `supersedesId` · `version` · 건 이력으로 그린다 | ② 후 PLAN-004 행에 "재승인 필요 → 재상신됨(v2)", 새 요청 상세에 "이전 요청 {supersedesId} 대체" |
| **FE-06** | S-10 `/analysis/cash` 화면(차트 · 비교표) · 범례 | **결정됨(2026-11-14, 사용자)**. 「주장 · 참고」 접힘 표를 없애고 (1) 재전망 일별 선(v1 점선 · v2 실선 · 30억 기준선 · 하회 음영) 위에 공식 전망 주간 종가를 **다른 색 · 다른 모양 점**으로 겹친다 — 범례 · 점 툴팁에 `주장` 배지와 출처. (2) 차트 바로 아래 **접지 않은** 비교표: 주차(대응 기간) · 공식 전망 종가(`주장`) · 재전망 해당 주 종가(`집계`) · 차이 · 30억 하회 여부(재전망 기준, 하회 영업일 수). `largestGap` 주 행 강조 + 원인 메모("추정 — 원인 미확인"). ② 이후 v1 과 달라진 행에 "② 이후 변경". 값은 BE-10 응답만 쓰고 화면에서 계산하지 않는다. BE-10 전에는 숫자를 고정 문구로 넣지 않는다 | UI-01 · UI-03(새 문구) · UI-02 유지. ② 시연에서 비교표가 v2 로 바뀌고 최대 차이 주가 08-17 → 08-24 로 이동해 보인다. 공식 전망 숫자가 0-3 경고 · 판단안 · 승인요청 사유에 나오지 않는다. AC-2-10 |

## 8. 2단계 백엔드 반영 · 완료 조건 점검 · 후속 작업 (2026-11-14)

기준: 백엔드 2단계 보고(미커밋 작업본)와 `app/src/domain/{types,api-types,workflow,assessment,provenance,errors,registry}.ts` · `app/src/server/{service,http}.ts` · `server/db/schema.ts` · `src/app/api/**/route.ts`(24개)를 읽어 대조했다. 실행 확인은 백엔드 보고를 인용했고, 기획이 직접 돌린 것은 `tsc --noEmit`(프론트 진행 중 오류 — 7-2 상태)과 원본 행 수 재계산(1-1)뿐이다. 실시간 AI 경로는 **미확인**(크레딧 부족 400 → 모의 대체만 확인) — 그 뒤 같은 날 17:19 KST 에 실제 실행 1회가 성공했다 — 시연 런타임은 모의 판단안, 실제 실행은 기록 재생으로 보인다([9-1](#9-1-사용자-결정--ai-방식-b-실제-실행-1회--기록-재생)). 아래 8-3 점검표는 [9-4](#9-4-완료-조건-재판정)에서 다시 판정했다.

### 8-1. 이번에 문서에 반영한 것

| # | 항목 (백엔드 「ONTOLOGY 반영용 목록」) | 처리 | 반영 위치 |
|---|---|---|---|
| 1 | 판단안 타입 — `AssessmentFact{key,name,value}` · `ruleResults[].subjectId` · `proposedDecisions` · `ToolCallLog{name,input,output,actor}` · `fallbackReason` · `stopReason` · `warnings`, API 의 `mock` · `provenance` · `approvalRequestIds` | 반영 + 숫자 출처 검증 규칙 · AI 가 정하는 범위 명시 | 1-3 Assessment |
| 2 | `WorldState.assessments`, 이력 `ASSESSMENT`(null → CREATED, `AI_AGENT`, AI/MOCK), 빈 대기 요청에 판단안 자동 연결 | 반영. `entityType` 7종 목록(`CASH_FORECAST` 포함) | 1-3 Assessment · AuditLog |
| 3 | 오류 코드 `VALIDATION`(422) · `CONFLICT`(409), `FORBIDDEN_ROLE` 메시지 | 반영 — 오류 코드 표(7종 + `INTERNAL` 500) | 3절 머리 · 1-3 ApprovalReply · [SCREEN_SPEC 4절](SCREEN_SPEC.md#4-api-2단계-확정-2026-11-14) |
| 4 | `CounterpartyReplyInput` 최종 · `ScmReviewInput` · `ReplyInput.target(RequestTarget)` | 반영 | 1-3 Event · ApprovalReply |
| 5 | 상대별 회신 효과(SCM 거절 → `NO_SUPPLY`, 에이전시 정보 제공 → `performanceFeeTerms`(MOCK), Corevia 정보 제공 → `inboundExpectedDate`) | 반영. 백엔드가 정한 2건은 **검토 후 채택 → A-33 · A-34** (8-2) | 1-3 Event 표 · 3-5 · 5절 |
| 6 | `draftReplenishment(triggerLineId, skuIds?)`, 대상 아님 422, 중복 초안 409 | 반영 (중복 초안 코드는 `INVALID_TRANSITION`) | 1-3 ReplenishmentRequest |
| 7 | BE-09 구현 | 4-1 문장 변경, 3-5 전이 추가 | 3-5 · 4-1 · 7-2 |
| 8 | DB 스키마: `raw_files` · `raw_rows` 일반화, 운영 테이블 핵심 열 + `data` jsonb, `audit_log.recorded_at` | **채택** — `raw_<파일>` 은 논리 이름으로 남김 | 1-1 · 1-3 DB 스키마 원칙 |
| 9 | SCREEN_SPEC 4절 응답 차이 + 새 API | 4절을 실제 24개 경로 · 응답 타입으로 다시 씀 | [SCREEN_SPEC 4절](SCREEN_SPEC.md#4-api-2단계-확정-2026-11-14) |
| 10 | 환경변수 `AOURA_AI_MODE` · `RAW_DATA_DIR` · `TEST_DATABASE_URL` | 이름 · 용도만 기록(값 없음) | [TECH_STACK 5-1](TECH_STACK.md#5-1-로컬-개발-db-와-환경변수-2026-11-14) · 1-1 |
| 11 | 시연 ① API 실행 결과(11단계) | 10단계 "기한 4건 · 전이 7건" 중 2건은 **미완료 작업 `DOCUMENT_CONDITIONS`(기한 7/16) · `REPORT_TO_GROUP`(7/17)의 OVERDUE** — 동작은 맞음(기한 감시 ①). 정상 흐름에서는 두 작업을 7/18 전에 완료하도록 시나리오를 고침 → BE-16 | [DEMO S1-6 · S1-7 · AC-1-10](DEMO_SCENARIOS.md#s1-6-후속-처리) |

### 8-2. 백엔드가 정한 것 2건 — 검토 결과

| 백엔드 결정 | 판정 | 이유 · 조건 |
|---|---|---|
| SCM 「거절」 → 보충요청 초안 `REJECTED` + 공급 전망 `NO_SUPPLY` → PLAN-011 권고 부결 | **채택 (A-34)** | 보충이 안 된다는 회신 뒤에도 조건부 권고를 유지하면 집행일 전 품절 제약을 회신으로 지우는 셈이다(CLAUDE.md 규칙 7). 권한자 거절과 같은 결과라 규칙이 하나로 맞는다. 초안 종결은 현금 약정이 아니라 권한 경계를 넘지 않는다(A-30 과 같은 근거). 권고만 바뀌고 건의 결정은 권한자 회신으로만(R-AUTH-05). **조건**: 화면은 "SCM 검토: 보충 불가로 종결 (승인 거절 아님)"으로 권한자 거절 · '불필요' 종결과 구분(FE-04 · BE-13) |
| 에이전시 「정보 제공」 → `performanceFeeTerms` 에 회신 문구(MOCK) 기록, G-02 를 판단안 `unknowns` 에서 뺌, 권한 판정 금액은 하한 28억 유지 | **채택 (A-33)**, 조건 1건 → BE-12 | 회신이 다음 판단에 반영되고(완료 조건 1 「바뀐 상태가 다음 판단에 쓰임」), 값은 `모의` 배지로 사실과 구분된다. 문구를 금액으로 바꾸지 않으므로 A-23 과 충돌하지 않는다. 하한만으로도 권한자는 그룹 CEO/이사회. **조건**: 원본 공백 G-02 는 해소된 것이 아니다 — 지금 `GET /api/data-registry` 의 `gaps[].open` 이 G-02 · G-03 · G-08 을 모의 회신 뒤 `false`(해소)로 돌려주므로 "모의 회신으로 보완(원본 공백 그대로)" 상태를 따로 둔다(BE-12) |

### 8-3. 완료 조건 5개 점검 (PROBLEM.md 4절)
점검표는 [DEMO_SCENARIOS 0-2](DEMO_SCENARIOS.md#0-2-완료-조건-점검-2026-11-14-4단계-뒤)에 둔다(시연 대응표 0-1 바로 아래 — 프론트 2단계 뒤 다시 판정, [9-4](#9-4-완료-조건-재판정)). 백엔드 2단계 시점의 판정(기록): 조건 1~4 는 **도메인 · API 테스트로는 충족, 화면 연결 · 배포가 남아 "일부"**, 조건 5 는 출처 라벨 · 숫자 출처 검증은 있으나 가정 목록 사본(A-32~A-34 누락) · 공백 상태 표시(BE-11 · BE-12)가 남아 "일부". 제출 가능 판정은 프론트 2단계 · `npm run check` 통과 · docker 배포 뒤.

### 8-4. 백엔드 새 작업

> **상태 (2026-11-14 갱신(5))**: **BE-15 실행됨** — 2026-11-14 17:19 KST 실제 실행 1회 성공 · 기록 저장 · 재생 API(9-1, LOG-030). **BE-14 는 구현 · 로컬 docker 확인, 실배포 대기** — 수용 기준 · 결과는 [11-3](#11-3-백엔드-작업). 아래 두 행의 "보류" · "사용자 결정 대기"는 그 전 시점의 기록이다.

| ID | 파일 | 할 일 | 수용 기준 |
|---|---|---|---|
| **BE-11** | `domain/registry.ts` · `assumptions` 시드 · `server/db/schema.ts` 주석 | 가정 목록 사본에 **A-32 · A-33 · A-34** 추가(문구는 5절). 스키마 주석 "A-01~A-31" 정정 | `GET /api/data-registry` 의 `assumptions` 가 A-01~A-34 34개. S-12 가정 탭에 A-32 가 보인다(지금은 없음 — S-10 비교표 배지가 가리키는 가정이 S-12 에 없는 상태). `tests/api/presets-errors` 의 "가정 31개" 기대값도 34 로 |
| **BE-12** | `server/views` `registryView` · `api-types` `RegistryView` | 공백 상태를 `open: boolean` 대신(또는 함께) `status: 'OPEN' \| 'FILLED_BY_MOCK'` 로. 모의 회신으로 채워진 공백(G-02 에이전시 정보 제공 A-33 · G-03 수령확인 · G-08 SCM 회신)은 `FILLED_BY_MOCK` + 처리 문구 "모의 회신으로 보완 — 원본 공백은 그대로". 원본 공백을 "해소"로 돌려주지 않는다 | ① S1-6 뒤 G-03 = `FILLED_BY_MOCK`, 에이전시 `INFO_PROVIDED` 뒤 G-02 = `FILLED_BY_MOCK`, 시드에서는 셋 다 `OPEN`. 어떤 경우에도 G-xx 가 "닫힘/해소"로 오지 않는다 |
| **BE-13** | `server/views` (`InventoryView.replenishments` · 이력 표시용) | 보충요청 종결 문구를 서버가 준다: `statusText` = "SCM 검토: 불필요로 종결 (승인 거절 아님)" / "SCM 검토: 보충 불가로 종결 (승인 거절 아님)" / "승인 거절" / 그 밖 상태 이름. 화면이 사유 문자열을 파싱하지 않게 한다 | ④-a · SCM 거절 · ④-b 세 경우 `statusText` 가 각각 위 문구 |
| **BE-14** | `axhub.yaml`(루트) · Dockerfile · 시작 스크립트 | **사용자 결정 대기**: 원본 CSV 포함 방식 A/B/C([TECH_STACK 5절](TECH_STACK.md#5-남은-결정--후속-작업)). 결정 뒤 `deploy_method: docker` · `database: engine: postgres` 로 바꾸고, 시작 시 `db:migrate`(tsx 를 런타임에 쓰면 devDependencies 포함 또는 JS 빌드), B 면 배포 후 `db:load-raw` 1회 | 배포 주소에서 `GET /api/meta` 가 `persistence: POSTGRES` 와 `rawSource`(A 면 `FILES`, B 면 `DB`)를 돌려준다. 원본 CSV 가 웹 공개 경로로 내려받아지지 않는다. **(2026-11-14 추가)** 배포 런타임에 `AOURA_AI_MODE=mock` 을 두어 `aiMode: MOCK` — 크레딧 없는 키로 실시간 호출을 시도해 실패 경고(`fallbackReason`)가 시연 화면에 뜨지 않게 한다(9-1) |
| **BE-15** | `server/ai/*` (코드 변경 없을 수 있음) | **보류 (2026-11-14 사용자 결정 — 9-1)**. 시연 필수 아님, 시연은 모의 판단안. 다시 열면: 크레딧 충전 뒤 실시간 판단안 1회 실행: `aiMode = LIVE`, `stopReason` 기록, `provenance.ok`, 권고 대안이 enum 안 | 실시간 판단안 1건이 저장되고 S-05 에 `실시간` 표시. 실패하면 지금처럼 `MOCK` + `fallbackReason` (오류 원문 · 키 없음) |
| **BE-16** | `server/scenarios.ts`(S1_6 이후 프리셋) · 시나리오 점검 | ① 정상 흐름에서 `DOCUMENT_CONDITIONS`(계약 담당, 7/13 통보 발송과 함께) · `REPORT_TO_GROUP`(Masil 대표, 7/14) 작업을 완료하도록 재생 단계 추가. `S1_7` 점검 항목에 "OVERDUE 작업 0" 추가 | `S1_7` 프리셋 7/18 이동의 `transitions` = 기안 건 5행(CONFIRMED 1 · CANCELLED 4)뿐, OVERDUE 작업 0. `S4` 프리셋(7/20)에도 OVERDUE 작업이 없다. 두 작업을 완료하지 않고 7/18 로 가면 두 작업이 OVERDUE 가 되는 것은 그대로(테스트로 유지) |

### 8-5. 프론트엔드 새 작업 (2단계 FE-01~06 과 함께 또는 바로 뒤)

| ID | 화면 | 할 일 | 수용 기준 |
|---|---|---|---|
| **FE-07** | S-11 | 대상 필터에 `ASSESSMENT`(판단안) · `CASH_FORECAST`(재전망)를 포함한 7종(1-3 AuditLog). 행위자 필터는 `ActorKind` 4종. 같은 상태 유지 행(`from = to`)과 판단안 생성 행(`null → CREATED`)도 사유와 함께 | ② 프리셋에서 재전망 `CF-v1 → CF-v2` 행과 판단안 생성 행이 보인다 |
| **FE-08** | S-05 | 사실은 `name` 으로 표시(값 · 배지 · 출처), `key` 는 숨김. 도구 호출 목록(접힘): 도구명 · 입력 · 반환 · 행위자(`AI` = 모델 호출 / `SYSTEM` = 모의 모드 코드 실행). `fallbackReason` 이 있으면 "실시간 호출 실패 → 모의로 생성: {사유}" 경고. `provenance.ok` 표시. `stubNote` 는 없어졌다 | 모의 판단안에서 도구 호출 행위자가 `SYSTEM` 으로, `모의` 배지와 함께 보인다 |
| **FE-09** | S-02 외부 회신 · S-03 통보 탭 · S-07/S-09 | 양식 조합 제한: SCM · Corevia 에는 「수령확인」을 숨김, SCM 「정보 제공」이면 보충 필요 여부 필수, 입고 예정일은 SCM · Corevia 만. 응답 `transitions` · `createdTasks` 를 결과 패널로. 404(맞는 열린 작업 없음) · 422 메시지는 그대로 표시. 에이전시 정보 제공 뒤 S-03 성과 피 칸은 `모의` 배지 문구(G-02 링크 유지) | SCM 거절 회신 뒤 S-04 PLAN-011 권고가 부결로, 보충요청 문구가 "보충 불가로 종결"로 보인다 |
| **FE-10** | S-12 | 가정 탭은 API 목록 그대로(BE-11 뒤 A-01~A-34). 공백 탭은 `status` 2가지 표시 — `OPEN` "미확인", `FILLED_BY_MOCK` "모의 회신으로 보완 — 원본 공백 그대로"(BE-12 뒤). "해소" 문구는 쓰지 않는다 | ① S1-6 뒤 G-03 이 "모의 회신으로 보완"으로 보이고 사라지지 않는다 |
| **FE-11** | 공통 오류 처리 | `{error:{code,message,details?}}` 의 `message` 를 그대로 표시. `CONFLICT`(409) 는 "상태가 바뀌어 다시 만들어야 합니다" + [다시 만들기], `INTERNAL`(500) 은 일반 문구 + 재시도. 오류 뒤 숫자를 캐시로 대신 보여주지 않는다(S-01 오류 규칙) | 판단안 생성 중 다른 탭에서 회신하면 409 안내가 보이고 상태가 섞이지 않는다 |

## 9. 2단계 프론트엔드 반영 · 쓰기 권한 · 실시간 AI 보류 (2026-11-14)

기준: 프론트엔드 2단계 보고(devlog LOG-017), devlog README 「열린 확인 필요」, DD-035~039, 코드 읽기(`app/src/app/**` — `assessments/[id]/page.tsx` · `events/event-forms.tsx` · `scenarios/page.tsx` · `tasks/task-actions.tsx`, `app/src/components/**` — `approval/reply-panel.tsx` · `shell/clock-dialog.tsx` · `mutation/result-dock.tsx`, `app/src/server/service.ts` · `domain/workflow.ts` 의 쓰기 경로). 실행 결과는 메인 세션 재검증(LOG-017, 14:29 — `npm run check` 222 통과 · 2 건너뜀, `next build` 종료 0, 화면 캡처 42장은 저장소 밖)을 인용했고, 기획은 이번에 아무것도 실행하지 않았다.

### 9-1. 사용자 결정 — AI 방식 (b): 실제 실행 1회 + 기록 재생

> 2026-11-14 16:23 의 첫 결정("실시간 AI 확인 보류 · 시연은 모의", DD-040)을 같은 날 17:11 의 사용자 결정 **(b)** 가 대체했다(DD-049 · DD-050). 이 절은 (b) 기준으로 다시 썼다(갱신(5)). 근거: 기획이 `app/src/server/ai/recorded/index.ts` · `rec-001-contract.json` · `domain/api-types.ts` · `tests/api/recorded-run.test.ts` 를 읽어 확인했고, 2026-11-14 17:28 에 `npm run check` 를 직접 실행해 통과(24 파일 · 1 건너뜀, 291 통과 · 2 건너뜀)를 확인했다. 실행 경위(크레딧 · 재시도)는 devlog LOG-030 인용. **기획은 AI 를 호출하지 않았다.**

- **결정 (2026-11-14, 사용자)**: 실제 Claude(`claude-opus-5-5`)로 판단안을 **한 번만** 만들고 그 실행을 기록으로 남긴다. 이후에는 AI 를 다시 호출하지 않고 시연에서 **기록을 보여주기만** 한다. 배포 · 시연 런타임은 `AOURA_AI_MODE=mock`.
- **이유**: ① 심사 관점("AI의 역할이 실제 판단과 처리에 사용", "AI가 맡는 역할과 실제 입력 · 출력")에 실제 입력 · 출력 증거를 댄다 — 아래 증거 표 ② 시연 중 호출 비용 · 지연 · 실패 경고를 없앤다 ③ 프리셋 재생의 결정성(같은 결과)을 지킨다.
- **시연 흐름에 영향이 없는 이유**(그대로): 계산 · 권한자 · 건별 권고 · 상태 전이는 규칙 코드가 정한다(1-3 Assessment — AI 가 정하는 것은 문장과 계약 대안 권고 하나). 모의 모드에서도 같은 도구를 코드가 실행하고(`toolCalls[].actor = 'SYSTEM'`) 숫자 출처 검증을 거친 판단안이 승인요청 → 회신 → 상태 변경 → 다음 판단으로 이어진다.

**실제 실행 1회 — 기록에서 확인한 사실** (`rec-001-contract.json`, 기록 ID `REC-001`)

| 항목 | 값 | 기록의 위치 |
|---|---|---|
| 실행 시각 | 2026-11-14 17:19:46 ~ 17:20:07 KST (약 21초) | `executedAt` · `finishedAt` (UTC 08:19:46 ~ 08:20:07) |
| 모델 | `claude-opus-5-5` — 요청 값이 아니라 **API 응답의 model 필드** | `assessment.aiTrace[].model` |
| 호출 설정 | 공식 SDK `@anthropic-ai/sdk` · thinking `adaptive` · effort `medium` · max_tokens 16,000 · 도구 6개 모두 `strict` | `request` |
| 입력 상태 | 시드(2026-07-01 09:00) → 갱신 통보 접수(계약 「검토 중」). **기안 접수 전** | `scenario.steps` |
| 실행 경로 | route handler 직접 호출(route → service → PgStore → SDK), 저장소 로컬 Postgres, 원본은 파일. **HTTP 서버 · 배포 환경이 아니다** | `scenario.invokedVia` · `persistence` · `rawSource` |
| 모델 응답 | 2회 — ① `stop_reason: tool_use`, 입력 1,985 · 출력 154 토큰 ② `tool_use`, 입력 5,532 · 출력 1,472 토큰. 응답별 메시지 ID 기록 | `assessment.aiTrace` |
| AI 가 부른 도구 | `get_facts`(전체) · `get_rule_results` · `get_alternatives` · `get_open_gaps` · `get_claims` → `submit_assessment`. 6건 모두 `actor: 'AI'`, 입력 · 반환값 전체 기록 | `assessment.toolCalls` |
| AI 가 받은 정보 | 사실 19건(출처 라벨 · 스케일 포함) · 규칙 결과 3건(R-AUTH-02 → 그룹 CEO/이사회 · 연 금액 하한, R-DL-03 → D-16 정보 단계, R-DL-02 → 유효 통보 없으면 자동 갱신) · 대안 A/B/C · 공백 5건(G-01 · 02 · 03 · 04 · 09 모두 `OPEN`) · 주장 3건(회의록 — "판단 근거 아님" 표시) | `toolCalls[].output` · `facts` · `ruleResults` · `alternatives` · `unknowns` · `claimsCited` |
| AI 가 만든 결과 | 권고 대안 **B(조건변경 통보)** + 권고 이유 + 마케팅 · 재무 · 계약 · SCM 관점 문장 | `recommendation` · `perspectives` |
| 검증 | 숫자 출처 검증 **통과**(위반 0건), 모의 대체 없음(`fallbackReason` 없음) | `provenance` |
| 이어진 처리 | 승인요청 `APR-001` 생성 — 권한자 그룹 CEO/이사회(R-AUTH-02, **규칙이 정함**), 권고 `RENEGOTIATE`, 내부 기한 7/15 · 원본 기한 7/17, 근거 판단안 `ASM-001`. 이력 4행(계약 접수 `HUMAN` → 판단안 생성 `AI` → 승인요청 생성 `SYSTEM` → 계약 「승인 대기」 `SYSTEM`) | `followUp` |
| 끝난 지점 | 승인요청 `PENDING` — **권한자 회신은 그 실행에 없다** | `followUp.approvalRequests[0].status` |

- 실행 경위(LOG-030 인용, 기획 미재확인): 사용자가 API 크레딧을 충전했고, 첫 시도는 400(크레딧 부족), 재시도 1회로 성공했다. 성공한 실행만 기록했다.
- 기록 파일에는 키 · 요청 헤더 · 접속 문자열이 없다(테스트 "기록 파일에 키 · 헤더 · 접속 문자열이 없다").

**기록 재생 — 실시간이 아니다 (표시 규칙)**

재생은 `GET /api/assessments/recorded` → `RecordedRunsResponse {runs: RecordedRunView[]}`. **이 응답을 만들 때 AI 를 호출하지 않고, 운영 상태(`sim_state`)를 읽거나 바꾸지 않는다**(원본 데이터셋으로 근거 대조만 — 테스트 "운영 상태에 끼워 넣지 않는다 — 판단안 목록 · 이력 · 상태 버전 · meta.aiMode 불변").

| # | 규칙 | 이유 |
|---|---|---|
| 1 | 표지는 **`기록 재생`** — 화면 문구는 「실행 기록 · 재생」(프론트엔드 구현을 채택, 이 문서의 `기록 재생` 은 그 표지를 가리킨다)(`aiMode = 'RECORDED'`). `실시간` · `모의` 를 쓰지 않는다. 서버 문구 `label` — "실제 Claude 실행 기록(2026-11-14 17:19, claude-opus-5-5) — 재생, 지금 호출하지 않음" — 을 그대로 보인다 | 그 실행은 실제 호출이었지만 지금 화면에 보이는 것은 재생이다. `실시간` 이라고 쓰면 "지금 모델이 만든다"로 읽힌다 |
| 2 | **운영 화면과 섞지 않는다** — 기록의 판단안 `ASM-001` · 승인요청 `APR-001` · 이력 4행은 그 실행 때 생긴 것의 **사본**이다. 운영 판단안 목록(S-03 · S-05) · 승인함(S-06) · 작업(S-07) · 처리 이력(S-11)에 넣지 않고, 기록 안의 ID 를 운영 화면 링크로 만들지 않는다(같은 번호가 지금 운영 상태의 다른 것을 가리킬 수 있다) | 운영 이력은 "지금 이 시스템에서 일어난 일"의 증거다. 기록을 끼워 넣으면 시연 중 AI 가 만든 것처럼 보이고 프리셋 결정성도 깨진다(DD-050) |
| 3 | 헤더의 `AI: 모의` 는 그대로다(`GET /api/meta` `aiMode: MOCK`). 기록 재생 화면에서도 "지금 이 시스템의 [판단안 만들기] 는 모의로 동작한다"를 함께 적는다 | 기록 화면만 보고 운영 판단안도 실제 AI 문장으로 오해하지 않게 |
| 4 | **`basisCheck`** 를 보인다 — 기록의 사실 · 규칙 결과 · 대안 · 공백 · 규칙 권고 · 주장 인용이 **지금 규칙 계산(같은 입력: 시드 → 통보 접수)** 과 같은지 서버가 매번 대조한 결과. `ok = false` 면 `mismatches` 를 경고로 보인다(숨기지 않는다) | 규칙 · 원본이 바뀌면 기록은 낡은 증거가 된다. 조용히 통과시키지 않는다(테스트 "근거 값이 달라지면 불일치로 드러난다") |
| 5 | 기록 파일은 **고치지 않는다**(문장 다듬기 · 숫자 자릿수 정리 포함). 화면도 문장을 원문 그대로 보인다 | 증거의 무결성. 예: 관점 문장에 "명목 ROAS 1.3627673894502679" 처럼 도구가 준 값이 자릿수 그대로 인용돼 있다 — 보기 좋지 않지만 그대로 둔다(아래 한계 ⑤) |
| 6 | 기록의 범위를 화면에 적는다 — "실행 1회 · 계약 판단안 1건 · 승인요청 생성까지" | 아래 한계 |

**심사 관점에 대해 무엇을 증거로 제시하는가**

대상 문구: `A01.html` 심사 관점 「작동하는 운영 시스템」 "운영 중 **AI의 역할이 실제 판단과 처리에 사용**되고, 사람 · 도구와 연결되어 …" · `A04.html` 자기점검 "운영 중 **AI가 맡는 역할과 실제 입력 · 출력**이 사람의 결정 · 도구 실행 · 후속 처리에 쓰이는 모습을 보여줄 수 있다" · PROBLEM 4-1 여섯 관점 「AI · 사람 · 도구의 운영 역할」.

| 묻는 것 | 우리의 답 | 증거 (어디서 보나) | 구분 |
|---|---|---|---|
| **AI 가 받는 정보** | 조회 도구 5개의 반환값 — 사실(출처 라벨 · 스케일) · 규칙 결과 · 대안 · 공백 · 주장(참고 전용). 원본 파일을 직접 읽지 않고, 규칙 코드가 계산한 값만 받는다. 시스템 지시 · 사용자 요청 문장도 기록 | 기록 재생 화면 「AI 입력」 — `request.system` · `request.user` · `request.tools` · `toolCalls[0..4]` 입력 · 반환값 | 실제 작동 (1회) · 기록 재생 |
| **AI 가 만드는 결과** | 계약 대안 권고 하나(enum 제한 — 기록에서는 **B**)와 문장(권고 이유 · 관점 4개). 숫자 · 권한자 · 건별 권고는 만들지 않는다 | 「AI 출력」 — `toolCalls[5]`(`submit_assessment` 입력) · `recommendation` · `perspectives` · `aiTrace`(메시지 ID · 모델 · stop_reason · 토큰) | 실제 작동 (1회) · 기록 재생 |
| **검증** | 숫자 출처 검증 — 문장의 숫자가 도구 반환값에 있는지 코드가 검사. 통과 못 하면 저장하지 않고 모의 문장으로 대체 | 「검증」 — `provenance.ok = true` · 위반 0, `basisCheck`(지금 규칙 계산과 일치). 위반 시 대체는 단위 테스트(`tests/unit/agent.test.ts`) | 실제 작동 |
| **사람** | 결정은 권한자 회신으로만 확정된다(R-AUTH-05). AI 는 어떤 상태도 바꾸지 않는다(상태 변경 도구 없음). 기록의 실행은 승인요청 `PENDING`(그룹 CEO/이사회 회신 대기)에서 끝났다 | 「사람 회신 대기」 — `followUp.approvalRequests[0]`. 회신 이후(승인 · 반려 · 조건부 → 상태 변경 → 다음 판단)는 운영 화면 시연 ①~④(S-06 · S-07 · S-11) | 기록: 실제 작동 (1회) / 회신: **모의 처리** |
| **도구** | 규칙 엔진(권한 · 기한 · 공헌이익 · 재고 · 재전망)과 상태 전이. 승인요청의 권한자 · 기한은 규칙이 정했다 | 「승인요청」 — `routingReasons`(R-AUTH-02) · 이력 4행의 행위자(`HUMAN` · `AI` · `SYSTEM`). 운영 화면 S-05 도구 호출 목록 · S-11 | 실제 작동 |
| **후속 처리에 쓰이는가** | 판단안이 승인요청의 근거(`assessmentId`)가 되고, 권고 대안의 결정이 요청의 권고안(`proposed`)이 된다 | `followUp.approvalRequests[0].assessmentId = ASM-001` · `proposed = RENEGOTIATE`. 운영 화면에서는 모의 판단안으로 같은 연결(S-05 → S-06) | 실제 작동 |

**실제 작동 / 모의 처리 / 설계 단계 — 구분표 (제출 설명 · 자기점검용, 2026-11-14 4단계 뒤)**

`A04` 정의: 실제 작동 = 입력에 따라 구현이 직접 처리 / 모의 처리 = 가상의 외부 회신 · 승인 · 집행 / 설계 단계 = 설명 · 명세만. 「확인」 열은 기획이 직접 확인한 것과 인용을 구분한다.

| 구간 | 구분 | 증거 | 확인 |
|---|---|---|---|
| 원본 읽기(17 파일) · 출처 라벨 · 스케일 구분 | **실제 작동** | S-12, `Sourced` 값 | 테스트 통과(기획 직접 실행, 291) |
| 규칙 계산 — 승인 권한(R-AUTH) · 기한(R-DL) · 실질 공헌이익(A05) · 재고 커버 · 자금 재전망 · 위약금 | **실제 작동** | 단위 테스트 · 골든 값(DEMO 부록 A), S-08 ~ S-10 | 테스트 통과 |
| 상태 전이 · 기한 감시 · 작업 생성 · 처리 이력 | **실제 작동** | 시나리오 테스트 ①~④, S-11 | 테스트 통과 · 화면은 LOG-017 · 023 인용 |
| 권한 검사 — 승인 회신 · 작업 처리 · 보충 초안(서버 422) | **실제 작동** | S-06 · S-07 [권한 검증 확인], `tests/api/role-guard.test.ts` | 테스트 통과 |
| 조건 변경 처리 — 재전망 → 권한 재판정 → 재승인 요청 | **실제 작동** (입력 사건은 모의) | ② , S-10 | 테스트 통과 |
| 저장 — Postgres(운영 상태 · 낙관적 잠금) | **실제 작동 (로컬 · 로컬 docker)** · 배포 환경(트랜잭션 풀러)은 **미확인** | `GET /api/meta` `persistence` | 로컬 docker 는 백엔드 보고 인용. 실배포 전(DEPLOY.md) |
| AI 도구 실행(조회 5 + 제출 1) · 숫자 출처 검증 · 실패 시 모의 대체 | **실제 작동** | S-05 도구 호출 목록 · `provenance` | 테스트 통과 |
| **AI 판단안 — 실제 Claude 가 도구로 근거를 조회해 권고 · 문장 작성** | **실제 작동 — 1회 실행 확인(2026-11-14 17:19 KST, 계약 판단안), 시연은 기록 재생** | 기록 `REC-001` · 기록 재생 화면(S-05R) · `GET /api/assessments/recorded` | 기록 파일 직접 확인 · 재생 테스트 10건 통과. 화면 구현됨(프론트엔드 보고). **알려진 결함 — 수정 중(BE-25)**: 번들 서버에서 `basisCheck` 불일치 경고 |
| 시연 런타임의 판단안 문장([판단안 만들기] · 프리셋 재생) | **모의 처리** — 결정적 문장(코드), 화면 `모의`. 숫자 · 권고 등급 · 권한자는 규칙 계산(실제 작동) | S-05 `AI: 모의` | 테스트 통과 |
| 권한자 회신(Masil 대표 · 그룹 CEO/이사회 · SCM 승인) | **모의 처리** — 사람이 역할을 바꿔 입력. 거절 · 정보 요청 · 조건부 포함 | S-06, S-12 모의 목록 | 테스트 통과 |
| 에이전시 회신(수령확인 · 정보 제공 · 정보 부족 · 거절) · SCM · Corevia 회신(보충 필요 · 불필요 · 불가 · 정보 부족) | **모의 처리** | S-02 · S-03 · S-07, S-12 | 테스트 통과 |
| 회수 지연 통보 · 집행일 변경 등 조건 변경 사건 | **모의 처리** | S-02 | 테스트 통과 |
| 통보 발송 · 재통보 · 그룹 보고 · 승인조건 문서화의 **실제 집행** | **모의 처리** — 작업 완료 기록만 남고 외부로 나가는 것은 없다 | S-07 | — |
| 가상 기준시각 · 시점 이동 | **모의 처리**(가정 A-21) — 실제 날짜가 아니다 | 헤더 · S-01 | 테스트 통과 |
| 사람의 신원 확인(로그인) | **없음 · 설계 단계** — 역할 전환은 시연 장치. 서버는 요청의 역할 값을 검사할 뿐 누구인지는 확인하지 않는다 | 1-3 쓰기 행위별 허용 역할 | — |
| 실제 Claude 로 기안 묶음 · 보충요청 판단안, 재판단(v2) 작성 | **설계 단계** — 코드 경로는 계약 판단안과 같지만 실제 실행 기록이 없다(모의 클라이언트 테스트만) | `server/ai/*` | — |
| 시연 · 배포 환경에서 판단안을 실시간으로 생성 | **설계 단계(의도적으로 끔)** — 키는 등록돼 있고 `AOURA_AI_MODE` 를 빼면 켜지지만, 배포 환경에서 실행한 적이 없다 | TECH_STACK 2-4 | — |
| 통보문 · 상신문 초안 작성(TECH_STACK 2-2 ⑤) · 검토 에이전트(2-3) | **설계 단계** — 구현 없음 | — | — |
| 배포 주소에서의 동작 | **미확인** — 실배포 전. 배포 구성은 구현 · 로컬 docker 확인까지(BE-14) | DEPLOY.md | — |

요지: **규칙 계산 · 상태 전이 · 권한 검사는 실제 작동, 권한자 · 에이전시 · SCM 회신과 조건 변경 사건은 모의 처리, AI 판단안은 실제 작동(1회) + 기록 재생, 시연 런타임의 판단안 문장은 모의 처리.**

**한계 — 제출 설명에서 숨기지 않을 것**

1. 실제 실행은 **1회 · 계약 판단안 1건**이다. 기안 묶음 · 보충요청 판단안과 재판단(v2)은 실제 AI 로 실행한 기록이 없다.
2. 그 실행은 **승인요청 생성까지**다. 실제 AI 판단안에 사람이 회신해 상태가 바뀌는 장면은 기록에 없다 — 그 구간은 모의 판단안으로 같은 코드 경로를 시연한다.
3. 실행 환경은 **로컬**(route handler 직접 호출 · 로컬 Postgres)이다. 배포 환경에서 실행한 것이 아니다.
4. AI 권고(B)는 규칙이 낸 권고(`RENEGOTIATE`)와 **같았다**. AI 가 규칙과 다른 대안을 고른 실제 사례는 없다(고를 수 있는 대안은 제출 도구의 enum 으로 제한 — 단위 테스트로 확인).
5. AI 문장에 도구 값이 자릿수 그대로 인용된 곳이 있다(명목 ROAS · 실질 ROAS 소수 16자리). 숫자 출처 검증은 통과했다 — 틀린 숫자가 아니라 읽기 불편한 표기다. 기록은 고치지 않는다.
6. 시연 중에 누르는 [판단안 만들기] 는 **모의**다. "지금 AI 가 판단하고 있다"고 말하지 않는다.
7. `A01.html` 5절 · `A03.html` FAQ 의 "승인 · 발주 · 통지 등 **외부 업무는 모의 처리**로 시연할 수 있습니다"는 외부 업무에 대한 허용이다. 시연 런타임의 판단안 문장이 모의인 근거로 이 문구를 쓰지 않는다 — 근거는 위 사용자 결정과 실제 실행 기록이다.

- **반영한 곳**: 0 표기 · 1-3 Assessment · 8-4 · 11절, [TECH_STACK 2-3 · 2-4 · 5](TECH_STACK.md#2-4-claude-사용-방식), [DEMO 0-2 · 0-4 · 0-6 · 1 시드 · 5-1](DEMO_SCENARIOS.md), [SCREEN_SPEC 0-1 · S-05 · S-05R · 4절](SCREEN_SPEC.md).

### 9-2. 프론트엔드가 문서와 다르게 만든 6건 — 판정 (LOG-017)

| # | 다른 점 (코드 위치) | 판정 | 이유 · 조건 | 반영 |
|---|---|---|---|---|
| ① | 기안 접수에 건 범위 선택 없음 — 25건 전체 접수 (`events/event-forms.tsx`). 백엔드가 범위 선택을 검토 중 | **문서를 코드에 맞춤 — 범위 선택을 없앤다** | 권한 판정 기안 총액 = 25건 합(R-AUTH-01). 일부만 접수하면 7/17 묶음(70,902,290 < 1억)처럼 총액이 1억 이하로 내려가 건별 1천만 이하 건이 마케팅팀 전결로 바뀐다 — 입력 범위로 승인 권한 제약을 없애는 셈(CLAUDE.md 규칙 7). 판단 범위는 S-04 행 선택 → 판단안이 나눈다. **백엔드는 범위 선택을 넣지 않는다**(BE-20) | 1-3 Event · SCREEN_SPEC S-02 · 4절 · DEMO S1-1 |
| ② | 시점 이동 모달의 시연 시각 바로가기 6개(7/10 14:00 · 7/13 10:00 · 7/14 11:00 · 7/17 09:00 · 7/18 00:00 · 7/20 09:00, `shell/clock-dialog.tsx`) | **채택** | 입력 편의일 뿐 계산값이 아니고, 미리보기(`GET /api/clock/preview`)를 거쳐야 이동하며 과거는 서버가 409 로 막는다. 조건: 시각은 DEMO_SCENARIOS 의 사건 시각과 같아야 한다. ②(7/14 10:00 · 7/15 15:00)와 ③(7/13 16:00 · 7/15 · 7/16 10:00 · 7/17 15:00) 시각이 빠져 있어 ③ 화면 검증 전에 추가 권장(FE-14) | SCREEN_SPEC S-01 |
| ③ | S-06 [권한 검증 확인] 버튼 — 권한 없는 역할로 같은 요청에 승인을 실제 전송해 서버 422 문구를 보여줌, 상태 불변 (`approval/reply-panel.tsx`) | **채택** | UI-04 의 「서버 422 를 같은 문구로 표시」와 완료 조건 1 의 권한 경계(R-AUTH-05)를 화면에서 증명하는 유일한 방법이다(버튼 비활성만으로는 서버 검사를 보여줄 수 없음). 조건: `PENDING` 요청 · 권한 없는 역할에서만 보이고, 응답 문구를 그대로 보이며, 상태 버전이 바뀌지 않았음을 표시한다. 서버 검사가 깨지면 실제로 승인돼 버리는 진짜 시험이므로 결함을 숨기지 않는다 — 그게 이 버튼의 목적 | SCREEN_SPEC S-06 · DEMO S1-5 |
| ④ | 결과 보관함 — 처리한 행이 재조회 뒤 목록에서 사라지는 화면(작업 · 승인함)에서 마지막 결과 패널을 화면 위에 고정 (`mutation/result-dock.tsx`, DD-037) | **채택** | UI-05(쓰기 뒤 결과 패널)를 행이 사라지는 화면에서도 지키는 방법. 조건: 같은 화면(경로)에서만 · 마지막 1건 · 닫기 가능 · 브라우저 메모리라 새로고침하면 사라짐 — 영구 증거는 S-11 처리 이력이다 | SCREEN_SPEC 0-4 |
| ⑤ | S-13 수용 기준 점검은 **현재 지점(마지막 재생 프리셋)만** (`scenarios/page.tsx`) | **채택 — 「4개 시나리오 전체 진행률」 요구를 뺀다** | 서버 상태가 하나라(DD-039) 다른 프리셋을 점검하려면 그 프리셋을 재생해야 하고, 그러면 지금 상태가 바뀐다. 현재 상태를 다른 프리셋 기준으로 점검하면 ✗ 가 나와 오해를 부른다. 시나리오 전체 통과 증거는 `npm run check` 의 시나리오 테스트(①~④)가 맡는다 | SCREEN_SPEC S-13 |
| ⑥ | 실시간 AI 근거 문장에 `원본근거해석` 배지 (`assessments/[id]/page.tsx` — `a.mock ? 'MOCK' : 'INTERPRETED'`) | **기각** | `원본근거해석` 은 원본 문구를 근거로 정한 해석이고 근거 문구를 함께 보여야 한다. AI 문장에는 하나의 근거 문구가 없어 원본에 근거한 사실처럼 보인다. 실시간 문장은 출처 배지 대신 「AI 작성」 표지(0 표기). 실시간 경로가 보류라 시연 화면에는 나오지 않음 → FE-12(우선순위 낮음) | 0 표기 · SCREEN_SPEC S-05 |

### 9-3. 쓰기 행위별 허용 역할 — 요지

표는 [1-3 쓰기 행위별 허용 역할](#쓰기-행위별-허용-역할-2026-11-14). 서버가 역할을 검사하는 쓰기는 셋이다.
1. **승인 회신** — `requiredRole` · 건별 현재 권한자만(원본 정책 · R-AUTH-05, 구현됨).
2. **작업 상태 변경** — 작업 담당 `ownerRole` 만, `actorRole` 필수(A-35, BE-17). SCM 보충 검토 작업은 `PATCH` 완료 불가 — SCM 보충 검토 회신으로만(BE-18).
3. **보충요청 초안 생성** — SCM 만, `actorRole` 필수(A-35, BE-17). 백엔드 진행 중 작업본(`domain/permissions.ts` — 미커밋)이 이미 이렇게 막고 있어 문서를 맞췄다.

나머지(외부 회신 입력 · 사건 입력 · 판단안 생성 · 승인요청 상신 · 시점 이동 · 시나리오 리셋)는 결정을 확정하지 않거나 시연 운영 행위라 검사하지 않는다(A-36). 화면은 업무상 행위자 역할에서만 버튼을 보이되, 서버 보장은 위 둘이다. 백엔드가 "기획 결정 필요"로 보고할 `PATCH /api/tasks` 의 근거 없는 경우는 A-35 로 답한다 — **담당 외 역할은 어떤 작업도 처리할 수 없다**(그룹 CEO/이사회가 계약 담당 작업을 처리하는 것도 불가. 상위 권한자가 대신 처리하는 위임 규정은 원본에 없다).

### 9-4. 완료 조건 재판정

점검표는 [DEMO_SCENARIOS 0-2](DEMO_SCENARIOS.md#0-2-완료-조건-점검-2026-11-14-4단계-뒤)(판정 단계에 「로컬 충족」 추가). 요지: 조건 3 · 4 · 5 는 **로컬 충족**(로컬 화면에서 증거 확인, 배포 주소 미확인), 조건 1 · 2 는 **일부**(1: 배포 · 작업 처리 서버 권한 검사 남음, 2: ③ 화면 미검증). 제출 가능 판정은 배포(BE-14 — 원본 CSV 포함 방식 사용자 결정 대기) · ③ 화면 검증(FE-13) · BE-17 뒤.

### 9-5. 백엔드 새 작업

> **상태 (2026-11-14, LOG-022)**: BE-17 · BE-18 · BE-19 · BE-20 **구현됨**(코드 확인: `domain/permissions.ts` · `workflow.ts` `completeTask` · `server/service.ts` `patchTask` · `createReplenishment`, 테스트 `tests/api/role-guard.test.ts`). BE-14 는 사용자 결정 대기, BE-15 는 보류 그대로(이 문장은 3단계 시점 — 4단계에서 BE-15 실행됨 · BE-14 A안 확정, 11절).

| ID | 파일 | 할 일 | 수용 기준 |
|---|---|---|---|
| **BE-17** (진행 중 — 작업본 `domain/permissions.ts` · `tests/api/role-guard.test.ts`, 미커밋) | `server/service.ts`(`patchTask` · `createReplenishment`) · `domain/workflow.ts`(`startTask` · `cancelTask` · `completeTask`) · `tests/api/` | `PATCH /api/tasks/:id` 담당 역할 검사 + `POST /api/replenishment-requests` SCM 검사(A-35). `AI_AGENT` · `SYSTEM` 은 행위자 불가. `actorRole` 필수 — 없으면 422 `VALIDATION`(지금처럼 `ownerRole` 로 채우지 않는다). `actorRole ≠ ownerRole` 이면 422 `FORBIDDEN_ROLE` "권한 없음: 이 작업은 {담당 역할 이름}만 처리할 수 있습니다 (요청 역할 …)". 검사는 상태 변경 전에 끝낸다. 프리셋 재생(도메인 함수 직접 호출)은 담당 역할로 재생되므로 영향 없음을 테스트로 확인 | ① `SEND_NOTICE`(계약 담당)를 `MARKETING_TEAM` 으로 완료 → 422 `FORBIDDEN_ROLE`, 계약 `NOTICE_PENDING` 그대로, `stateVersion` 불변, 이력 추가 없음. `actorRole` 없이 완료 → 422 `VALIDATION`. `CONTRACT_OFFICER` 로 완료 → 200, 계약 `NOTICE_SENT`. 시작 · 취소도 같은 검사. 그룹 CEO/이사회가 Masil 대표 담당 작업(그룹 보고)을 처리해도 422(권한자라도 담당이 아니면 거부). 보충 초안: 마케팅팀 → 422 · 초안 수 · 버전 그대로, `actorRole` 없음 → 422 `VALIDATION`, SCM → 201 초안 3건. `S1_7` 등 모든 프리셋 점검 결과 그대로 |
| **BE-18** | `domain/workflow.ts`(`completeTask`) · 테스트 | SCM `REPLENISHMENT_REVIEW` · SCM `INFO_REQUEST` 를 `PATCH` 로 `DONE` 하면 409 `INVALID_TRANSITION` "SCM 보충 검토 회신으로 닫습니다 (S-07 · S-09 [보충 검토 회신])". 시작 · 취소(사유)는 허용 | ④ 초안 생성 뒤 SCM 이 `REPLENISHMENT_REVIEW` 를 `PATCH DONE` → 409, 초안 `DRAFT` · 작업 `OPEN` 그대로. SCM 보충 검토 회신으로는 지금처럼 닫힘 |
| **BE-19** | `domain/registry.ts`(가정 목록 사본) · 테스트 기대값 | 가정 A-35 · A-36 추가(문구는 5절) | `GET /api/data-registry` 의 `assumptions` 가 A-01~A-36 **36개**. `tests/api` 의 34 기대값을 36 으로 |
| **BE-20** | `server/service.ts`(`postEvent` `EXPANSION_PROPOSAL_RECEIVED`) · `domain/types.ts` 주석 | 기안 접수 범위 선택을 **넣지 않는다**(9-2 ①). payload 에 `lineIds` 가 있으면 422 `VALIDATION` "기안은 25건 전체로 접수합니다 (권한 판정 기안 총액 — R-AUTH-01)". 이벤트 타입 주석의 `lineIds?` 삭제 | `{proposalId, lineIds:['PLAN-001']}` → 422, 상태 불변. `{proposalId}` → 25건 접수(지금 그대로) |
| BE-14 (보강) | 배포 설정 | 런타임 env `AOURA_AI_MODE=mock`(비밀값 아님) — 8-4 BE-14 수용 기준에 추가 | 배포 `GET /api/meta` 가 `aiMode: MOCK` |
| BE-15 | — | **보류**(9-1). 사용자가 (b) 를 고르면 그때 1회 실행 | — |

### 9-6. 프론트엔드 새 작업

> **상태 (2026-11-14, LOG-023)**: FE-12 · FE-13 · FE-14 **완료**. FE-13 화면 검증 결과는 [DEMO 0-3](DEMO_SCENARIOS.md#0-3-수용-기준-검증-상태-2026-11-14-4단계-뒤).

| ID | 화면 | 할 일 | 수용 기준 |
|---|---|---|---|
| **FE-13** | ③ · ④-b 화면 검증 (진행 중) | 시연 ③ 을 화면 조작만으로: `S3_1` 프리셋(또는 ① S1-4 에서 S-06 그룹 CEO/이사회 반려) → S-02 에이전시 「정보 부족」 → S-05 판단안 v2 → (A) S-07 재상신 완료 → S-06 해지 승인 → 통보 발송 → 7/17 09:00 이동 → 재통보 작업 → 수령확인 / (A') 7/18 이동 → `NOTICE_UNCONFIRMED` / (B) `S3_B` 7/18 → `AUTO_RENEWED` · S-03 위약금 계산기. ④-b 는 SCM 「보충 필요」 → 그룹 CEO/이사회 반려 → PLAN-011 부결 권고 | AC-3-01 ~ AC-3-07 · AC-4-06 ④-b 를 화면에서 확인. ③-A' 화면에 "자동 갱신" 문구 없음(FE-03), S-01 ③-B 빨강 카드, 위약금 9/30 → 1,283,333,333 · 12/31 → 933,333,333 [집계 · 풀스케일 · A-15]. 결과를 DEMO 0-3 「화면 확인」 열에 보고 |
| **FE-14** | S-01 시점 이동 · S-02/S-03/S-04 판단안 버튼 · S-07 · S-13 | (1) 시연 시각 바로가기에 ② 7/14 10:00 · 7/15 15:00, ③ 7/13 16:00 · 7/15 · 7/16 10:00 · 7/17 15:00 추가(DEMO 시각과 같게) (2) 에이전시(모의) 역할에서 [판단안 만들기] 숨김(A-36 표) (3) BE-17 뒤 S-07 에서 담당 아닌 역할의 422 문구를 그대로 표시(FE-11 공통 처리로 충분한지 확인) (4) S-13 「현재 지점 점검」 옆에 "다른 시나리오는 재생한 뒤 점검 — 시나리오 전체 통과는 `npm run check` 시나리오 테스트" 안내 (5) **BE-17 과 함께 필수**: S-09 [보충 요청 만들기](`analysis/inventory/create-replenishment.tsx`)가 요청에 `actorRole`(현재 역할)을 보내게 한다 — 지금은 `{triggerLineId, skuIds}` 만 보내 BE-17 뒤 422 `VALIDATION` 으로 ④ 시연이 막힌다 | ③ 화면 검증에 바로가기만으로 필요한 시각이 모두 있다. 에이전시 역할로 판단안 버튼이 보이지 않는다. BE-17 뒤 SCM 역할로 ④ 보충 초안 3건이 만들어진다 |
| FE-12 (선택, 낮음) | S-05 | 실시간 판단안 문장의 `원본근거해석` 배지를 「AI 작성」 표지로 바꾼다(9-2 ⑥). 모의는 `모의` 그대로 | 실시간 판단안(`aiMode = LIVE`)에서 문장 옆에 `원본근거해석` 배지가 없다. 실시간 보류라 시연 영향 없음 |

## 10. 3단계 반영 · 판단 3건 · 재상신 규칙 · 후속 작업 (2026-11-14)

기준: devlog LOG-022(백엔드 3단계) · LOG-023(프론트엔드 3단계) · LOG-025(백엔드 결함 수정), 코드 읽기(`app/src/domain/permissions.ts` · `workflow.ts` `completeTask` · `assessment.ts` · `api-types.ts`, `app/src/server/scenarios.ts` · `service.ts` · `views/index.ts`, `app/src/components/shell/clock-dialog.tsx`), 화면 조작 스크립트(저장소 밖 scratchpad — 밟은 순서만 참고). 기획이 2026-11-14 17:00 경 `npm run check` 를 직접 실행해 **통과**(22 파일 · 1 건너뜀, 259 통과 · 2 건너뜀)를 확인했다. 화면은 직접 돌리지 않았다 — 화면 결과는 LOG-023 인용.

### 10-1. 판단 3건 (프론트엔드 LOG-023 문제 ③ ④ ⑤)

| # | 문제 | 결정 | 이유 | 작업 |
|---|---|---|---|---|
| ⓐ | 에이전시 모의 「정보 제공」 뒤 판단안 v2 의 미확인 목록에서 G-02 가 빠진다. S-12 는 "모의 회신으로 보완 — 원본 공백 그대로"인데 판단안은 해소된 것처럼 보인다 | **미확인 목록에 남기고 상태를 단다** — `unknowns[].status = 'FILLED_BY_MOCK'`, 문구 "모의 회신으로 보완 — 원본 공백은 그대로". G-03(모의 수령확인) · G-08(SCM 모의 회신)도 같은 규칙. S-12 와 같은 판정 함수를 쓴다 | 원본 공백은 모의 회신으로 없어지지 않는다(A-33, CLAUDE.md 규칙 5). 같은 공백이 화면마다 다른 상태로 보이면 원본 · 모의 구분(완료 조건 5)이 흐려진다. 「확인한 사실」에는 모의 값이, 「미확인」에는 "모의로 보완"이 함께 있어야 권한자가 그 값이 원본이 아님을 안다 | BE-21 · FE-15. 1-3 Assessment · A-33 · SCREEN_SPEC S-05 · DEMO AC-3-09 |
| ⓑ | ④ 프리셋(`S4`)에 PLAN-011 판단안이 없어 AC-4-06 "판단안 버전이 올라간다"를 보이려면 회신 전에 v1 을 먼저 만들어야 한다 | **프리셋에 v1 을 넣는다** — `S4` 재생이 보충 초안을 만들기 전에 PLAN-011 판단안(모의, v1 — 조건부 권고)을 기록한다. 구현 전까지는 시연 절차에서 [선택 건 판단안 만들기]로 v1 을 먼저 만든다(DEMO 0-6 진행표에 단계 있음) | DEMO S4-2 의 순서가 "판단(게이트 결과 · 보충 제안) → 보충 초안"이다. 지금 프리셋은 초안만 있고 그 근거 판단이 없어 흐름이 거꾸로다. 프리셋에 넣으면 시연이 한 단계 줄고 `S4` 점검 항목으로 확인할 수 있다. 판단안은 어떤 상태도 바꾸지 않으므로(1-3) 다른 점검 결과에 영향이 없다 | BE-24. DEMO 5절 프리셋 · AC-4-06 |
| ⓒ | ③ 분기 A 에서 재상신을 끝내도 「기한 전 재검토」 작업이 열린 채 남아 기한 경과로 보인다. 승인 뒤 「승인조건 문서화」도 같다 | **「기한 전 재검토」는 재상신 완료 시 자동 종료(`CANCELLED`, 시스템 행위자 + 사유)**. **「승인조건 문서화」는 자동으로 닫지 않고** 시연 절차에 완료 단계를 넣는다(①의 S1-6 과 같은 처리) | 재검토는 재상신을 위한 준비라 재상신이 끝나면 할 일이 없다 — 열린 채 두면 끝난 일이 밀린 것으로 보인다. 완료가 아니라 취소인 이유는 사람이 완료를 기록하지 않았기 때문(3-4). 승인조건 문서화는 BPMN t4 의 사람 업무라 시스템이 했다고 기록하면 거짓이다 — 하지 않으면 OVERDUE 로 보이는 것이 맞다. 백엔드 의견(LOG-025)과 같다 | BE-23. 3-1 · 3-4 · A-35 · DEMO S3-3 · AC-3-10 |

### 10-2. 재상신 권고 · 자동 갱신 경고 — 기준 확정

- **재상신 권고 결정**: 규칙 전문은 [1-3 ApprovalRequest 「재상신 근거 판단안 · 권고 결정」](#approvalrequest). 요지 — 근거 판단안 = 지정한 것 또는 최신 계약 판단안, 권고 = 그 판단안의 권고(상신자 지정이 있으면 그 값, 다르면 표시), **판단안이 하나도 없으면 422 로 거부**. LOG-025 구현과의 차이는 두 가지: ① 판단안이 없을 때 지금은 이전 권고를 유지한다 → 거부로 바꾼다 ② 상신자 지정 결정이 판단안과 다를 때 지금은 표시가 없다 → 이력 사유 · `proposedSource` 를 더한다(BE-22).
- **자동 갱신 위험 경고의 「다음 행동」**: 계약 상태별 표는 [SCREEN_SPEC 0-3-1](SCREEN_SPEC.md#0-3-1-자동-갱신-경고의-다음-행동--계약-상태별-2026-11-14-log-025-구현-확인). LOG-025 구현(`autoRenewalNextAction`)을 코드로 확인했고 표와 같다 — 추가 작업 없음.

### 10-3. 3단계 구현 반영 (문서 정정)

| # | 항목 | 처리 | 반영한 곳 |
|---|---|---|---|
| 1 | SCREEN_SPEC S-01 「8/14(10건) · 9/11(10건)」 | **오기 정정** — 원본 `mkt_budget_plan_ms.csv` 를 `contract_deadline` 으로 묶어 직접 집계: 7/17 5건 70,902,290 · 8/14 12건 80,734,739 · 9/11 8건 29,166,243, 합 25건 180,803,272 [집계 · 표본] | SCREEN_SPEC S-01 |
| 2 | 새 API · 필드 (LOG-022) | `GET /api/receivables` · `AuditRowView` · 보충요청 행 `amount` · `unitCost` · `paymentDate` · 비교표 `changedFromV1` · `v1Recalculated` · `v1BelowDays` · `diffNotesSourced` · `cashEvents` · `actorRole` 필수 — `api-types.ts` 로 확인해 옮김 | SCREEN_SPEC 4절 · S-02 · S-10 · S-11 |
| 3 | 3-4 「보충 검토 작업 완료 → 보충요청 상신」 | BE-18 구현(회신으로만 닫힘, `PATCH` 완료 409)에 맞게 문장을 고치고 "구현됨" 표시. 다른 처리의 결과로 닫히는 작업 표 추가 | 3-4 |
| 4 | BE-17~20 · FE-12~14 | 구현 · 완료 표시 | 1-3 쓰기 행위별 허용 역할 · 9-5 · 9-6 |
| 5 | 시연 시각 바로가기 12개 · 반려 배너 · 「1년 배분 선점」 박스 · S-07 [권한 검증 확인] · 「AI 작성」 표지 | 채택 — 명세에 반영 | SCREEN_SPEC S-01 · S-03 · S-07 |

### 10-4. 백엔드 새 작업

> **상태 (2026-11-14, LOG-030)**: BE-21 · BE-22 · BE-23 · BE-24 **구현됨** — 코드 확인(`domain/gaps.ts` · `domain/workflow.ts` `completeTask` · `server/views/index.ts` `approvalView` · `server/scenarios.ts` `s4` · `checkScenario`)과 `tests/api/be-21-24.test.ts`(20건) 통과. 문서와 다르게 구현된 1건(BE-22 `SUBMITTER` 판정)은 [11-2](#11-2-be-2124-구현-대조). BE-14 는 구현 · 로컬 docker 확인(실배포 대기), BE-15 는 실행됨.

| ID | 파일 | 할 일 | 수용 기준 |
|---|---|---|---|
| **BE-21** | `domain/assessment.ts`(`unknownIds` · `gap`) · `domain/types.ts`(`Assessment.unknowns`) · `server/views`(`gapStatus` 를 도메인에서 함께 쓰게) · 테스트 | 판단안 `unknowns` 항목에 `status: 'OPEN' \| 'FILLED_BY_MOCK'` · `statusText` 추가. 모의 회신으로 채워진 공백(G-02 · G-03 · G-08)을 목록에서 빼지 않는다. 판정은 S-12 와 같은 함수 | ③ `S3_1` → 에이전시 「정보 제공」 → 계약 판단안: `unknowns` 에 G-02 가 있고 `status = FILLED_BY_MOCK`, 사실 「성과 피 조건」 라벨 `MOCK`, R-AUTH-02 `lowerBound = true` 그대로. 에이전시 「정보 부족」이면 G-02 `OPEN`(AC-3-02 그대로). ① 수령확인 뒤 계약 판단안의 G-03 = `FILLED_BY_MOCK`. `GET /api/data-registry` 의 같은 공백 상태와 일치 |
| **BE-22** | `domain/workflow.ts`(`completeTask` `RESUBMIT`) · `server/views`(`ApprovalView`) · `api-types.ts` · `tests/api/s3-resubmit.test.ts` | (1) 계약 판단안이 하나도 없으면 재상신 거부: 422 `INFO_MISSING`, 상태 불변 — 이전 권고 유지(③ 순위)를 없앤다 (2) 상신자 지정 결정이 근거 판단안 권고와 다르면 승인요청 생성 이력 사유에 그 사실을 남기고 `ApprovalView` 에 `proposedSource: 'ASSESSMENT' \| 'SUBMITTER'` · `assessmentDecisionText`(판단안 권고 문구) | 판단안 없이 도메인 `completeTask(RESUBMIT)` → 422 `INFO_MISSING`, 작업 · 계약 · 승인요청 불변. 판단안 v2(권고 C) 뒤 지정 없이 재상신 → `proposed = TERMINATE` · `proposedSource = ASSESSMENT`(지금 테스트 그대로). `proposedDecision: 'RENEGOTIATE'` 지정 → `proposed = RENEGOTIATE` · `proposedSource = SUBMITTER` · 이력 사유에 "상신자 지정". 기존 도메인 시나리오 테스트(AC-3-03)는 재상신 전에 판단안을 기록하도록 고친다 |
| **BE-23** | `domain/workflow.ts`(`completeTask` `RESUBMIT`) · `domain/registry.ts`(A-35 문구 사본) · 테스트 | 계약 `RESUBMIT` 완료 시 같은 계약의 열린 `REVIEW_BEFORE_DEADLINE` 작업을 `CANCELLED` 로 닫는다(이력 `actorRole = SYSTEM` · `actorKind = SYSTEM`, 사유 "재상신 완료로 종료 — …"). 이미 `DONE` 이면 그대로. 가정 목록 사본의 A-35 문구를 5절과 맞춘다 | ③ 분기 A: 재상신 완료 응답 `transitions` 에 재검토 작업 `→ CANCELLED`(SYSTEM) 1행. 7/18 이동 뒤 `OVERDUE` 작업에 `REVIEW_BEFORE_DEADLINE` 없음. 재상신이 다시 반려되면 새 재검토 · 재상신 작업 각 1건. `DOCUMENT_CONDITIONS` 는 자동으로 닫히지 않는다(완료하지 않으면 7/17 뒤 OVERDUE — 테스트로 고정) |
| **BE-24** | `server/scenarios.ts`(`s4` · `PRESETS` 설명 · `checkScenario` ④) · 프리셋 회귀 테스트 기대값 | `S4` 재생에서 7/20 09:00 이동 뒤 · 보충 초안 전에 PLAN-011 모의 판단안(v1)을 기록. `S4` 점검에 "PLAN-011 판단안 v1 · 권고 조건부" 항목 추가. `next` 안내를 "SCM 역할로 보충 검토 회신 → PLAN-011 판단안 다시 만들기(v2)"로 | `POST /api/scenarios/S4/reset` 뒤 `GET /api/assessments?subjectId=PLAN-011` 이 1건(version 1, PLAN-011 권고 `CONDITIONAL`, `mock = true`). SCM 「거절」 또는 ④-b 권한자 반려 뒤 판단안을 다시 만들면 version 2 · PLAN-011 권고 `REJECT`. 다른 프리셋 9개 점검 결과 불변 |
| BE-14 | 배포 | **사용자 결정 대기** 그대로 — 원본 CSV 포함 방식 A/B/C([TECH_STACK 5절](TECH_STACK.md#5-남은-결정--후속-작업)) · `axhub.yaml` 제안 적용 | 8-4 · 9-5 그대로 |
| BE-15 | 실시간 AI | **보류** 그대로 — 사용자 결정 대기(9-1 의 (a) · (b)) | — |

### 10-5. 프론트엔드 새 작업

> **상태 (2026-11-14, 프론트엔드 4단계 보고)**: FE-15 · FE-16 · FE-17 **완료**(프론트엔드 보고 — `npm run check` 297 통과 · 4 건너뜀, 별도 사본 `next build` 통과. 기획은 `approvals/[id]/page.tsx` · `data/page.tsx` · `components/badges/values.tsx` 가 `FILLED_BY_MOCK` · `proposedSource` 를 쓰는 것만 확인). FE-16 (2) 의 표시 조건은 서버 값 `proposedSource = 'SUBMITTER'`(판단안 권고와 **다를 때만**)를 그대로 따른다.

| ID | 화면 | 할 일 | 수용 기준 |
|---|---|---|---|
| **FE-15** (BE-21 뒤) | S-05 미확인 · 공백 구역, S-03 탭 3 판단안 요약 | `unknowns[].status` 가 `FILLED_BY_MOCK` 이면 `미확인` 칩 대신 `모의` 배지 + `statusText`. 문구는 서버 값(S-12 `GapStatusCell` 과 같은 표시) | A-33 변형 화면: 판단안 v2 의 미확인 목록에 G-02 가 "모의 회신으로 보완 — 원본 공백은 그대로"로 보이고, S-12 공백 탭과 문구가 같다. "해소" 문구 없음 |
| **FE-16** (BE-22 뒤, (2)는 낮음) | S-07 재상신 양식 · S-06 요청 상세 | (1) 재상신 양식에서 고른 근거 판단안의 버전 · 권고를 보인다(기본 = 최신 판단안) (2) `proposedSource = 'SUBMITTER'` 요청에 "상신자 지정 — 판단안 권고와 다름" 표시 (3) 422 `INFO_MISSING` 문구는 FE-11 공통 처리로 그대로 | ③ 분기 A 재상신 양식에 "ASM-003 · v2 · 권고 C 해지 통보"가 보이고, 만들어진 요청 상세의 권고가 「해지 통보」다 |
| **FE-17** (BE-23 · BE-24 뒤, 확인만) | S-07 · S-13 | 재상신 결과 패널에 재검토 작업 자동 종료 행이 서버 `displayText` 로 보이는지, `S4` 카드의 `next` 안내가 서버 값으로 바뀌는지 확인(코드 변경이 없을 수 있음) | ③ 분기 A 재상신 뒤 S-07 열린 작업에 「기한 전 재검토」가 없다. ④ 프리셋 직후 S-04 PLAN-011 에 판단안 v1 링크가 있다 |

### 10-6. 완료 조건 재판정

점검표는 [DEMO_SCENARIOS 0-2](DEMO_SCENARIOS.md#0-2-완료-조건-점검-2026-11-14-4단계-뒤). 요지: 5개 모두 **로컬 충족**(로컬 화면에서 증거 확인, 배포 주소 미확인). 「충족」으로 올리려면 **배포**(BE-14 — 사용자 결정 대기)와 배포 주소에서 ①~④ 1회 실행이 남았다. BE-21~24 · FE-15~17 은 표시 · 절차를 다듬는 작업으로, 완료 조건 판정을 막지 않는다(그 전에는 DEMO 0-6 진행표의 대체 단계로 시연한다).

## 11. 4단계 반영 · AI 실행 기록 · 배포 A안 · 후속 작업 (2026-11-14)

기준: devlog LOG-028 ~ LOG-033 · DD-047 ~ DD-051, 코드 읽기(`app/src/domain/gaps.ts` · `types.ts` · `api-types.ts` · `workflow.ts` `completeTask`, `app/src/server/ai/recorded/` · `ai/agent.ts` · `ai/assessor.ts` · `scenarios.ts` · `service.ts` · `views/index.ts`, `app/src/app/api/assessments/recorded/route.ts`, `app/tests/api/be-21-24.test.ts` · `recorded-run.test.ts`). 기획이 직접 실행한 것: `npm run check`(2026-11-14 17:28, **통과** — 24 파일 · 1 건너뜀, 291 통과 · 2 건너뜀), `axhub deploy list`(읽기 전용 — 배포 이력 3건 확인) · `axhub env set --help`(옵션 확인). 배포 준비 구현 뒤 `npm run check` 재실행(17:39, **통과** — 26 파일 · 2 건너뜀, 297 통과 · 4 건너뜀). 화면 · docker 는 돌리지 않았다. axhub 전제(Dockerfile · DB · env)와 로컬 docker 결과는 백엔드 보고를 인용했다.

### 11-1. 이번에 문서에 반영한 것

| # | 항목 | 반영한 곳 |
|---|---|---|
| 1 | AI 방식 사용자 결정 (b) — 실제 실행 1회 + 기록 재생, 시연 런타임 모의 | 9-1(다시 씀) · 0 표기 · 1-3 Assessment · TECH_STACK 2-3 · 2-4 · DEMO 0-2 · 0-4 · 0-6 · SCREEN_SPEC 0-1 · S-05 · S-05R |
| 2 | 심사 관점별 증거 표 · 실제 작동 / 모의 처리 / 설계 단계 구분표 · 한계 7건 | 9-1 |
| 3 | BE-21 ~ 24 구현됨 · 타입 | 1-3 Assessment(`AssessmentUnknown` · `AiTurnTrace`) · 1-3 ApprovalRequest(`proposedSource`) · 3-4 · 10-4 · DEMO AC-3-09 ~ 11 · AC-4-06 · AC-4-06a |
| 4 | 기록 재생 API · 타입 | 1-3 Assessment · SCREEN_SPEC 4절 |
| 5 | 배포 A안 확정 · 구현(BE-14) · axhub 확인 사실 · 미확인 4건 · 실패 배포 이력 · `GET /api/healthz` | DEPLOY.md · TECH_STACK 4 · 5 · 5-1 · SCREEN_SPEC 4절 |

### 11-2. BE-21~24 구현 대조

| 작업 | 구현 (코드 위치) | 테스트 | 문서와의 차이 |
|---|---|---|---|
| BE-21 | `domain/gaps.ts`(`gapStatus` · `gapState` · `GAP_STATUS_TEXT`) 신설, `types.ts` `AssessmentUnknown`, `views/index.ts` 가 같은 함수를 다시 내보냄 | `be-21-24.test.ts` BE-21 5건(G-02 정보 제공 · 정보 부족, G-03 수령확인 전후, G-08 SCM 회신 전후, 시드 셋 다 `OPEN`) | 없음 |
| BE-22 | `workflow.ts` `completeTask` `RESUBMIT` — 판단안 없으면 422 `INFO_MISSING`, 이전 권고 복사 삭제. `ApprovalView.proposedSource` · `assessmentDecisionText` | BE-22 5건 | **1건**: `SUBMITTER` 는 상신자 지정이 판단안 권고와 **다를 때만**. 같으면 `ASSESSMENT` + 이력 사유 "… 권고와 같음". 이전 문서(지정이면 `SUBMITTER`)를 **구현에 맞춰 고쳤다** — 화면 문구 "판단안 권고와 다름"이 거짓이 되지 않게(1-3 ApprovalRequest 3) |
| BE-23 | 같은 함수 — 열린 `REVIEW_BEFORE_DEADLINE` 을 `CANCELLED`(`SYSTEM`/`SYSTEM`), 사유 "재상신 완료로 종료 — 재검토 결과는 재상신 요청 {ID} · 근거 판단안 {ID}". `registry.ts` A-35 문구 사본 갱신 | BE-23 5건(자동 종료 · 이미 `DONE` 이면 그대로 · 다시 반려되면 새 작업 · 승인조건 문서화는 닫히지 않고 7/17 뒤 OVERDUE · A-35 문구) | 없음 |
| BE-24 | `scenarios.ts` `s4` — 7/20 09:00 이동 뒤 · 보충 초안 전에 PLAN-011 모의 판단안 기록. 점검 항목 **`AC-4-06a`** "PLAN-011 판단안 v1 · 권고 조건부"(기대 `[1, 'CONDITIONAL']`). `next` = "SCM 역할로 보충 검토 회신 → PLAN-011 판단안 다시 만들기(v2)" | BE-24 4건(v1 · 조건부 · 모의 · 초안보다 먼저, 점검 · 안내, ④-c 뒤 v2 부결, ④-b 뒤 v2 부결) | 점검 항목 ID 가 새로 생김(`AC-4-06a`) — DEMO ④ 수용 기준에 추가 |
| AI 추적 | `Assessment.aiTrace`(`AiTurnTrace[]`), `agent.ts` 가 응답마다 1행. 실패 사유에 API 오류 종류만(안내 문구는 서버 로그, 키 모양 문자열은 가림) | `tests/unit/agent.test.ts` | 새 필드 — 1-3 Assessment 에 추가 |
| 기록 재생 | `server/ai/recorded/index.ts`(`RECORDED_RUNS` · `verifyRecordedRun` · `recordedRunView`), `service.recordedRuns()`, route `GET /api/assessments/recorded` | `recorded-run.test.ts` 10건 | 새 API · 타입 — 9-1 · SCREEN_SPEC 4절 |

### 11-3. 백엔드 작업

| ID | 파일 | 할 일 | 수용 기준 |
|---|---|---|---|
| **BE-14** — **구현 · 로컬 docker 확인, 실배포 대기** (2026-11-14, 미커밋) | 최상위 `Dockerfile` · `.dockerignore` · `axhub.yaml` · `app/scripts/deploy/start.sh` · `bootstrap.ts` · `app/src/server/deploy/bootstrap.ts` · `app/src/app/api/healthz/route.ts` · `tests/api/healthz.test.ts` | 구현 내용은 [DEPLOY.md 2-3](DEPLOY.md#2-3-구성-저장소-파일-기준--2026-11-14-작업본)(기획이 파일을 읽어 옮김): 4단계 빌드 · `USER node` · `RAW_DATA_DIR=/data/raw` · CSV 17개만 · `root` 미선언 · port 3000 · `health_path /api/healthz`(DB 를 보지 않음) · `start_period 90s` · `database postgres` · `AOURA_AI_MODE` required · 시작 순서(마이그레이션 → 비어 있으면 SEED → 서버, 실패 시 종료 코드 1). **남은 일은 실배포뿐 — `git push origin` · `axhub env set` 은 사용자가 "배포"라고 한 뒤에만** | **로컬 docker 로 확인됨**(백엔드 보고 — 0.5코어 · 1GB · 새 DB, 기획 미재확인): 빌드 약 56초 · 기동 0.77초 · `healthz` 200 · `meta` = `MOCK` · `POSTGRES` · `FILES` · `S1_7` 리셋 뒤 점검 7/7 · `recorded` 200 · 원본 CSV · 내부 파일 HTTP 404 · 재시작 시 상태 유지. **실배포 뒤 확인(DEPLOY.md 4절 9번)**: ① `healthz` 200 ② `meta` 세 값 ③ `S1_7` 리셋 → 점검 7/7 ④ `recorded` 200 · `basisCheck.ok` ⑤ `/data/raw/…csv` 404. **미확인**: axhub 빌더 빌드(amd64) · 실제 트랜잭션 풀러 · 실환경 기동 시간 · `axhub deploy check` |
| BE-15 | — | **실행됨** (2026-11-14 17:19 KST, 9-1). 추가 실행 없음 — 사용자 결정 (b) | — |
| **BE-25** — **수정 중** (알려진 결함) | `server/ai/recorded/` (기록 읽는 방식) · `app/scripts/check-recorded-bundle.mjs` | 번들을 거친 서버(`next build` · docker · 배포)에서 기록 재생의 `basisCheck.ok` 가 `false` 로 나온다 — INF-001 의 ROAS 두 값이 부동소수 마지막 자리에서 다르다(백엔드 진단: 번들러가 JSON 모듈의 소수를 1ULP 다르게 읽음). 화면에 "현재 규칙 계산과 불일치" 빨간 경고. **기록 파일은 고치지 않는다. 비교를 느슨하게 해서(허용 오차) 덮지 않는다** — 원인이 "서버가 내보내는 기록이 파일 원문과 다르다"이므로, 기록을 원문 그대로 읽게 고친다. 화면에서 경고를 숨기지 않는다 | **AC-R-07**(DEMO 5-1): 번들 서버에서 응답의 기록 값이 파일 원문과 숫자까지 같고 `basisCheck.ok = true`. `next dev` · `next build` + `next start` · docker 이미지 세 곳에서 확인. 근거 값을 실제로 바꾸면 여전히 `ok = false` 가 나온다(기존 테스트 유지). 실배포 전에 끝낸다 — DEPLOY.md 배포 후 점검 4번이 이것을 본다 |
| (기록, 작업 아님) | `server/ai/recorded/rec-001-contract.json` | **고치지 않는다.** 실제 AI 를 다시 실행하게 되면 그때만: 도구가 주는 비율 값(ROAS 등)의 표시 자릿수를 정해 문장에 16자리 소수가 인용되지 않게 한다(9-1 한계 5) | — |

### 11-4. 프론트엔드 작업

| ID | 화면 | 할 일 | 수용 기준 |
|---|---|---|---|
| **FE-18** — **완료** (프론트엔드 보고) | S-05R `/assessments/recorded` · S-05 · S-13 링크 · 사이드 메뉴 | 구현: 표지(남색 「실행 기록 · 재생」 + 서버 `label`, "지금 AI 를 호출하지 않음 · 운영 상태와 분리 · 실시간/모의와 다름") → 흐름 띠 5단계(① AI 가 받은 것 ② AI 가 낸 것 ③ 검증 ④ 승인요청 ⑤ 사람 회신) → 실행 개요 → 각 구역. 승인요청 · 이력은 「그 실행 당시의 사본」, 운영 화면 ID 링크 없음 | UI-11. 남은 것: 번들 서버의 `basisCheck` 불일치 경고(BE-25 — 백엔드 수정 중) |
| FE-15 · 16 · 17 — **완료** | S-05 · S-06 · S-07 · S-13 · S-04 | 10-5 그대로 + S-04 에 건별 판단안 링크(표의 상태 칸 · 건 상세 서랍) 추가 | 10-5 |
| **FE-19** — **완료** | 화면 미확인 4건 검증 | 네 건 모두 화면 조작으로 확인(결과는 DEMO 0-3) | — |
| **FE-20** (새 작업, 낮음) | S-05R | 화면 ID 표시를 `S-05` 에서 **`S-05R`** 로(아래 11-6 ①). BE-25 수정 뒤 기록 화면의 「현재 규칙 계산과 일치」를 번들 서버(`next build` 사본)에서 다시 확인 | 화면 ID 가 `S-05R`. 번들 서버에서 빨간 경고가 없다 |

### 11-6. 프론트엔드 4단계 — 판정 · 결정

| # | 항목 | 결정 | 이유 |
|---|---|---|---|
| ① | 기록 재생 화면의 화면 ID (지금 `S-05`) | **별도 ID `S-05R` 을 준다** | S-05 는 운영 판단안(상태 버전 · 프리셋에 따라 바뀜, 쓰기 버튼 있음)이고 기록 재생은 운영 상태와 무관한 조회 전용 증거 화면이다. 같은 ID 면 수용 기준(UI-06 대 UI-11) · 시연 진행표에서 둘이 섞인다. `R` = Recorded |
| ② | 사이드 메뉴 「AI 실행 기록」 (첫 명세는 "메뉴에 넣지 않는다") | **채택 — 문서를 구현에 맞춘다** | 심사자가 시연자 안내 없이도 실제 AI 증거를 찾을 수 있어야 한다. 조건: 운영 메뉴(전속계약 · 승인함 · 작업 …)와 구분된 자리(처리 이력 · 데이터 출처 · 시연 시나리오 쪽)에 두고, 메뉴 이름에 `실시간` 을 쓰지 않는다 |
| ③ | 표지 문구 「실행 기록 · 재생」 · 구역 이름(AI 가 받은 것 · 낸 것 · 검증 · 승인요청 · 사람 회신) | **채택** | 명세의 「AI 입력 · AI 출력」보다 쉬운 말이고 뜻이 같다. 표시 규칙(9-1)은 그대로 지킨다 |
| ④ | 기록 화면 아래의 일반 링크(시연 시나리오 · 승인함 · 처리 이력) | **허용** | 금지한 것은 기록 안의 ID(`ASM-001` · `APR-001`)를 운영 화면 링크로 만드는 것이다. "현재 요청은 승인함에서" 같은 일반 이동은 오히려 둘을 구분해 준다 |
| ⑤ | **상신자 지정 결정을 화면에서 입력하게 할지** | **두지 않는다 — API 전용 유지** | (a) 시연 ①~④ 에 필요한 장면이 없다. (b) 화면 기본 경로는 "판단안을 다시 만든 뒤 재상신"이고, 다른 결정을 올리고 싶다는 것은 판단 근거가 바뀌었다는 뜻이라 판단안부터 다시 만드는 것이 맞다 — 근거 판단안과 요청 권고가 어긋나는 경로를 화면에 일부러 열 이유가 없다. (c) 결정은 어차피 권한자가 회신에서 고른다(S-06 [승인] + 결정 선택 — 권고와 다른 결정도 고를 수 있다). API 경로와 `SUBMITTER` 표시는 그대로 두고, 증거는 API 테스트다 |
| ⑥ | 422 `INFO_MISSING`(판단안 없는 재상신)의 화면 재현 | **화면으로는 만들 수 없다 — 명시한다** | 프리셋 · API 경로에서는 첫 상신이 판단안에서 만들어지므로 재상신 시점에 계약 판단안이 항상 있다. 이 거부는 도메인 함수 직접 호출에서만 일어나고 증거는 `tests/api/be-21-24.test.ts` 다(1-3 ApprovalRequest 4). 시연에서 보이려고 판단안을 지우는 장치를 만들지 않는다 |

### 11-5. 완료 조건 재판정

점검표는 [DEMO_SCENARIOS 0-2](DEMO_SCENARIOS.md#0-2-완료-조건-점검-2026-11-14-4단계-뒤). 요지: 5개 모두 **로컬 충족** 그대로다 — 4단계는 판정 단계를 올리지 않는다(배포 주소가 아직 없다). 달라진 것은 ① 다듬기 BE-21 ~ 24 가 끝나 조건 5 의 "알려진 차이 1건"이 **백엔드에서는** 없어졌고(화면 FE-15 는 진행 중) ② 여섯 관점 「AI · 사람 · 도구」에 실제 입력 · 출력 증거가 생겼으며 ③ 프론트엔드 4단계로 화면 미확인 4건이 모두 확인됐고 ④ 배포 방식이 A안으로 정해지고 구현 · 로컬 docker 확인까지 끝나, 남은 것이 "사용자 결정"에서 "`AOURA_AI_MODE` 등록 · 사용자의 배포 지시 · 실배포에서만 확인되는 미확인 4건"으로 바뀐 것이다. **알려진 결함 1건이 수정 중이다**(BE-25 — 번들 서버에서 기록 재생 `basisCheck` 불일치). 실배포 전에 고친다.
