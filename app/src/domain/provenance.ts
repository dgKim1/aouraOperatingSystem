/**
 * 판단안 숫자 출처 검증 (AC-1-05, CLAUDE.md 규칙 9 · R-CLAIM-01).
 *
 * 규칙
 *  1. 판단안 문장(권고 이유 · 관점별 근거 · 대안 제목 · 효과 · 위험)에 나오는 숫자는 facts · ruleResults 에 있는 값만 허용한다.
 *  2. 주장(예상 GMV 등) 숫자는 claimsCited 에만 있어야 한다 — 문장 · facts · ruleResults 에 나오면 위반.
 *  3. facts 에 CLAIM 라벨 값이 있으면 위반 (주장은 판단 입력이 아니다).
 *
 * 숫자로 보지 않는 것: 날짜(2026-07-17 · 7/17 · 7월 17일), 식별자(PLAN-001 · INF-001 · R-AUTH-03 · G-02 · A-23 · CF-v2 · E1 · D-16 · A05),
 * 문서 절 번호(1.4 · 5절), 0~12 의 작은 정수(건수 · 개월 · 순위 · 주), 연도(2025~2027).
 * 단위: '%'(비율 ×100), '억'(×1e8), '만'(×1e4), '천만'(×1e7). 반올림된 표기는 표기 자릿수의 반 단위까지 허용한다.
 */
import type { Assessment, Sourced } from './types';

export interface NumberToken {
  raw: string;
  value: number;
  /** 표기 정밀도 (같다고 보는 허용 오차) */
  tolerance: number;
}

export interface ProvenanceViolation {
  field: string;
  token: string;
  reason: 'NUMBER_NOT_IN_FACTS' | 'CLAIM_NUMBER_IN_TEXT' | 'CLAIM_IN_FACTS' | 'CLAIM_NUMBER_IN_FACTS';
}

export interface ProvenanceResult {
  ok: boolean;
  violations: ProvenanceViolation[];
}

const IGNORE_PATTERNS: RegExp[] = [
  /\d{4}-\d{2}-\d{2}(T[\d:+.]+)?/g, // ISO 날짜 · 시각
  /\b[A-Z]{1,6}(?:-[A-Za-z]{1,6})*-v?\d+[A-Za-z]?\b/g, // PLAN-001 · R-AUTH-03 · G-02 · A-23 · CF-v2 · D-16 · SPO-0001
  /\b[A-Z]\d{1,2}\b/g, // E1 · D2 · A05 · F1
  /\bv\d+\b/g, // v2
  /\d{1,2}\/\d{1,2}/g, // 7/17
  /\d{1,2}월\s?\d{1,2}일/g, // 7월 17일
  /\d+(\.\d+)*\s?절/g, // 5절 · 3-3절
  /\d+-\d+\s?절/g,
  /(calculation_definitions|정의|정의서)\s?\d+(\.\d+)+/g, // 1.4
  /\b1\.[1-9]\s?(문자|참고|정의|산식|기준)/g, // '1.4 문자 그대로'
];

