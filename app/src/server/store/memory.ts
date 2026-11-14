/** 프로세스 메모리 저장소 — 테스트 · DATABASE_URL 이 없는 로컬 실행용 (재시작하면 초기화, meta.persistence = 'MEMORY') */
import { DomainError } from '@/domain/errors';
import type { PresetId } from '@/domain/api-types';
import type { WorldState } from '@/domain/workflow';
import type { StoredWorld, WorldStore } from './types';

export class MemoryStore implements WorldStore {
  readonly kind = 'MEMORY' as const;
  private cur: StoredWorld | null = null;

  async read(): Promise<StoredWorld | null> {
    return this.cur ? structuredClone(this.cur) : null;
  }

  async write(next: WorldState, opts: { expectedVersion: number; prev: WorldState }): Promise<number> {
    if (!this.cur || this.cur.version !== opts.expectedVersion) {
      throw new DomainError('CONFLICT', '다른 처리가 먼저 상태를 바꿨습니다 — 다시 조회 후 시도하세요', { expectedVersion: opts.expectedVersion, actual: this.cur?.version ?? null });
    }
    this.cur = { state: structuredClone(next), version: this.cur.version + 1, preset: this.cur.preset };
    return this.cur.version;
  }

  async replace(state: WorldState, preset: PresetId | null): Promise<number> {
    const version = (this.cur?.version ?? 0) + 1;
    this.cur = { state: structuredClone(state), version, preset };
    return version;
  }
}
