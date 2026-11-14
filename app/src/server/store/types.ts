/**
 * 운영 상태 저장소 인터페이스 — 서비스는 이 인터페이스만 안다 (DD-011: DB 는 영속화만, 계산 · 전이는 domain/workflow).
 * 구현: MemoryStore(테스트 · DATABASE_URL 없는 로컬) · PgStore(axhub Postgres · 로컬 Postgres).
 */
import type { PresetId } from '@/domain/api-types';
import type { WorldState } from '@/domain/workflow';

export interface StoredWorld {
  state: WorldState;
  /** 낙관적 잠금 버전 — 쓰기마다 +1 */
  version: number;
  preset: PresetId | null;
}

export interface WorldStore {
  readonly kind: 'MEMORY' | 'POSTGRES';
  read(): Promise<StoredWorld | null>;
  /** prev 이후 바뀐 상태를 저장. expectedVersion 이 다르면 CONFLICT(409) */
  write(next: WorldState, opts: { expectedVersion: number; prev: WorldState }): Promise<number>;
  /** 운영 상태를 통째로 바꾼다 (시나리오 초기화 · 프리셋 재생). 원본 적재 테이블은 건드리지 않는다 */
  replace(state: WorldState, preset: PresetId | null): Promise<number>;
}
