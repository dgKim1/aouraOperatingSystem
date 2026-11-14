/**
 * 데이터 출처 · 가정 · 공백 · 주장 목록 — docs/ONTOLOGY.md 5절 · 6절과 회의록을 화면용으로 옮긴 모의 응답.
 * 2단계에서 GET /api/data-registry 로 대체한다 (문서가 기준, 이 파일은 사본).
 */
import 'server-only';
import type { SourceRef } from '@/domain/types';

export const ASSUMPTIONS: { id: string; text: string; reason: string; usedIn: string }[] = [
  { id: 'A-01', text: '주문 1건 = 1EA → 제품원가 · 배송비를 주문당 1회', reason: '주문 행에 수량 없음 (A05 5절 "가정이 필요")', usedIn: 'R-CP' },
  { id: 'A-02', text: '채널수수료 = GMV(쿠폰 반영 후) × channel_fee_pct', reason: '수수료 매출 기준 원본 없음', usedIn: 'R-CP' },
  { id: 'A-03', text: '반품물류비 = 반품 주문당 1회', reason: '적용 횟수 원본 없음', usedIn: 'R-CP' },
  { id: 'A-04', text: '환불 시 원가 · 수수료 회수 없음', reason: 'A05 "자료가 없는 비용 회수는 확정 사실로 가정하지 않는다"', usedIn: 'R-CP' },
  { id: 'A-05', text: 'mkt_orders_ms.campaign_id = last-click 7일 귀속 결과', reason: 'calculation_definitions 1.4 귀속 규칙 (원본근거해석)', usedIn: 'R-CP' },
  { id: 'A-06', text: '성과 집계 기간 = 표본 전 기간, 주문 집단 기준', reason: 'A05 "채택한 기준을 설명"', usedIn: 'R-CP' },
  { id: 'A-07', text: '권고 등급 = 공식 cp(A05) 부호, cp ≤ 0 이면 부결 권고', reason: '원본에 권고 기준 없음', usedIn: '판단안' },
  { id: 'A-08', text: '재전망에서 기준일 이전 만기 항목은 제외(기본), 민감도로 as-of 반영', reason: '1.2 는 "due_date 에 배치"만 규정', usedIn: 'R-CASH' },
  { id: 'A-09', text: '주말 만기 현금은 다음 영업일 잔액에 반영', reason: 'covenant 는 영업일 판정', usedIn: 'R-CASH' },
  { id: 'A-10', text: 'settlement_date = 기안 현금 유출일', reason: '회의록 문구 (원본근거해석)', usedIn: 'R-AUTH-03' },
  { id: 'A-11', text: '승인요청 묶음 = 권한자 × 확정기한 × 대상 종류', reason: '원본에 상신 단위 없음', usedIn: '승인요청' },
  { id: 'A-12', text: '내부 처리 기한 D-2 / D-1 / D-0', reason: '통보 도달 시간 확보', usedIn: 'R-DL-04' },
  { id: 'A-13', text: '기한 시각 23:59:59 KST', reason: '원본에 시각 없음', usedIn: '기한 감시' },
  { id: 'A-14', text: '수령 미확인 통보는 효력 미확인으로 관리', reason: '통보 수령 증빙 공백 (W02 5절)', usedIn: '확장 E1' },
  { id: 'A-15', text: '고정 피는 12개월 균등', reason: '지급 일정 없음', usedIn: 'R-PEN-01' },
  { id: 'A-16', text: '주력 SKU = 캠페인 표본 GMV 비중 ≥ 20%', reason: '캠페인 → SKU 대응표 없음', usedIn: 'R-INV-03' },
  { id: 'A-17', text: 'Target Qty = 안전재고 max 주수 × 4주 평균', reason: '1.3 에 Target 정의 없음', usedIn: 'R-INV-04' },
  { id: 'A-18', text: '최종 발주량 = MOQ 배수 올림', reason: '"MOQ 제약 반영"의 방식 미정', usedIn: 'R-INV-04' },
  { id: 'A-19', text: '신규 발주 지급일 = 발주일 + 25일', reason: '기발주 14건 발주일 → 지급일 패턴', usedIn: 'R-AUTH-04' },
  { id: 'A-20', text: '리드타임 = 발주일→입고 소요, in_transit 입고일은 미상', reason: '원본에 입고일 없음', usedIn: 'R-INV-02' },
  { id: 'A-21', text: '가상 기준시각 시작 2026-07-01 09:00 KST, 앞으로만 이동', reason: '데이터 as-of', usedIn: '전체' },
  { id: 'A-22', text: '계약 담당 역할 존재', reason: 'BPMN 교육용 가정, 법무 독립 부서 미확정', usedIn: '작업 담당' },
  { id: 'A-23', text: '조건변경안의 구체 조건은 수치로 만들지 않는다', reason: '원본 근거 없음 — 수치 생성 시 사실처럼 보일 위험', usedIn: '대안' },
  { id: 'A-24', text: '모의 회신 문구 · 날짜 (시연 시나리오)', reason: '외부 승인 대체', usedIn: '시연' },
  { id: 'A-25', text: '기한 경고 단계 D-7 / D-3', reason: '화면 표시용', usedIn: 'R-DL-03' },
  { id: 'A-26', text: '집행일이 확정기한보다 앞선 건은 결정 필요 시점을 앞당겨 표시', reason: 'settlement_date 의미 미확정', usedIn: 'R-DL-05' },
];

