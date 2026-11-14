/**
 * 기록된 실제 Claude 실행 REC-001 의 원문 (JSON 글자 그대로). 손으로 고치지 않는다.
 *
 * JSON 모듈(import x from './x.json')로 두지 않는 이유: 번들러(next dev · next build)가 JSON 모듈을 JS 로 바꾸면서
 * 소수를 1ULP 다르게 읽는다 (원문 1.3627673894502679 → 번들 1.362767389450268, 서로 다른 double).
 * 그러면 서버가 내보내는 기록 값이 원문과 달라지고 현재 계산 대조(basisCheck)가 거짓 불일치를 낸다.
 * 문자열로 두고 런타임에 JSON.parse 하면 번들을 거쳐도 글자가 그대로다. (String.raw — 역슬래시도 그대로. 백틱 · ${ 는 원문에 없다)
 * 회귀 확인: node scripts/check-recorded-bundle.mjs <BASE_URL>
 */
export const REC_001_TEXT = String.raw`{
  "id": "REC-001",
  "kind": "RECORDED_LIVE_RUN",
  "note": "실제 Claude 실행 1회의 기록. 시연에서는 이 기록을 다시 보여줄 뿐 AI 를 호출하지 않는다. 키 · 요청 헤더는 들어 있지 않다.",
  "executedAt": "2026-11-14T08:19:46.924Z",
  "finishedAt": "2026-11-14T08:20:07.596Z",
  "model": "claude-opus-5-5",
  "request": {
    "sdk": "@anthropic-ai/sdk",
    "thinking": "adaptive",
    "effort": "medium",
    "maxTokens": 16000,
    "system": "너는 Masil(화장품 브랜드) 마케팅 운영의 판단안 작성 보조다. 업무: W02 인플루언서 전속계약 갱신과 캠페인 확대 기안.\n규칙:\n1. 숫자는 get_facts · get_rule_results 가 돌려준 값만 쓴다. 새 숫자를 만들거나 계산하지 않는다(합계 · 비율 · 환산 포함).\n2. 표본(SAMPLE) 금액과 풀스케일(FULL) 금액을 더하거나 곱하지 않는다. 표본 성과는 비중 · 순위 · 방향까지만 말한다.\n3. 주장(회의록 · 기안 예상 GMV · 재무팀 공식 전망)은 판단 근거가 아니다. 숫자로 인용하지 않는다.\n4. 권한자와 건별 권고(승인 · 부결 · 조건부)는 규칙 엔진이 정한다. 바꾸거나 반대로 권고하지 않는다.\n5. 조건변경안의 구체 조건(인하율 등)을 수치로 만들지 않는다(A-23). 모르는 것은 공백 ID(G-xx)로 말한다.\n6. 너는 상태를 바꾸지 않는다. 결정은 권한자(사람)가 한다.\n먼저 도구로 사실 · 규칙 결과 · 대안 · 공백을 읽고, 마지막에 submit_assessment 를 한 번 호출해 한국어로 제출한다.",
    "user": "판단 대상: 전속계약 CTR-INF-001-2026. 도구로 근거를 확인한 뒤 판단안(권고 대안 · 권고 이유 · 마케팅/재무/계약/SCM 관점 근거)을 submit_assessment 로 제출하라.",
    "tools": [
      {
        "name": "get_facts",
        "strict": true,
        "description": "판단 대상의 확인된 사실(도메인 계산 결과)을 돌려준다. 각 항목: key · name · value · label(원본/집계/가정/모의 …) · scale(FULL 풀스케일 / SAMPLE 표본 / NONE). key_prefix 로 거른다(빈 문자열이면 전부)."
      },
      {
        "name": "get_rule_results",
        "strict": true,
        "description": "규칙 엔진 결과(규칙 ID · 결과 · 입력값). 권한자 · 기한 단계 · 재고 게이트 · 건별 권고가 여기 있다. 권한자와 건별 권고는 규칙이 정하므로 바꾸지 않는다."
      },
      {
        "name": "get_alternatives",
        "strict": true,
        "description": "대안 목록(효과 · 위험 · 필요한 권한자)과 규칙 권고 결정. 권고할 수 있는 대안 ID 목록도 포함."
      },
      {
        "name": "get_open_gaps",
        "strict": true,
        "description": "아직 원본에 없는 정보(공백 G-xx)와 영향."
      },
      {
        "name": "get_claims",
        "strict": true,
        "description": "주장(회의록 · 기안 예상 GMV · 공식 전망) 인용. 판단 근거로 쓰지 않는다 — 참고로만."
      },
      {
        "name": "submit_assessment",
        "strict": true,
        "description": "판단안 문장을 제출한다(마지막에 한 번). 문장 속 숫자는 get_facts · get_rule_results 가 돌려준 값만 그대로 쓴다. 주장 숫자(예상 GMV 등)는 쓰지 않는다."
      }
    ]
  },
  "scenario": {
    "steps": [
      "SEED 초기화 (2026-07-01 09:00)",
      "갱신 통보 접수 (RENEWAL_NOTICE_RECEIVED) → 계약 UNDER_REVIEW",
      "계약 판단안 POST /api/assessments (실시간)",
      "승인요청 POST /api/approval-requests (판단안 → 그룹 CEO/이사회)"
    ],
    "simNow": "2026-07-01T09:00:00+09:00",
    "persistence": "POSTGRES",
    "rawSource": "FILES",
    "invokedVia": "route handler 직접 호출 (route → service → PgStore → 공식 SDK). HTTP 서버는 띄우지 않았다"
  },
  "assessmentHttpStatus": 201,
  "assessment": {
    "subjectType": "CONTRACT",
    "subjectIds": [
      "CTR-INF-001-2026"
    ],
    "triggerEventId": "EVT-001",
    "facts": [
      {
        "key": "contract.status",
        "name": "계약 상태",
        "value": {
          "value": "UNDER_REVIEW",
          "label": "AGGREGATED",
          "refs": [],
          "scale": "NONE",
          "method": "운영 상태 (처리 이력) — 검토 중"
        }
      },
      {
        "key": "contract.fixedFee",
        "name": "고정 피 (연)",
        "value": {
          "value": 2800000000,
          "label": "ORIGINAL",
          "refs": [
            {
              "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
              "note": "INF-001 연간 전속계약 갱신 통보"
            }
          ],
          "scale": "FULL"
        }
      },
      {
        "key": "contract.annualAmount",
        "name": "연 금액 (하한)",
        "value": {
          "value": 2800000000,
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
              "note": "INF-001 연간 전속계약 갱신 통보"
            },
            {
              "file": "00_common/approval_authority_policy.md"
            }
          ],
          "scale": "FULL",
          "method": "고정 피 + 성과 피(미확인 → 하한)"
        }
      },
      {
        "key": "contract.noticeDeadline",
        "name": "통보 기한",
        "value": {
          "value": "2026-07-17",
          "label": "ORIGINAL",
          "refs": [
            {
              "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
              "note": "INF-001 연간 전속계약 갱신 통보"
            }
          ],
          "scale": "NONE"
        }
      },
      {
        "key": "contract.daysLeft",
        "name": "통보 기한까지 남은 일수",
        "value": {
          "value": 16,
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
              "note": "INF-001 연간 전속계약 갱신 통보"
            }
          ],
          "scale": "NONE",
          "method": "통보 기한 − 기준시각 (달력일, R-DL-03)"
        }
      },
      {
        "key": "contract.currentTermEnd",
        "name": "현 계약 만료",
        "value": {
          "value": "2026-08-31",
          "label": "ORIGINAL",
          "refs": [
            {
              "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
              "note": "INF-001 연간 전속계약 갱신 통보"
            }
          ],
          "scale": "NONE"
        }
      },
      {
        "key": "contract.autoRenewalTermMonths",
        "name": "미통보 시 자동 갱신 기간(개월)",
        "value": {
          "value": 12,
          "label": "ORIGINAL",
          "refs": [
            {
              "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
              "note": "INF-001 연간 전속계약 갱신 통보"
            }
          ],
          "scale": "NONE"
        }
      },
      {
        "key": "contract.renewalTerm",
        "name": "갱신 시 계약 기간",
        "value": {
          "value": "2026-09-01 ~ 2027-08-31",
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
              "note": "INF-001 연간 전속계약 갱신 통보"
            }
          ],
          "scale": "NONE",
          "method": "만료 다음 날부터 12개월"
        }
      },
      {
        "key": "contract.performanceFee",
        "name": "성과 피 조건",
        "value": {
          "value": "미확인 (G-02)",
          "label": "ORIGINAL",
          "refs": [
            {
              "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
              "note": "INF-001 연간 전속계약 갱신 통보"
            }
          ],
          "scale": "NONE",
          "method": "통보서에 \"GMV 연동, 별도 정산\"만 있음"
        }
      },
      {
        "key": "perf.INF-001.adSpendShare",
        "name": "INF-001 집행 비중 (표본)",
        "value": {
          "value": 0.4057730464358823,
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/marketing/mkt_orders_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_returns_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_ad_spend_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_cost_master_ms.csv"
            }
          ],
          "scale": "NONE",
          "method": "Spend_i / ΣSpend (R-CP-04)"
        }
      },
      {
        "key": "perf.INF-001.adSpendRank",
        "name": "INF-001 집행 비중 순위",
        "value": {
          "value": 1,
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/marketing/mkt_orders_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_returns_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_ad_spend_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_cost_master_ms.csv"
            }
          ],
          "scale": "NONE",
          "method": "내림차순 (R-CP-04)"
        }
      },
      {
        "key": "perf.INF-001.requestShare",
        "name": "INF-001 기안 요청 비중 (표본)",
        "value": {
          "value": 0.28036528564593677,
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/marketing/mkt_budget_plan_ms.csv",
              "column": "requested_budget_krw"
            }
          ],
          "scale": "NONE",
          "method": "Request_i / ΣRequest (R-CP-04)"
        }
      },
      {
        "key": "perf.INF-001.requestRank",
        "name": "INF-001 기안 요청 비중 순위",
        "value": {
          "value": 1,
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/marketing/mkt_budget_plan_ms.csv",
              "column": "requested_budget_krw"
            }
          ],
          "scale": "NONE",
          "method": "내림차순 (R-CP-04)"
        }
      },
      {
        "key": "perf.INF-001.cp",
        "name": "INF-001 실질 공헌이익 (공식값 A05, 표본)",
        "value": {
          "value": -61308789,
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/marketing/mkt_orders_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_returns_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_ad_spend_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_cost_master_ms.csv"
            }
          ],
          "scale": "SAMPLE",
          "method": "R-CP-01 A05 단일 차감",
          "assumptionIds": [
            "A-01",
            "A-02",
            "A-03",
            "A-04",
            "A-05",
            "A-06"
          ]
        }
      },
      {
        "key": "perf.INF-001.cpRank",
        "name": "INF-001 실질 공헌이익 순위",
        "value": {
          "value": 10,
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/marketing/mkt_orders_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_returns_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_ad_spend_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_cost_master_ms.csv"
            }
          ],
          "scale": "NONE",
          "method": "공식값 내림차순 (R-CP-04)"
        }
      },
      {
        "key": "perf.INF-001.nominalRoas",
        "name": "INF-001 명목 ROAS",
        "value": {
          "value": 1.3627673894502679,
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/marketing/mkt_orders_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_returns_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_ad_spend_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_cost_master_ms.csv"
            }
          ],
          "scale": "NONE",
          "method": "GMV / Marketing Spend (R-CP-03)"
        }
      },
      {
        "key": "perf.INF-001.realRoas",
        "name": "INF-001 실질 ROAS (공식)",
        "value": {
          "value": -0.19778583752973586,
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/marketing/mkt_orders_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_returns_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_ad_spend_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_cost_master_ms.csv"
            }
          ],
          "scale": "NONE",
          "method": "cp / Marketing Spend (R-CP-03)"
        }
      },
      {
        "key": "perf.INF-001.realRoasRank",
        "name": "INF-001 실질 ROAS 순위",
        "value": {
          "value": 9,
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/marketing/mkt_orders_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_returns_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_ad_spend_ms.csv"
            },
            {
              "file": "02_masil/marketing/mkt_cost_master_ms.csv"
            }
          ],
          "scale": "NONE",
          "method": "내림차순 (R-CP-04)"
        }
      },
      {
        "key": "perf.influencerCount",
        "name": "비교 인플루언서 수",
        "value": {
          "value": 10,
          "label": "AGGREGATED",
          "refs": [
            {
              "file": "02_masil/master/m_influencer_ms.csv"
            }
          ],
          "scale": "NONE",
          "method": "행 수"
        }
      }
    ],
    "ruleResults": [
      {
        "ruleId": "R-AUTH-02",
        "result": "GROUP_CEO_BOARD",
        "inputs": {
          "annualAmountKrw": 2800000000,
          "limitKrw": 1000000000,
          "lowerBound": true
        },
        "subjectId": "CTR-INF-001-2026"
      },
      {
        "ruleId": "R-DL-03",
        "result": "INFO",
        "inputs": {
          "deadline": "2026-07-17",
          "daysLeft": 16
        },
        "subjectId": "CTR-INF-001-2026"
      },
      {
        "ruleId": "R-DL-02",
        "result": "AUTO_RENEW_IF_NO_VALID_NOTICE",
        "inputs": {
          "noticeDeadline": "2026-07-17",
          "status": "UNDER_REVIEW",
          "autoRenewalTermMonths": 12
        },
        "subjectId": "CTR-INF-001-2026"
      }
    ],
    "alternatives": [
      {
        "id": "A",
        "title": "동일 조건 갱신",
        "decision": "RENEW_SAME",
        "effects": [
          {
            "value": "2026-09-01 ~ 2027-08-31 고정 피 2,800,000,000원 선점",
            "label": "ORIGINAL",
            "refs": [
              {
                "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
                "note": "INF-001 연간 전속계약 갱신 통보"
              }
            ],
            "scale": "FULL"
          }
        ],
        "risks": [
          "표본상 집행 비중 상위 · 실질 공헌이익 하위와 반대 방향 (방향만)"
        ],
        "requiresRole": "GROUP_CEO_BOARD"
      },
      {
        "id": "B",
        "title": "조건변경 통보",
        "decision": "RENEGOTIATE",
        "effects": [
          {
            "value": "기한 전 통보로 자동 갱신 차단 (수령확인까지 필요, 확장 E1)",
            "label": "ORIGINAL",
            "refs": [
              {
                "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
                "note": "INF-001 연간 전속계약 갱신 통보"
              }
            ],
            "scale": "NONE"
          }
        ],
        "risks": [
          "조건 내용은 수치로 만들지 않음 (A-23)",
          "성과 피 조건 미확인 (G-02)"
        ],
        "requiresRole": "GROUP_CEO_BOARD"
      },
      {
        "id": "C",
        "title": "해지 통보",
        "decision": "TERMINATE",
        "effects": [
          {
            "value": "만료(2026-08-31) 전 통보 — 위약금 조항은 갱신 후 중도 해지에만 적용",
            "label": "INTERPRETED",
            "refs": [
              {
                "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
                "note": "INF-001 연간 전속계약 갱신 통보"
              }
            ],
            "scale": "NONE"
          }
        ],
        "risks": [
          "대체 파트너 · 공백 기간 필요",
          "만료 후 재협상 여지는 가정 (A-23)"
        ],
        "requiresRole": "GROUP_CEO_BOARD"
      }
    ],
    "recommendation": {
      "alternativeId": "B",
      "rationale": "규칙 엔진의 건별 권고는 RENEGOTIATE(B)이고, 통보 기한 2026-07-17까지 16일 남았으며, 유효한 통보가 없으면 12개월 자동 갱신된다(R-DL-02). 표본에서 INF-001은 집행 비중 1위지만 실질 공헌이익은 10명 중 10위, 실질 ROAS는 9위로 방향이 반대라서, 같은 조건으로 고정 피 2,800,000,000원을 선점하는 근거가 약하다. 성과 피 조건(G-02)과 통보 효력 요건(G-03)이 미확인이므로, 해지보다 조건변경 통보로 자동 갱신을 막고 협상 여지를 남기는 쪽이 적절하다. 최종 결정은 권한자 GROUP_CEO_BOARD가 한다."
    },
    "perspectives": {
      "marketing": "표본(비교 인플루언서 10명)에서 INF-001은 집행 비중과 기안 요청 비중이 모두 1위다. 반면 실질 공헌이익 순위는 10위, 실질 ROAS 순위는 9위다. 명목 ROAS 1.3627673894502679와 달리 공식 실질 ROAS는 -0.19778583752973586로 음수다. 그래서 집행 비중이 큰 만큼 실질 성과가 따라오지 않는 방향이다. 표본 성과는 비중·순위·방향을 보여 주는 근거로만 쓴다. 회의록과 기안 예상 GMV 같은 주장은 판단 근거로 쓰지 않았다.",
      "finance": "연 금액은 고정 피 2,800,000,000원을 하한으로만 확정했고, 성과 피는 'GMV 연동, 별도 정산'이라는 문구만 있어 미확인이다(G-02, 에이전시에 정보 요청 필요). 표본 실질 공헌이익 -61308789(A05, SAMPLE)는 풀스케일 금액과 합산하거나 대사하지 않는다(G-04). 하한만으로도 R-AUTH-02 한도 1,000,000,000원을 넘으므로 권한자는 GROUP_CEO_BOARD다.",
      "contract": "현재 계약은 2026-08-31에 만료되고, 통보 기한은 2026-07-17(남은 일수 16)이다. 기한 안에 유효한 통보가 없으면 2026-09-01 ~ 2027-08-31로 12개월 자동 갱신된다(R-DL-02). B안이 갱신을 막으려면 수령확인까지 받아야 하는데, 수령확인·재통보·효력 요건은 미확인이다(G-03). 통보서 외 계약 조건(G-01)과 covenant 대조(G-09)도 아직 판정할 수 없다. 조건변경의 구체 내용은 수치로 정하지 않았다(A-23). 계약 상태는 UNDER_REVIEW이며, 상태 변경과 결정은 권한자 GROUP_CEO_BOARD가 한다.",
      "scm": "재고 게이트 등 SCM 관련 규칙 결과는 이 계약 건에 대해 나온 것이 없어, SCM 관점에서 권고를 바꿀 근거는 확인되지 않았다. C안(해지)을 고르면 대체 파트너와 공백 기간이 필요하다는 위험이 있다. 그러니 캠페인과 물량 계획은 B안 협상 결과가 확정된 뒤 맞추는 것이 바람직하다."
    },
    "claimsCited": [
      {
        "text": "이 쟁점의 크기는 기안이 아니라 전속계약에 있다. … 확대 기안(1.8억)은 이 계약의 하위 집행분이다. — 재무팀",
        "ref": {
          "file": "00_common/mkt_meeting_notes_ms.md",
          "note": "핵심 쟁점"
        }
      },
      {
        "text": "기안만 부결하고 전속계약을 자동 갱신시키면 배분 구조는 그대로 유지된다 — 두 건은 별개 결정이므로 함께 처리할 것. — 재무팀",
        "ref": {
          "file": "00_common/mkt_meeting_notes_ms.md",
          "note": "확대 기안"
        }
      },
      {
        "text": "배분 원칙은 매년 같은 방식으로 반복 적용되며, 원칙이 거꾸로 서 있다면 틀리는 것도 매년 반복된다. — 재무팀",
        "ref": {
          "file": "00_common/mkt_meeting_notes_ms.md",
          "note": "핵심 쟁점"
        }
      }
    ],
    "unknowns": [
      {
        "gapId": "G-01",
        "impact": "통보서 조건만 사용, 필요 시 정보 요청",
        "status": "OPEN",
        "statusText": "미확인"
      },
      {
        "gapId": "G-02",
        "impact": "연 금액은 하한(28억)만 확정, 정보 요청(에이전시)",
        "status": "OPEN",
        "statusText": "미확인"
      },
      {
        "gapId": "G-03",
        "impact": "확장 E1 — 수령확인 · 재통보 · 효력 미확인 상태",
        "status": "OPEN",
        "statusText": "미확인"
      },
      {
        "gapId": "G-04",
        "impact": "표본 광고비와 28억을 대사하지 않음 (스케일 다름)",
        "status": "OPEN",
        "statusText": "미확인"
      },
      {
        "gapId": "G-09",
        "impact": "계약의 covenant 대조 판정 불가 표시",
        "status": "OPEN",
        "statusText": "미확인"
      }
    ],
    "proposedDecisions": [
      {
        "itemId": "CTR-INF-001-2026",
        "decision": "RENEGOTIATE"
      }
    ],
    "aiMode": "LIVE",
    "model": "claude-opus-5-5",
    "createdAt": "2026-07-01T09:00:00+09:00",
    "toolCalls": [
      {
        "name": "get_facts",
        "input": {
          "key_prefix": ""
        },
        "output": [
          {
            "key": "contract.status",
            "name": "계약 상태",
            "value": "UNDER_REVIEW",
            "label": "AGGREGATED",
            "scale": "NONE",
            "method": "운영 상태 (처리 이력) — 검토 중"
          },
          {
            "key": "contract.fixedFee",
            "name": "고정 피 (연)",
            "value": 2800000000,
            "label": "ORIGINAL",
            "scale": "FULL"
          },
          {
            "key": "contract.annualAmount",
            "name": "연 금액 (하한)",
            "value": 2800000000,
            "label": "AGGREGATED",
            "scale": "FULL",
            "method": "고정 피 + 성과 피(미확인 → 하한)"
          },
          {
            "key": "contract.noticeDeadline",
            "name": "통보 기한",
            "value": "2026-07-17",
            "label": "ORIGINAL",
            "scale": "NONE"
          },
          {
            "key": "contract.daysLeft",
            "name": "통보 기한까지 남은 일수",
            "value": 16,
            "label": "AGGREGATED",
            "scale": "NONE",
            "method": "통보 기한 − 기준시각 (달력일, R-DL-03)"
          },
          {
            "key": "contract.currentTermEnd",
            "name": "현 계약 만료",
            "value": "2026-08-31",
            "label": "ORIGINAL",
            "scale": "NONE"
          },
          {
            "key": "contract.autoRenewalTermMonths",
            "name": "미통보 시 자동 갱신 기간(개월)",
            "value": 12,
            "label": "ORIGINAL",
            "scale": "NONE"
          },
          {
            "key": "contract.renewalTerm",
            "name": "갱신 시 계약 기간",
            "value": "2026-09-01 ~ 2027-08-31",
            "label": "AGGREGATED",
            "scale": "NONE",
            "method": "만료 다음 날부터 12개월"
          },
          {
            "key": "contract.performanceFee",
            "name": "성과 피 조건",
            "value": "미확인 (G-02)",
            "label": "ORIGINAL",
            "scale": "NONE",
            "method": "통보서에 \"GMV 연동, 별도 정산\"만 있음"
          },
          {
            "key": "perf.INF-001.adSpendShare",
            "name": "INF-001 집행 비중 (표본)",
            "value": 0.4057730464358823,
            "label": "AGGREGATED",
            "scale": "NONE",
            "method": "Spend_i / ΣSpend (R-CP-04)"
          },
          {
            "key": "perf.INF-001.adSpendRank",
            "name": "INF-001 집행 비중 순위",
            "value": 1,
            "label": "AGGREGATED",
            "scale": "NONE",
            "method": "내림차순 (R-CP-04)"
          },
          {
            "key": "perf.INF-001.requestShare",
            "name": "INF-001 기안 요청 비중 (표본)",
            "value": 0.28036528564593677,
            "label": "AGGREGATED",
            "scale": "NONE",
            "method": "Request_i / ΣRequest (R-CP-04)"
          },
          {
            "key": "perf.INF-001.requestRank",
            "name": "INF-001 기안 요청 비중 순위",
            "value": 1,
            "label": "AGGREGATED",
            "scale": "NONE",
            "method": "내림차순 (R-CP-04)"
          },
          {
            "key": "perf.INF-001.cp",
            "name": "INF-001 실질 공헌이익 (공식값 A05, 표본)",
            "value": -61308789,
            "label": "AGGREGATED",
            "scale": "SAMPLE",
            "method": "R-CP-01 A05 단일 차감"
          },
          {
            "key": "perf.INF-001.cpRank",
            "name": "INF-001 실질 공헌이익 순위",
            "value": 10,
            "label": "AGGREGATED",
            "scale": "NONE",
            "method": "공식값 내림차순 (R-CP-04)"
          },
          {
            "key": "perf.INF-001.nominalRoas",
            "name": "INF-001 명목 ROAS",
            "value": 1.3627673894502679,
            "label": "AGGREGATED",
            "scale": "NONE",
            "method": "GMV / Marketing Spend (R-CP-03)"
          },
          {
            "key": "perf.INF-001.realRoas",
            "name": "INF-001 실질 ROAS (공식)",
            "value": -0.19778583752973586,
            "label": "AGGREGATED",
            "scale": "NONE",
            "method": "cp / Marketing Spend (R-CP-03)"
          },
          {
            "key": "perf.INF-001.realRoasRank",
            "name": "INF-001 실질 ROAS 순위",
            "value": 9,
            "label": "AGGREGATED",
            "scale": "NONE",
            "method": "내림차순 (R-CP-04)"
          },
          {
            "key": "perf.influencerCount",
            "name": "비교 인플루언서 수",
            "value": 10,
            "label": "AGGREGATED",
            "scale": "NONE",
            "method": "행 수"
          }
        ],
        "actor": "AI"
      },
      {
        "name": "get_rule_results",
        "input": {},
        "output": [
          {
            "ruleId": "R-AUTH-02",
            "result": "GROUP_CEO_BOARD",
            "inputs": {
              "annualAmountKrw": 2800000000,
              "limitKrw": 1000000000,
              "lowerBound": true
            },
            "subjectId": "CTR-INF-001-2026"
          },
          {
            "ruleId": "R-DL-03",
            "result": "INFO",
            "inputs": {
              "deadline": "2026-07-17",
              "daysLeft": 16
            },
            "subjectId": "CTR-INF-001-2026"
          },
          {
            "ruleId": "R-DL-02",
            "result": "AUTO_RENEW_IF_NO_VALID_NOTICE",
            "inputs": {
              "noticeDeadline": "2026-07-17",
              "status": "UNDER_REVIEW",
              "autoRenewalTermMonths": 12
            },
            "subjectId": "CTR-INF-001-2026"
          }
        ],
        "actor": "AI"
      },
      {
        "name": "get_alternatives",
        "input": {},
        "output": {
          "alternatives": [
            {
              "id": "A",
              "title": "동일 조건 갱신",
              "decision": "RENEW_SAME",
              "effects": [
                {
                  "value": "2026-09-01 ~ 2027-08-31 고정 피 2,800,000,000원 선점",
                  "label": "ORIGINAL",
                  "refs": [
                    {
                      "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
                      "note": "INF-001 연간 전속계약 갱신 통보"
                    }
                  ],
                  "scale": "FULL"
                }
              ],
              "risks": [
                "표본상 집행 비중 상위 · 실질 공헌이익 하위와 반대 방향 (방향만)"
              ],
              "requiresRole": "GROUP_CEO_BOARD"
            },
            {
              "id": "B",
              "title": "조건변경 통보",
              "decision": "RENEGOTIATE",
              "effects": [
                {
                  "value": "기한 전 통보로 자동 갱신 차단 (수령확인까지 필요, 확장 E1)",
                  "label": "ORIGINAL",
                  "refs": [
                    {
                      "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
                      "note": "INF-001 연간 전속계약 갱신 통보"
                    }
                  ],
                  "scale": "NONE"
                }
              ],
              "risks": [
                "조건 내용은 수치로 만들지 않음 (A-23)",
                "성과 피 조건 미확인 (G-02)"
              ],
              "requiresRole": "GROUP_CEO_BOARD"
            },
            {
              "id": "C",
              "title": "해지 통보",
              "decision": "TERMINATE",
              "effects": [
                {
                  "value": "만료(2026-08-31) 전 통보 — 위약금 조항은 갱신 후 중도 해지에만 적용",
                  "label": "INTERPRETED",
                  "refs": [
                    {
                      "file": "02_masil/marketing/inf001_exclusive_contract_notice.md",
                      "note": "INF-001 연간 전속계약 갱신 통보"
                    }
                  ],
                  "scale": "NONE"
                }
              ],
              "risks": [
                "대체 파트너 · 공백 기간 필요",
                "만료 후 재협상 여지는 가정 (A-23)"
              ],
              "requiresRole": "GROUP_CEO_BOARD"
            }
          ],
          "proposedDecisions": [
            {
              "itemId": "CTR-INF-001-2026",
              "decision": "RENEGOTIATE"
            }
          ],
          "allowedAlternativeIds": [
            "A",
            "B",
            "C"
          ],
          "ruleDefaultRecommendation": "B"
        },
        "actor": "AI"
      },
      {
        "name": "get_open_gaps",
        "input": {},
        "output": [
          {
            "gapId": "G-01",
            "impact": "통보서 조건만 사용, 필요 시 정보 요청",
            "status": "OPEN",
            "statusText": "미확인"
          },
          {
            "gapId": "G-02",
            "impact": "연 금액은 하한(28억)만 확정, 정보 요청(에이전시)",
            "status": "OPEN",
            "statusText": "미확인"
          },
          {
            "gapId": "G-03",
            "impact": "확장 E1 — 수령확인 · 재통보 · 효력 미확인 상태",
            "status": "OPEN",
            "statusText": "미확인"
          },
          {
            "gapId": "G-04",
            "impact": "표본 광고비와 28억을 대사하지 않음 (스케일 다름)",
            "status": "OPEN",
            "statusText": "미확인"
          },
          {
            "gapId": "G-09",
            "impact": "계약의 covenant 대조 판정 불가 표시",
            "status": "OPEN",
            "statusText": "미확인"
          }
        ],
        "actor": "AI"
      },
      {
        "name": "get_claims",
        "input": {},
        "output": {
          "note": "주장 — 판단 근거 아님 (R-CLAIM-01)",
          "claims": [
            {
              "text": "이 쟁점의 크기는 기안이 아니라 전속계약에 있다. … 확대 기안(1.8억)은 이 계약의 하위 집행분이다. — 재무팀",
              "ref": {
                "file": "00_common/mkt_meeting_notes_ms.md",
                "note": "핵심 쟁점"
              }
            },
            {
              "text": "기안만 부결하고 전속계약을 자동 갱신시키면 배분 구조는 그대로 유지된다 — 두 건은 별개 결정이므로 함께 처리할 것. — 재무팀",
              "ref": {
                "file": "00_common/mkt_meeting_notes_ms.md",
                "note": "확대 기안"
              }
            },
            {
              "text": "배분 원칙은 매년 같은 방식으로 반복 적용되며, 원칙이 거꾸로 서 있다면 틀리는 것도 매년 반복된다. — 재무팀",
              "ref": {
                "file": "00_common/mkt_meeting_notes_ms.md",
                "note": "핵심 쟁점"
              }
            }
          ]
        },
        "actor": "AI"
      },
      {
        "name": "submit_assessment",
        "input": {
          "recommended_alternative_id": "B",
          "rationale": "규칙 엔진의 건별 권고는 RENEGOTIATE(B)이고, 통보 기한 2026-07-17까지 16일 남았으며, 유효한 통보가 없으면 12개월 자동 갱신된다(R-DL-02). 표본에서 INF-001은 집행 비중 1위지만 실질 공헌이익은 10명 중 10위, 실질 ROAS는 9위로 방향이 반대라서, 같은 조건으로 고정 피 2,800,000,000원을 선점하는 근거가 약하다. 성과 피 조건(G-02)과 통보 효력 요건(G-03)이 미확인이므로, 해지보다 조건변경 통보로 자동 갱신을 막고 협상 여지를 남기는 쪽이 적절하다. 최종 결정은 권한자 GROUP_CEO_BOARD가 한다.",
          "perspectives": {
            "marketing": "표본(비교 인플루언서 10명)에서 INF-001은 집행 비중과 기안 요청 비중이 모두 1위다. 반면 실질 공헌이익 순위는 10위, 실질 ROAS 순위는 9위다. 명목 ROAS 1.3627673894502679와 달리 공식 실질 ROAS는 -0.19778583752973586로 음수다. 그래서 집행 비중이 큰 만큼 실질 성과가 따라오지 않는 방향이다. 표본 성과는 비중·순위·방향을 보여 주는 근거로만 쓴다. 회의록과 기안 예상 GMV 같은 주장은 판단 근거로 쓰지 않았다.",
            "finance": "연 금액은 고정 피 2,800,000,000원을 하한으로만 확정했고, 성과 피는 'GMV 연동, 별도 정산'이라는 문구만 있어 미확인이다(G-02, 에이전시에 정보 요청 필요). 표본 실질 공헌이익 -61308789(A05, SAMPLE)는 풀스케일 금액과 합산하거나 대사하지 않는다(G-04). 하한만으로도 R-AUTH-02 한도 1,000,000,000원을 넘으므로 권한자는 GROUP_CEO_BOARD다.",
            "contract": "현재 계약은 2026-08-31에 만료되고, 통보 기한은 2026-07-17(남은 일수 16)이다. 기한 안에 유효한 통보가 없으면 2026-09-01 ~ 2027-08-31로 12개월 자동 갱신된다(R-DL-02). B안이 갱신을 막으려면 수령확인까지 받아야 하는데, 수령확인·재통보·효력 요건은 미확인이다(G-03). 통보서 외 계약 조건(G-01)과 covenant 대조(G-09)도 아직 판정할 수 없다. 조건변경의 구체 내용은 수치로 정하지 않았다(A-23). 계약 상태는 UNDER_REVIEW이며, 상태 변경과 결정은 권한자 GROUP_CEO_BOARD가 한다.",
            "scm": "재고 게이트 등 SCM 관련 규칙 결과는 이 계약 건에 대해 나온 것이 없어, SCM 관점에서 권고를 바꿀 근거는 확인되지 않았다. C안(해지)을 고르면 대체 파트너와 공백 기간이 필요하다는 위험이 있다. 그러니 캠페인과 물량 계획은 B안 협상 결과가 확정된 뒤 맞추는 것이 바람직하다."
          }
        },
        "output": null,
        "actor": "AI"
      }
    ],
    "fallbackReason": null,
    "stopReason": "tool_use",
    "warnings": [],
    "aiTrace": [
      {
        "messageId": "msg_011Ch2VauQvA6HuX5LgE1G7Z",
        "model": "claude-opus-5-5",
        "stopReason": "tool_use",
        "inputTokens": 1985,
        "outputTokens": 154
      },
      {
        "messageId": "msg_011Ch2VbJbhBMSN3qoLKM74c",
        "model": "claude-opus-5-5",
        "stopReason": "tool_use",
        "inputTokens": 5532,
        "outputTokens": 1472
      }
    ],
    "id": "ASM-001",
    "version": 1,
    "mock": false,
    "provenance": {
      "ok": true,
      "violations": []
    },
    "approvalRequestIds": []
  },
  "followUp": {
    "approvalHttpStatus": 201,
    "approvalRequests": [
      {
        "subjectType": "CONTRACT",
        "subjectIds": [
          "CTR-INF-001-2026"
        ],
        "requiredRole": "GROUP_CEO_BOARD",
        "alsoReportTo": [],
        "routingReasons": [
          {
            "ruleId": "R-AUTH-02",
            "text": "연 금액 하한 2,800,000,000원 > 10억원 → 그룹 CEO/이사회 (미통보 자동 갱신도 체결)",
            "label": "ORIGINAL"
          }
        ],
        "assessmentId": "ASM-001",
        "proposed": [
          {
            "itemId": "CTR-INF-001-2026",
            "decision": "RENEGOTIATE"
          }
        ],
        "internalDueAt": "2026-07-15T23:59:59+09:00",
        "hardDeadline": "2026-07-17",
        "version": 1,
        "supersedesId": null,
        "id": "APR-001",
        "status": "PENDING"
      }
    ],
    "audit": [
      {
        "id": "AUD-0001",
        "entityType": "CONTRACT",
        "entityId": "CTR-INF-001-2026",
        "fromStatus": "ACTIVE",
        "toStatus": "UNDER_REVIEW",
        "actorRole": "CONTRACT_OFFICER",
        "actorKind": "HUMAN",
        "ruleIds": [
          "R-AUTH-02"
        ],
        "eventId": "EVT-001",
        "reason": "갱신 통보 접수 (inf001_exclusive_contract_notice.md)",
        "simAt": "2026-07-01T09:00:00+09:00",
        "createdAt": "2026-07-01T09:00:00+09:00",
        "snapshot": {
          "decision": null,
          "noticeDeadline": "2026-07-17"
        },
        "fromText": "유효 (검토 전)",
        "toText": "검토 중",
        "displayText": "유효 (검토 전) → 검토 중"
      },
      {
        "id": "AUD-0002",
        "entityType": "ASSESSMENT",
        "entityId": "ASM-001",
        "fromStatus": null,
        "toStatus": "CREATED",
        "actorRole": "AI_AGENT",
        "actorKind": "AI",
        "ruleIds": [
          "R-AUTH-02",
          "R-DL-03",
          "R-DL-02"
        ],
        "eventId": null,
        "reason": "판단안 v1 (CONTRACT: CTR-INF-001-2026) — 권고 B",
        "simAt": "2026-07-01T09:00:00+09:00",
        "createdAt": "2026-07-01T09:00:00+09:00",
        "snapshot": {
          "model": "claude-opus-5-5",
          "aiMode": "LIVE",
          "subjectIds": [
            "CTR-INF-001-2026"
          ]
        },
        "fromText": null,
        "toText": "생성",
        "displayText": "판단안 생성 ASM-001"
      },
      {
        "id": "AUD-0003",
        "entityType": "APPROVAL_REQUEST",
        "entityId": "APR-001",
        "fromStatus": null,
        "toStatus": "PENDING",
        "actorRole": "SYSTEM",
        "actorKind": "SYSTEM",
        "ruleIds": [
          "R-AUTH-02"
        ],
        "eventId": null,
        "reason": "승인요청 생성 → GROUP_CEO_BOARD",
        "simAt": "2026-07-01T09:00:00+09:00",
        "createdAt": "2026-07-01T09:00:00+09:00",
        "snapshot": {
          "version": 1,
          "proposed": [
            {
              "itemId": "CTR-INF-001-2026",
              "decision": "RENEGOTIATE"
            }
          ],
          "subjectIds": [
            "CTR-INF-001-2026"
          ],
          "supersedesId": null
        },
        "fromText": null,
        "toText": "대기",
        "displayText": "생성: 대기"
      },
      {
        "id": "AUD-0004",
        "entityType": "CONTRACT",
        "entityId": "CTR-INF-001-2026",
        "fromStatus": "UNDER_REVIEW",
        "toStatus": "PENDING_APPROVAL",
        "actorRole": "SYSTEM",
        "actorKind": "SYSTEM",
        "ruleIds": [
          "R-AUTH-02"
        ],
        "eventId": null,
        "reason": "권한자 GROUP_CEO_BOARD 에게 상신",
        "simAt": "2026-07-01T09:00:00+09:00",
        "createdAt": "2026-07-01T09:00:00+09:00",
        "snapshot": {
          "decision": null,
          "noticeDeadline": "2026-07-17"
        },
        "fromText": "검토 중",
        "toText": "승인 대기",
        "displayText": "검토 중 → 승인 대기"
      }
    ]
  }
}`;
