/**
 * GET /api/healthz — 배포 상태 확인(axhub runtime.health_path). 테스트 먼저 (BE-14).
 * 상태 확인 요청은 로그인 정보 없이 오고 3초 안에 200 을 받아야 한다 → DB · 원본 · 서비스 · AI 를 부르지 않는다.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as healthz from '@/app/api/healthz/route';
import type { HealthView } from '@/domain/api-types';
import { AouraService } from '@/server/service';
import { setServiceForTests } from '@/server/runtime';

afterEach(() => setServiceForTests(null));

describe('GET /api/healthz', () => {
  it('200 { status: "ok" } · 캐시하지 않음', async () => {
    const res = await healthz.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()) as HealthView).toEqual({ status: 'ok' });
  });

  it('서비스(저장소 · 원본 · AI)가 죽어 있어도 200 — 서비스를 건드리지 않는다', async () => {
    const boom = () => {
      throw new Error('healthz 가 서비스를 호출함');
    };
    const dead = new Proxy({} as AouraService, { get: boom });
    setServiceForTests(dead);
    const res = await healthz.GET();
    expect(res.status).toBe(200);
  });

  it('응답에 환경 정보(접속 주소 · 키 · 모드)를 싣지 않는다', async () => {
    const body = (await (await healthz.GET()).json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(['status']);
  });
});