export const GAPS: { id: string; text: string; link: string; handling: string }[] = [
  { id: 'G-01', text: '계약 원문 없음', link: 'W02_TASK 5절 1번', handling: '통보서 조건만 사용, 필요 시 정보 요청' },
  { id: 'G-02', text: '성과 피 정산조건 없음', link: 'W02_TASK 5절 1번', handling: '연 금액은 하한(28억)만 확정, 정보 요청(에이전시)' },
  { id: 'G-03', text: '실제 통보 수령 증빙 없음', link: 'W02_TASK 5절 1번', handling: '확장 E1 — 수령확인 · 재통보 · 효력 미확인 상태' },
  { id: 'G-04', text: '연간 계약 vs 캠페인 비용 귀속 · 중복', link: 'W02_TASK 5절 2번', handling: '표본 광고비와 28억을 대사하지 않음 (스케일 다름)' },
  { id: 'G-05', text: '담당자별 검토 · 상신 · 통보 이력 없음', link: 'W02_TASK 5절 3번', handling: '시스템 도입 이후 처리 이력으로 쌓음' },
  { id: 'G-06', text: '법무 · 계약 독립 부서 · 서명 절차 미확정', link: 'W02_TASK 5절 4번', handling: '계약 담당 역할 가정 (A-22)' },
  { id: 'G-07', text: '물류 추가비용 · CS 문의 원본 없음', link: 'W02_TASK 3-7절', handling: '공헌이익에 미포함 표시, 가정 데이터 만들지 않음' },
  { id: 'G-08', text: 'in_transit 입고일 · 기발주(SPO) 포함 여부', link: 'W02_TASK 3-6절', handling: 'SCM 정보 요청, 품절일은 입고 제외 기준' },
  { id: 'G-09', text: '고정 피 지급 일정', link: 'W02_TASK 3-5절', handling: '계약의 covenant 대조 판정 불가 표시' },
  { id: 'G-10', text: 'covenant "완충 목표" 문장이 끊겨 있음', link: 'W02_TASK 3-5절', handling: '30억만 사용' },
  { id: 'G-11', text: '집행일이 확정기한보다 앞선 12건', link: 'W02_TASK 3-3절', handling: 'A-26 플래그' },
  { id: 'G-12', text: 'reserved_qty 없음', link: 'W02_TASK 3-6절', handling: '원본 규칙대로 on_hand 만' },
  { id: 'G-13', text: '캠페인 증분 수요(풀스케일)', link: 'W02_TASK 3-6절', handling: '수량 · 금액 환산 안 함, 방향만' },
];

const NOTES = '00_common/mkt_meeting_notes_ms.md';

/** 주장(CLAIM) 인용 — 판단 근거로 쓰지 않는다 (R-CLAIM-01) */
export const CLAIMS: { text: string; ref: SourceRef }[] = [
  { text: '배분 원칙은 매년 같은 방식으로 반복 적용되며, 원칙이 거꾸로 서 있다면 틀리는 것도 매년 반복된다. — 재무팀', ref: { file: NOTES, note: '핵심 쟁점' } },
  { text: '이 쟁점의 크기는 기안이 아니라 전속계약에 있다. … 확대 기안(1.8억)은 이 계약의 하위 집행분이다. — 재무팀', ref: { file: NOTES, note: '핵심 쟁점' } },
  { text: '기안만 부결하고 전속계약을 자동 갱신시키면 배분 구조는 그대로 유지된다 — 두 건은 별개 결정이므로 함께 처리할 것. — 재무팀', ref: { file: NOTES, note: '확대 기안' } },
  { text: '본 기안은 자금 전망의 유출 산식에 포함되지 않는다. … 마케팅은 자금 문제의 해법이 아니다. — 재무팀', ref: { file: NOTES, note: '확대 기안' } },
  { text: '보고서 첫 장은 예상 GMV 중심 (기안 예상 GMV expected_gmv_krw)', ref: { file: '02_masil/marketing/mkt_budget_plan_ms.csv', column: 'expected_gmv_krw' } },
  { text: '재무팀 공식 현금 전망 (주간 projected_closing)', ref: { file: '02_masil/financials/fin_cash_forecast_ms.csv', column: 'projected_closing_krw' } },
];

export const INCONSISTENCIES: { topic: string; handling: string }[] = [
  { topic: '공헌이익 정의 충돌 — calculation_definitions 1.4 문자 그대로(쿠폰 · 환불 이중 차감) vs A05 5절 단일 차감', handling: '공식값 = A05 5절 (A05 1절 · A01 4절 · 8절 우선 규정). 1.4 값은 참고값으로만 표시, 판단 · 권고 · 순위에 쓰지 않음' },
  { topic: '재무팀 공식 전망(하회 없음) vs 재전망(7/21~8/21 하회)', handling: '공식 전망은 주장으로 표시, 차이 원인(7/21 기발주 대금 일괄 지급) 설명 — 원인 확정은 미확인' },
  { topic: 'settlement_date 의 의미 (현금 유출일? 집행일?)', handling: '현금 유출일로 해석 (A-10, 원본근거해석) · 확정기한보다 앞선 12건은 결정 필요 시점을 앞당겨 표시 (A-26)' },
  { topic: '기안 금액이 표본 계열 파일인데 승인 권한 판정 기준', handling: '권한 판정에는 기안 요청액 그대로 사용 (W02_TASK 3-3 원본근거해석), 풀스케일 금액과는 합산하지 않음' },
];