const NUM_RE = /([-−–]?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s?(천만|억|만|%)?/g;

/** 문장에서 숫자 토큰 추출 (무시 패턴 제거 후) */
export function extractNumbers(text: string): NumberToken[] {
  let t = text;
  for (const re of IGNORE_PATTERNS) t = t.replace(re, ' ');
  const out: NumberToken[] = [];
  for (const m of t.matchAll(NUM_RE)) {
    const [raw, sign, intPart, frac, unit] = m as unknown as [string, string, string, string | undefined, string | undefined];
    const base = Number(`${intPart.replace(/,/g, '')}${frac ?? ''}`);
    const decimals = frac ? frac.length - 1 : 0;
    const mult = unit === '억' ? 1e8 : unit === '천만' ? 1e7 : unit === '만' ? 1e4 : unit === '%' ? 0.01 : 1;
    const neg = sign !== '' ? -1 : 1;
    out.push({ raw: raw.trim(), value: neg * base * mult, tolerance: 0.5 * 10 ** -decimals * mult + 1e-9 });
  }
  return out;
}

function isTrivial(tok: NumberToken): boolean {
  const v = Math.abs(tok.value);
  const integral = Number.isInteger(v) && !tok.raw.includes('%') && !/[억만]/.test(tok.raw);
  if (integral && v <= 12) return true;
  if (integral && v >= 2025 && v <= 2027) return true;
  return false;
}

/** 값에서 숫자 모으기 (중첩 객체 · 배열 · 문자열 안의 숫자 포함) */
export function collectNumbers(x: unknown, into: number[] = []): number[] {
  if (typeof x === 'number' && Number.isFinite(x)) into.push(x);
  else if (typeof x === 'string') for (const t of extractNumbers(x)) into.push(t.value);
  else if (Array.isArray(x)) for (const v of x) collectNumbers(v, into);
  else if (x && typeof x === 'object') for (const v of Object.values(x)) collectNumbers(v, into);
  return into;
}

function matches(tok: NumberToken, allowed: readonly number[]): boolean {
  return allowed.some((a) => Math.abs(Math.abs(a) - Math.abs(tok.value)) <= tok.tolerance);
}

type Checked = Pick<Assessment, 'facts' | 'ruleResults' | 'claimsCited' | 'recommendation' | 'perspectives' | 'alternatives'>;

/** 판단안 문장 필드 목록 (검증 대상) */
export function narrativeFields(a: Pick<Assessment, 'recommendation' | 'perspectives' | 'alternatives'>): { field: string; text: string }[] {
  const out: { field: string; text: string }[] = [
    { field: 'recommendation.rationale', text: a.recommendation.rationale },
    { field: 'perspectives.marketing', text: a.perspectives.marketing },
    { field: 'perspectives.finance', text: a.perspectives.finance },
    { field: 'perspectives.contract', text: a.perspectives.contract },
    { field: 'perspectives.scm', text: a.perspectives.scm },
  ];
  a.alternatives.forEach((alt, i) => {
    out.push({ field: `alternatives[${i}].title`, text: alt.title });
    alt.risks.forEach((r, j) => out.push({ field: `alternatives[${i}].risks[${j}]`, text: r }));
    alt.effects.forEach((e, j) => out.push({ field: `alternatives[${i}].effects[${j}]`, text: typeof e.value === 'string' ? e.value : JSON.stringify(e.value) }));
  });
  return out;
}

export function validateAssessmentNumbers(a: Checked): ProvenanceResult {
  const violations: ProvenanceViolation[] = [];
  const allowed: number[] = [];
  for (const f of a.facts) {
    const v = f.value as Sourced<unknown>;
    if (v.label === 'CLAIM') violations.push({ field: `facts.${f.key}`, token: String(v.value), reason: 'CLAIM_IN_FACTS' });
    collectNumbers(v.value, allowed);
  }
  for (const r of a.ruleResults) collectNumbers([r.result, r.inputs], allowed);

  // 주장 숫자: claimsCited 에만 나오는 숫자 (사실에도 있는 숫자는 주장 전용이 아님)
  const claimOnly: NumberToken[] = [];
  for (const c of a.claimsCited) for (const t of extractNumbers(c.text)) if (!isTrivial(t) && !matches(t, allowed)) claimOnly.push(t);
  const claimValues = claimOnly.map((t) => t.value);
  // 사실 · 규칙 결과 안에 주장 숫자가 섞였나 (정확히 같은 값)
  for (const v of new Set(allowed)) {
    if (claimValues.some((c) => Math.abs(Math.abs(c) - Math.abs(v)) < 0.5 && Math.abs(v) >= 1000)) {
      violations.push({ field: 'facts|ruleResults', token: String(v), reason: 'CLAIM_NUMBER_IN_FACTS' });
    }
  }

  for (const { field, text } of narrativeFields(a)) {
    for (const tok of extractNumbers(text)) {
      if (isTrivial(tok)) continue;
      if (claimOnly.some((c) => Math.abs(Math.abs(c.value) - Math.abs(tok.value)) <= Math.max(tok.tolerance, 0.5))) {
        violations.push({ field, token: tok.raw, reason: 'CLAIM_NUMBER_IN_TEXT' });
        continue;
      }
      if (!matches(tok, allowed)) violations.push({ field, token: tok.raw, reason: 'NUMBER_NOT_IN_FACTS' });
    }
  }
  return { ok: violations.length === 0, violations };
}
