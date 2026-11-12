# 온톨로지 — 대상 · 관계 · 상태 · 규칙 (W02)

> 작성 2026-11-12 · 기획(aoura-planner) · 기준: [PROBLEM.md](PROBLEM.md) · [W02_TASK.md](W02_TASK.md) · [TECH_STACK.md](TECH_STACK.md)
> 이 문서는 백엔드가 `app/src/domain/types.ts` 와 Drizzle 스키마로 옮길 **계약 문서**다. 코드와 다르면 이 문서가 기준이고, 바꿀 때는 이 문서부터 고친다.
> 경로는 `01_참가자_배포용/04_원본데이터/` 기준. 시연 상황은 [DEMO_SCENARIOS.md](DEMO_SCENARIOS.md), 화면은 [SCREEN_SPEC.md](SCREEN_SPEC.md).

## 0. 표기

| 라벨 (enum) | 화면 배지 | 뜻 |
|---|---|---|
| `ORIGINAL` | 원본 | 원본 파일에서 그대로 읽은 값 · 규칙 문구 |
| `AGGREGATED` | 집계 | 원본을 코드로 계산한 값 (계산식 · 가정 ID 함께 표시) |
| `INTERPRETED` | 원본근거해석 | 원본에 직접 쓰여 있지 않지만 원본 문구를 근거로 정한 해석 (근거 문구 표시) |
| `ASSUMPTION` | 가정 | 원본에 없어 우리가 정한 값 · 규칙 (가정 ID `A-xx`) |
| `CLAIM` | 주장 | 회의록 · 부서 메모 · 기안 예상 GMV · 재무팀 공식 전망 |
| `MOCK` | 모의 | 모의 회신 · 모의 사건 입력 · 모의 모드 AI 출력 |

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

원본 CSV 를 그대로 적재한다(`|` 구분, `NONE` 은 `null` 이 아니라 문자열 `'NONE'` 로 보존하고 도메인 변환 시 `null` 로 바꾼다 — A05 "NONE 은 0 과 구분"). 모든 행에 `src_file`, `src_row`(헤더 제외 1부터) 컬럼을 추가한다. 테이블명 제안 `raw_<파일명>`.

