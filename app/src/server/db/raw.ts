/**
 * 원본 CSV ↔ DB raw_rows. 원본 파일은 읽기만 한다 (CLAUDE.md 절대 규칙 1).
 * - saveRawToDb: 파일에서 읽은 테이블을 raw_files · raw_rows 에 그대로 넣는다 (src_file · src_row 보존, 'NONE' 문자열 보존)
 * - loadRawFromDb: 원본 폴더가 없는 실행 환경(docker 등)에서 DB 의 원본으로 데이터셋을 만든다
 */
import { asc, eq } from 'drizzle-orm';
import { FILE_SCALE, MASIL_FILES, type MasilFileKey } from '@/domain/files';
import { ASSUMPTIONS } from '@/domain/registry';
import type { RawTable } from '../raw/csv';
import type { Db } from './client';
import { assumptions, rawFiles, rawRows } from './schema';

export async function saveRawToDb(db: Db, tables: Record<MasilFileKey, RawTable>): Promise<{ files: number; rows: number }> {
  let rows = 0;
  await db.transaction(async (tx) => {
    for (const key of Object.keys(MASIL_FILES) as MasilFileKey[]) {
      const tb = tables[key];
      await tx.delete(rawRows).where(eq(rawRows.srcFile, tb.file));
      await tx.delete(rawFiles).where(eq(rawFiles.file, tb.file));
      await tx.insert(rawFiles).values({ file: tb.file, header: tb.header, rowCount: tb.rows.length, scale: FILE_SCALE[key], label: key === 'cashForecast' ? 'CLAIM' : 'ORIGINAL' });
      for (let i = 0; i < tb.rows.length; i += 2000) {
        const chunk = tb.rows.slice(i, i + 2000).map((r) => ({ srcFile: r.src_file, srcRow: r.src_row, values: r.values }));
        await tx.insert(rawRows).values(chunk);
      }
      rows += tb.rows.length;
    }
    await tx.delete(assumptions);
    await tx.insert(assumptions).values(ASSUMPTIONS.map((a) => ({ ...a, source: 'assumption' })));
  });
  return { files: Object.keys(MASIL_FILES).length, rows };
}

export async function loadRawFromDb(db: Db): Promise<Record<MasilFileKey, RawTable> | null> {
  const out = {} as Record<MasilFileKey, RawTable>;
  for (const key of Object.keys(MASIL_FILES) as MasilFileKey[]) {
    const file = MASIL_FILES[key];
    const [meta] = await db.select().from(rawFiles).where(eq(rawFiles.file, file));
    if (!meta) return null;
    const rows = await db.select().from(rawRows).where(eq(rawRows.srcFile, file)).orderBy(asc(rawRows.srcRow));
    out[key] = { file, header: meta.header, rows: rows.map((r) => ({ src_file: r.srcFile, src_row: r.srcRow, values: r.values })) };
  }
  return out;
}
