/**
 * `|` 구분 CSV 파서 (data_dictionary 2항: 파이프 구분 · UTF-8 · 헤더 1행 · 값 내부 파이프 없음 · 빈 셀 없음).
 * 원본 문자열 그대로 보존한다 — 'NONE' 도 문자열로 남기고 도메인 변환 때 null 로 바꾼다.
 */
export interface RawRow {
  /** 04_원본데이터 기준 상대 경로 */
  src_file: string;
  /** 헤더 제외 1부터 */
  src_row: number;
  values: Record<string, string>;
}

export interface RawTable {
  file: string;
  header: string[];
  rows: RawRow[];
}

export class CsvFormatError extends Error {}

export function parsePipeCsv(text: string, file: string): RawTable {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.length > 0);
  const headerLine = lines[0];
  if (headerLine === undefined) throw new CsvFormatError(`${file}: 헤더 없음`);
  const header = headerLine.split('|');
  const rows: RawRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = (lines[i] as string).split('|');
    if (cells.length !== header.length) {
      throw new CsvFormatError(`${file}:${i}: 열 수 ${cells.length} ≠ 헤더 ${header.length}`);
    }
    const values: Record<string, string> = {};
    header.forEach((h, j) => {
      values[h] = cells[j] as string;
    });
    rows.push({ src_file: file, src_row: i, values });
  }
  return { file, header, rows };
}