| 테이블 | 원본 파일 | 키 | 스케일 | 라벨 | W02 에서 쓰는 곳 |
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
| `performanceFeeTerms` | `string \| null` | `null` — "GMV 연동, 별도 정산", 산식 없음 | ORIGINAL(존재) · 조건은 **미확인**(G-02) |
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
| `routing` | `Routing` | — | R-AUTH-01/03 계산 결과 |
| `flags` | `LineFlag[]` | — | 아래 enum |

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
`key`(campaignId 또는 influencerId) · `orderCount` · `gmv` · `couponDiscount` · `returnRefund` · `netRevenue` · `cogs` · `channelFee` · `fulfillmentCost` · `returnLogisticsCost` · `marketingSpend` · `cp`(공식값, A05 단일 차감) · `cpRefDef14`(참고값, 1.4 문자 그대로) · `nominalRoas` · `realRoas`(공식) · `realRoasRefDef14`(참고) · `returnRate` · `adSpendShare` · `requestShare` · `ranks`. 값은 4절 R-CP 와 [DEMO_SCENARIOS.md 부록 A](DEMO_SCENARIOS.md#부록-a-계산-기대값-골든-값).

#### CashForecastRun — 자금 재전망 [AGGREGATED, FULL]
`id` · `asOf` · `inputsVersion`(조건 변경 이벤트 ID 목록) · `assumptionIds` · `daily: {date, closingKrw}[]`(영업일) · `minClosing: {date, krw}` · `breachWindows: {start, end}[]`(30억 미만 연속 영업일) · `createdAt`.
- `OfficialForecast`(`fin_cash_forecast_ms`) 는 **CLAIM** 으로 별도 표시하고 재전망과 차이를 보여준다(R-CASH-03).

### 1-3. 도메인 엔티티 (운영 · 새로 생성) — 모두 원본에 없음

| 엔티티 | 테이블 제안 | 생성 주체 | 라벨 |
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
| `SimClock` 가상 기준시각 | `sim_clock` (1행) | 시연 입력 | ASSUMPTION A-21 |

#### Event
```ts
type EventType =
  | 'RENEWAL_NOTICE_RECEIVED'      // 갱신 통보 접수 (inf001 통보서) — payload: {contractId}
  | 'EXPANSION_PROPOSAL_RECEIVED'  // 확대 기안 접수 — payload: {proposalId, lineIds?}
  | 'AR_COLLECTION_DELAYED'        // 조건 변경: 회수 지연 통보 — payload: {arId, newDueDate}
  | 'LINE_TERMS_CHANGED'           // 조건 변경: 기안 금액/집행일 정정 — payload: {lineId, requestedKrw?, settlementDate?}
  | 'APPROVAL_REPLY'               // 모의 회신 — payload: ApprovalReply
  | 'COUNTERPARTY_REPLY'           // 에이전시 · SCM 등 외부 모의 회신
  | 'CLOCK_ADVANCED';              // 시점 이동 — payload: {from, to}
interface Event { id: string; type: EventType; payload: unknown; label: 'ORIGINAL' | 'MOCK'; simAt: string; createdAt: string; createdBy: ActorRole }
```

#### Assessment (판단안)
`id` · `subjectType`(`'CONTRACT' | 'EXPANSION_LINES' | 'REPLENISHMENT'`) · `subjectIds` · `triggerEventId` · `facts: Sourced<unknown>[]`(도구가 돌려준 값만) · `ruleResults: {ruleId, result, inputs}[]` · `alternatives: Alternative[]` · `recommendation: {alternativeId, rationale}` · `perspectives: {marketing, finance, contract, scm}`(관점별 근거 문장) · `claimsCited: {text, ref}[]`(주장 인용은 분리) · `unknowns: {gapId, impact}[]` · `aiMode: 'LIVE' | 'MOCK'` · `model` · `createdAt`.
- `Alternative = { id, title, decision, effects: Sourced<unknown>[], risks: string[], requiresRole: ApproverRole }`.
- **AI 가 만든 숫자는 저장하지 않는다.** 판단안의 모든 숫자는 `facts` / `ruleResults` 의 값을 참조한다(CLAUDE.md 규칙 9).

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
| `version` | `number` | 재상신 시 +1 |
| `supersedesId` | `string \| null` | 권한 재판정 · 재상신 시 이전 요청 |

#### ApprovalReply [MOCK]
`id` · `requestId` · `respondentRole` · `outcome: 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED' | 'INFO_REQUESTED'` · `itemDecisions: {itemId, decision: 'APPROVE' | 'REJECT' | 'HOLD' | 'CONDITIONAL', condition?: string}[]` · `reason` · `simAt` · `label: 'MOCK'`.
- 검증: `respondentRole === request.requiredRole` 이 아니면 **거부(422, "권한 없음")**. 하위 권한자의 승인으로 상위 권한 건을 확정할 수 없다(R-AUTH-05).

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
  | 'INCIDENT_AUTO_RENEWAL'  // 권한 미경유 체결 사고 기록 · 후속 대응
  | 'POST_DEADLINE_REPORT';  // 기한 경과 자동 확정 건 사후 보고
type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'OVERDUE';
interface Task { id: string; type: TaskType; subjectType: string; subjectId: string; ownerRole: ActorRole; dueAt: string; status: TaskStatus; createdByEventId: string; resultNote?: string }
```

#### Notice / NoticeReceipt (확장 E1)
- `Notice`: `id` · `contractId` · `decision`(통보 내용: 해지 · 조건변경) · `sentAt`(sim) · `channel`(`'EMAIL' | 'DOCUMENT'` — ASSUMPTION) · `label: 'MOCK'`.
- `NoticeReceipt`: `id` · `noticeId` · `receivedAt` · `evidence`(문자열: "에이전시 회신 메일" 등) · `label: 'MOCK'`.

#### ReplenishmentRequest (부서 영향 D2)
`id` · `skuId` · `triggerLineId` · `avg4wDemand` · `coverWeeks` · `targetQty`(A-17) · `suggestedQty` · `finalQty`(MOQ, A-18) · `unitCostKrw`(기발주 단가 = `amount_krw/order_qty`, 예 SKU-1001 21,840원 [AGGREGATED]) · `amountKrw: Krw<'FULL'>` · `neededBy`(IsoDate) · `expectedPaymentDate`(A-19) · `requiredRole`(`SCM` 또는 covenant 구간이면 `GROUP_CEO_BOARD`) · `status`(`'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED'`) · `openQuestions`(G-08).

#### AuditLog
`id` · `entityType` · `entityId` · `fromStatus` · `toStatus` · `actorRole` · `actorKind: 'AI' | 'HUMAN' | 'SYSTEM' | 'MOCK'` · `ruleIds` · `eventId` · `reason` · `simAt` · `createdAt` · `snapshot`(변경 시점 주요 값 JSON).
- **모든 상태 변경은 이 테이블에 1행 이상** 남긴다. 화면 「처리 이력」의 원천.

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
| `CONTRACT_OFFICER` | 계약 담당 | BPMN W02 레인 — 주최 교육용 가정 | ASSUMPTION (A-22) |
| `FINANCE` | 재무팀 | 회의록 · 통보서 메모 작성자 | ORIGINAL(존재) |
| `AGENCY` | 혜인 소속 에이전시 | 통보서 발신자 | ORIGINAL(존재) · 회신은 MOCK |
| `COREVIA` | Corevia(공급사) | `m_sku_ms.source_company` | ORIGINAL(존재) · 회신은 MOCK |

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

### 3-1. ExclusiveContract (`ContractStatus`)

```
ACTIVE ──(RENEWAL_NOTICE_RECEIVED)──▶ UNDER_REVIEW
UNDER_REVIEW ──(판단안 확정 · 승인요청 생성)──▶ PENDING_APPROVAL
PENDING_APPROVAL ──(회신 APPROVED, decision=RENEW_SAME)──▶ RENEWED_APPROVED (종결)
PENDING_APPROVAL ──(회신 APPROVED, decision=RENEGOTIATE|TERMINATE)──▶ NOTICE_PENDING  [+Task SEND_NOTICE, DOCUMENT_CONDITIONS]
PENDING_APPROVAL ──(회신 REJECTED | INFO_REQUESTED)──▶ REVIEW_BEFORE_DEADLINE  [+Task REVIEW_BEFORE_DEADLINE, RESUBMIT(, INFO_REQUEST)]
REVIEW_BEFORE_DEADLINE ──(재상신)──▶ PENDING_APPROVAL (version+1)
NOTICE_PENDING ──(SEND_NOTICE 완료)──▶ NOTICE_SENT  [+Task CONFIRM_RECEIPT]
NOTICE_SENT ──(NoticeReceipt 입력)──▶ NOTICE_ACKNOWLEDGED  → decision 별로 NEGOTIATING | TERMINATING
NOTICE_SENT ──(수령 미확인 + [발송 후 2영업일 경과 또는 기한 당일 09:00] 중 먼저)──▶ (상태 유지) [+Task RENOTIFY 1회]  ← 확장 E1
NOTICE_SENT ──(기한 경과, 수령 미확인)──▶ NOTICE_UNCONFIRMED [+Task INCIDENT…, 에스컬레이션]  ← 확장 E1
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
{APPROVED, CONDITIONALLY_APPROVED} ──(조건 변경으로 requiredRole 상향, 기한 전)──▶ REAPPROVAL_REQUIRED [+새 승인요청, 이전 요청 SUPERSEDED]
REAPPROVAL_REQUIRED ──(새 승인요청 생성)──▶ PENDING_APPROVAL
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

### 3-3. ApprovalRequest (`ApprovalStatus`)
`PENDING` → `APPROVED` | `APPROVED_WITH_CONDITIONS` | `REJECTED` | `INFO_REQUESTED` | `SUPERSEDED`(재상신 · 권한 재판정) | `EXPIRED`(hardDeadline 경과 시 미회신). 회신은 `requiredRole` 만 가능.

### 3-4. Task (`TaskStatus`)
`OPEN` → `IN_PROGRESS` → `DONE` | `CANCELLED`. `simNow > dueAt` 이고 미완료면 `OVERDUE`(기한 감시가 표시만 바꿈). 작업 완료가 다른 엔티티 전이를 일으키는 경우: `SEND_NOTICE` → 계약 `NOTICE_SENT`, `RESUBMIT` → 새 승인요청, `REPLENISHMENT_REVIEW` → 보충요청 `SUBMITTED`.

### 3-5. ReplenishmentRequest
`DRAFT` → `SUBMITTED` → `APPROVED` | `REJECTED` | `INFO_REQUESTED`. 회신자 = `requiredRole`(SCM, covenant 구간 지급이면 GROUP_CEO_BOARD).

### 3-6. 기한 감시 (deadline watchdog)
`advanceClock(to)` 가 호출될 때(그리고 모든 이벤트 처리 전) 순서대로 실행한다: ① Task OVERDUE 표시 ② 수령확인 재통보(E1) ③ 기안 건 기한 처리(3-2) ④ 계약 기한 처리(3-1) ⑤ 승인요청 EXPIRED ⑥ 각 전이를 AuditLog 에 `actorKind='SYSTEM'` 으로 기록. 시점을 되돌리는 이동은 허용하지 않고 「시나리오 초기화」로만 처음으로 돌아간다.

## 4. 규칙 (규칙 ID 는 테스트 이름에 그대로 쓴다)

### 4-1. 승인 권한 — `approval_authority_policy.md` [ORIGINAL]

| ID | 규칙 | 함수 제안 | 라벨 |
|---|---|---|---|
| R-AUTH-01 | 확대 기안 건: `requestedKrw ≤ 10,000,000` 이고 기안 총액 `≤ 100,000,000` → `MARKETING_TEAM` 전결. 건별 `> 10,000,000` **또는** 기안 총액 `> 100,000,000` → `MASIL_CEO` + 그룹 보고(`alsoReportTo=['GROUP_CEO_BOARD']`, Task `REPORT_TO_GROUP`) | `routeExpansionLine(line, proposalTotal, windows)` | ORIGINAL 규칙 · 기안 총액 = 실제 요청액 INTERPRETED |
| R-AUTH-02 | 전속계약 체결 · 갱신: 연 금액 `> 1,000,000,000` → `GROUP_CEO_BOARD`, 이하 → `MASIL_CEO`. 연 금액 = 고정 피(28억) + 성과 피(미확인 → 0 이 아니라 "하한 28억"으로 표시). **미통보 자동 갱신도 체결** | `routeContract(contract)` | ORIGINAL |
| R-AUTH-03 | covenant 우선: `settlementDate`(또는 신규 약정의 현금 유출일)가 하회 예상 구간 안이면 금액 · 종류 불문 `GROUP_CEO_BOARD`. R-AUTH-01/04 보다 **우선** | `applyCovenantPriority(routing, cashOutDate, windows)` | ORIGINAL |
| R-AUTH-04 | 재고 발주: 평시 `SCM`, 지급일이 하회 구간이면 `GROUP_CEO_BOARD` | `routeReplenishment(req, windows)` | ORIGINAL |
| R-AUTH-05 | 권한 경계를 넘는 결정은 자동 확정하지 않는다: 상태를 `APPROVED` 류로 바꾸는 유일한 경로는 `requiredRole` 의 회신. AI · 시스템 · 하위 권한자는 불가 | `assertCanReply(role, request)` | ORIGINAL |
| R-AUTH-06 | 권한 재판정: 조건 변경(재전망 · 기안 정정)마다 모든 건(확정 건 포함)의 라우팅을 다시 계산한다. 권한자가 **상향**되고 이미 하위 권한자의 승인이 있으면(기한 전) `REAPPROVAL_REQUIRED` + 새 요청, 기한 후면 `POST_DEADLINE_REPORT`. **하향**이면 기존 상위 권한자 승인을 유지(재상신 없음). 권한 서열: MARKETING_TEAM < MASIL_CEO < GROUP_CEO_BOARD (SCM 은 발주 전용) | `rerouteAll(state, forecastRun)` | ASSUMPTION (서열은 정책 표 구조에서 INTERPRETED) |

- 경계값: "1천만원 이하"는 전결 → `10,000,000` 은 마케팅팀, `10,000,001` 부터 Masil 대표. "1억원 초과" → `100,000,000` 은 해당 없음. "10억원 초과" → `1,000,000,000` 은 Masil 대표.
- 현재 데이터 결과: 기안 총액 180,803,272 > 1억 → 25건 모두 최소 `MASIL_CEO` [AGGREGATED]. 건별 1천만 초과 5건(PLAN-001~005).
- 계약에 covenant 대조(R-AUTH-03)는 **고정 피 지급 일정이 없어 판정 불가**(G-09) → `unknowns` 로 표시. 계약은 이미 최상위 권한이라 권한자는 바뀌지 않는다.

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
| R-INV-03 | 재고 게이트: 확대 건의 주력 SKU(A-16) 중 하나라도 `coverWeeks < safetyStockWeeksMin` → `INVENTORY_BELOW_MIN`. `INVENTORY_BELOW_MIN` 인 SKU 에 대해 예상 품절일(R-INV-02, in_transit 제외) `< settlementDate` **이고** 지금 새로 발주해도 도착(`simNow + leadTimeWeeks×7`)이 `> settlementDate` 면 `STOCKOUT_BEFORE_SETTLEMENT` → 권고는 `CONDITIONAL`(집행일 조정) 또는 `REJECT` 만 허용, `APPROVE` 불가. (안전재고 이상인 SKU 는 in_transit 입고일 미상이라 품절 플래그를 붙이지 않는다 — 과잉 경고 방지) | ASSUMPTION (게이트 정책) · 산식 ORIGINAL |
| R-INV-04 | 보충 제안: `targetQty = safetyStockWeeksMax × avg4w`(A-17), `suggested = max(targetQty − onHand − inTransit, 0)`, `finalQty = suggested>0 ? ceil(suggested/moq)×moq : 0`(A-18) | 산식 ORIGINAL(1.3) · Target · MOQ 처리 ASSUMPTION |

- 캠페인 증분 수요는 **표본 주문으로 풀스케일 판매량에 더하지 않는다**(R-SCALE-01). 게이트는 "캠페인 없이도 부족한가"로만 판단하고, 캠페인은 방향(+)으로만 표시한다.

### 4-5. 자금 재전망 · covenant — `calculation_definitions.md` 1.2, `covenant_terms_ms.md` [ORIGINAL 산식]

| ID | 규칙 | 라벨 |
|---|---|---|
| R-CASH-01 | `Opening = fin_cash_daily_ms` 2026-06-30 `closing_balance` = **5,148,063,540**. 일별: `+ AR.outstanding_krw @due_date`, `− AP.amount_krw @payment_due_date (po_id='NONE' 만)`, `− PO.amount_krw @payment_due_date`. AP 중 `po_id` 가 PO 에 있는 14행은 **이중계상 금지로 제외** | ORIGINAL 산식 |
| R-CASH-02 | 기준일 이전 만기(연체) 항목: 기본 = 제외(A-08), 민감도 = as-of 일괄 반영. 주말 만기 = 다음 영업일 잔액에 반영(A-09) | ASSUMPTION |
| R-CASH-03 | 영업일 `closing < 3,000,000,000` 인 연속 구간 = 하회 예상 구간. 재무팀 공식 전망(CLAIM)과 나란히 표시하고 차이 원인(7/21 발주대금 37.5억)을 설명 | ORIGINAL(30억 · 매 영업일) · AGGREGATED |
| R-CASH-04 | 기안 요청액(SAMPLE)은 재전망 유출에 **넣지 않는다**(회의록 "본 기안은 자금 전망 유출 산식에 포함되지 않는다" + R-SCALE-01). 신규 재고 보충 발주(FULL)는 "추가 유출" 시나리오로 **원본 전망분과 분리**해 넣을 수 있다(A05 "원본 전망 포함분과 추가 유출을 분리") | ORIGINAL · ASSUMPTION |

- 현재 결과(기본 가정): 하회 구간 **2026-07-21 ~ 2026-08-21**(24영업일), 최저 **1,921,839,555원 (7/27)**. 민감도(연체 AR 제외 · 연체 AP 7/1 지급): 7/21 ~ 8/28, 최저 1,467,664,440원. **시작일 7/21 은 모든 가정에서 같다** [AGGREGATED]. 재무팀 공식 전망은 하회 없음(주간 최저 5,468,884,369원) [CLAIM].

### 4-6. 확장 · 기타

| ID | 규칙 | 라벨 |
|---|---|---|
| R-EXT-01 (확장 E1) | 통보는 **수령확인이 있어야 "통보 완료"**. `NOTICE_SENT` 상태로 수령 미확인인 채 "발송 후 2영업일 경과" 또는 "기한 당일 09:00" 중 먼저 오는 시점이 되면 `RENOTIFY` 작업 1회(중복 생성 금지), 기한까지 미확인이면 `NOTICE_UNCONFIRMED` + 그룹 CEO/이사회 · 계약 담당 에스컬레이션. 수령확인 없이는 다음 판단에서 "자동 갱신 차단됨"으로 쓰지 않는다 | ASSUMPTION A-14 (W02 "실제 통보 수령 증빙이 없다" 공백 보완) |
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
| A-24 | 모의 회신 문구 · 날짜 (시연 시나리오) | 외부 승인 대체 (PROBLEM 4절 조건 1) | 시연 |
| A-25 | 기한 경고 단계 D-7/D-3 | 화면 표시용 | R-DL-03 |
| A-26 | 집행일이 확정기한보다 앞선 건은 결정 필요 시점을 앞당겨 표시 | `settlement_date` 의미 미확정 | R-DL-05 |

## 6. 데이터 공백 (W02_TASK 5절 연결)

| ID | 공백 | W02_TASK 연결 | 영향받는 판단 | 처리 |
|---|---|---|---|---|
| G-01 | 계약 원문 없음 | 5절 1번 | 조건변경 가능 범위 | 통보서 조건만 사용, 원문 필요 시 `INFO_REQUEST` |
| G-02 | 성과 피 정산조건 없음 | 5절 1번 | 연 총 보수(하한 28억만 확정) · 대안 비교 | 판단안 `unknowns` + `INFO_REQUEST`(AGENCY), 권한자는 하한으로도 확정(>10억) |
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
