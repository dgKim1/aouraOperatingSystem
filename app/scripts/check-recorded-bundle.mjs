/**
 * 번들 환경 회귀 확인 — 떠 있는 서버(next build + next start, next dev, 배포 주소)의 GET /api/assessments/recorded 가
 *  ① 기록 원문과 숫자까지 같은 값을 내보내고 ② 현재 규칙 계산과 일치(basisCheck.ok)하는지 본다.
 * Vitest 는 번들을 거치지 않아 이 결함(번들러가 JSON 모듈의 소수를 1ULP 다르게 읽음)을 잡지 못한다.
 *
 * 사용: node scripts/check-recorded-bundle.mjs http://localhost:3000     (읽기 전용 GET 한 번 — 운영 상태를 바꾸지 않는다)
 */
import { readFileSync } from 'node:fs';

const base = (process.argv[2] ?? process.env.BASE_URL ?? '').replace(/\/$/, '');
if (!base) {
  console.error('사용: node scripts/check-recorded-bundle.mjs <BASE_URL>');
  process.exit(64);
}
/** 기록 원문 — 모듈 평가 없이 파일 글자 그대로 읽어 V8 로 파싱한다 */
function sourceRecords() {
  const text = readFileSync(new URL('../src/server/ai/recorded/rec-001-contract.record.ts', import.meta.url), 'utf8');
  const m = text.match(/String\.raw`([\s\S]*)`;\s*$/);
  if (!m) throw new Error('기록 원문을 찾지 못함 (String.raw 블록)');
  return [JSON.parse(m[1])];
}
/** 값 안의 모든 숫자를 경로와 함께 모은다 */
function numbers(x, path = '', out = new Map()) {
  if (typeof x === 'number') out.set(path, x);
  else if (Array.isArray(x)) x.forEach((v, i) => numbers(v, `${path}[${i}]`, out));
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) numbers(v, path ? `${path}.${k}` : k, out);
  return out;
}

const res = await fetch(`${base}/api/assessments/recorded`);
if (!res.ok) {
  console.error(`실패: HTTP ${res.status}`);
  process.exit(1);
}
const { runs } = await res.json();
const problems = [];
const sources = sourceRecords();
if (runs.length !== sources.length) problems.push(`기록 수 ${runs.length} ≠ 원문 ${sources.length}`);
for (const src of sources) {
  const run = runs.find((r) => r.id === src.id);
  if (!run) {
    problems.push(`${src.id}: 응답에 없음`);
    continue;
  }
  if (run.aiMode !== 'RECORDED' || run.assessment.aiMode !== 'RECORDED' || run.calledNow !== false) problems.push(`${src.id}: 표시가 RECORDED · calledNow=false 가 아님`);
  if (!run.basisCheck.ok) problems.push(`${src.id}: basisCheck 불일치 — ${run.basisCheck.mismatches.join(', ')}`);
  // 서버가 내보낸 숫자가 원문과 비트까지 같은가 (facts · ruleResults · toolCalls)
  for (const key of ['facts', 'ruleResults', 'toolCalls']) {
    const want = numbers(src.assessment[key]);
    const got = numbers(run.assessment[key]);
    for (const [p, v] of want) if (!Object.is(got.get(p), v)) problems.push(`${src.id}: ${key}.${p} 원문 ${v} ≠ 서버 ${got.get(p)}`);
  }
}
if (problems.length > 0) {
  console.error(`기록 재생 확인 실패 (${base})`);
  for (const p of problems.slice(0, 20)) console.error(' -', p);
  process.exit(1);
}
console.log(`기록 재생 확인 통과 (${base}) — ${runs.map((r) => `${r.id} basisCheck.ok=${r.basisCheck.ok}`).join(', ')}`);
