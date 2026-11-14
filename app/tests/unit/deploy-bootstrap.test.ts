/**
 * 배포 시작 단계의 시드 초기화 (BE-14). 테스트 먼저.
 * 규칙: 운영 상태가 비어 있으면 SEED 로 초기화, 이미 있으면 그대로 둔다(재시작 · 재배포가 시연 상태를 지우지 않는다).
 */
import { describe, expect, it } from 'vitest';
import { ensureSeed } from '@/server/deploy/bootstrap';
import { buildPreset } from '@/server/scenarios';
import { MemoryStore } from '@/server/store/memory';
import * as wf from '@/domain/workflow';
import { masil } from '../helpers/raw';

describe('ensureSeed — 시작 시 운영 상태 준비', () => {
  it('비어 있으면 원본으로 만든 초기 상태를 SEED 로 저장한다', async () => {
    const store = new MemoryStore();
    const r = await ensureSeed(store, masil);
    expect(r).toEqual({ seeded: true, version: 1 });
    const got = await store.read();
    expect(got!.preset).toBe('SEED');
    expect(got!.state).toEqual(wf.initialState(masil()));
  });

  it('이미 상태가 있으면 유지한다 — 버전 · 프리셋 · 내용 불변, 원본도 읽지 않는다', async () => {
    const store = new MemoryStore();
    const s = buildPreset('S1_7', masil());
    const v = await store.replace(s, 'S1_7');
    const r = await ensureSeed(store, () => {
      throw new Error('상태가 있는데 원본을 읽음');
    });
    expect(r).toEqual({ seeded: false, version: v });
    const got = await store.read();
    expect(got).toMatchObject({ version: v, preset: 'S1_7' });
    expect(got!.state).toEqual(s);
  });

  it('두 번 실행해도 한 번만 초기화한다 (멱등)', async () => {
    const store = new MemoryStore();
    await ensureSeed(store, masil);
    expect(await ensureSeed(store, masil)).toEqual({ seeded: false, version: 1 });
  });
});
