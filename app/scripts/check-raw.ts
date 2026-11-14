/**
 * 원본 데이터 점검 (읽기 전용) — `npm run raw:check`
 * 각 W02 원본 CSV 의 행 수 · 헤더 · 첫 행 출처(src_file:src_row)를 출력한다. 원본 파일을 쓰지 않는다.
 * DB 적재(2단계)는 같은 loader 결과(tables)를 raw_* 테이블에 그대로 넣는다.
 */
import { MASIL_FILES, rawRoot } from '../src/server/raw/loader';
import { getMasil } from '../src/server/raw/masil';

const { tables } = getMasil();
console.log(`원본 경로: ${rawRoot()}`);
for (const key of Object.keys(MASIL_FILES) as (keyof typeof MASIL_FILES)[]) {
  const t = tables[key];
  const first = t.rows[0];
  console.log(`${key.padEnd(15)} ${String(t.rows.length).padStart(6)}행  ${t.file}  첫 행 ${first ? `${first.src_file}:${first.src_row}` : '-'}  [${t.header.join('|')}]`);
}
