/**
 * 원본 데이터 읽기 전용 로더. 원본 파일을 쓰거나 옮기지 않는다(CLAUDE.md 절대 규칙 1).
 * 경로: 환경변수 RAW_DATA_DIR(절대 경로) 또는 app/ 기준 ../01_참가자_배포용/04_원본데이터.
 *
 * next build 의 파일 추적(output file tracing)이 이 동적 경로 때문에 프로젝트 전체를 서버 산출물에 넣지 않도록
 * `turbopackIgnore` 주석으로 추적에서 뺀다. 원본 CSV 는 빌드 산출물(.next · public)에 들어가지 않는다 —
 * docker 이미지에 넣는 방식은 별도 결정(RAW_DATA_DIR 로 위치만 알려 준다).
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { MASIL_FILES, type MasilFileKey } from '@/domain/files';
import { parsePipeCsv, type RawTable } from './csv';

export { MASIL_FILES, type MasilFileKey };

export function rawRoot(): string {
  const fromEnv = process.env.RAW_DATA_DIR;
  if (fromEnv) return fromEnv;
  return path.join(/*turbopackIgnore: true*/ process.cwd(), '..', '01_참가자_배포용', '04_원본데이터');
}

/** 원본 폴더가 이 실행 환경에 있는가 (없으면 DB 의 raw_rows 에서 읽는다) */
export function rawAvailable(): boolean {
  return existsSync(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ rawRoot(), MASIL_FILES.budgetPlan));
}

/** relFile 예: '02_masil/marketing/mkt_budget_plan_ms.csv' */
export function readRawTable(relFile: string): RawTable {
  const abs = path.join(/*turbopackIgnore: true*/ rawRoot(), relFile);
  return parsePipeCsv(readFileSync(/*turbopackIgnore: true*/ abs, 'utf8'), relFile);
}
