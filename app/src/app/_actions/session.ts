'use server';
/**
 * 시연 세션 전환 (역할 · 프리셋). 운영 데이터를 바꾸지 않는다 — 쿠키만 바꾸고 화면을 서버에서 다시 그린다.
 * 실제 상태 변경(회신 · 작업 완료 · 시점 이동)은 2단계 API 로 한다.
 */
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { DEMO_ROLES, PRESET_COOKIE, ROLE_COOKIE } from '../_data/views';
import { isPresetId } from '../_data/world';

const OPTS = { path: '/', sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 30 };

export async function setRole(roleId: string): Promise<void> {
  if (!DEMO_ROLES.some((r) => r.id === roleId)) return;
  (await cookies()).set(ROLE_COOKIE, roleId, OPTS);
  revalidatePath('/', 'layout');
}

export async function setPreset(presetId: string): Promise<void> {
  if (!isPresetId(presetId)) return;
  (await cookies()).set(PRESET_COOKIE, presetId, OPTS);
  revalidatePath('/', 'layout');
}
