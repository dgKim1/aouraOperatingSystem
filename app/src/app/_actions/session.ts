'use server';
/**
 * 시연 역할 전환 — 쿠키만 바꾸고 화면을 서버에서 다시 그린다(운영 상태는 바꾸지 않음).
 * 운영 상태 변경(회신 · 작업 · 사건 · 시점 이동 · 프리셋 초기화)은 모두 /api/* 로 한다.
 */
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { DEMO_ROLES, ROLE_COOKIE } from '../_data/views';

const OPTS = { path: '/', sameSite: 'lax' as const, maxAge: 60 * 60 * 24 * 30 };

export async function setRole(roleId: string): Promise<void> {
  if (!DEMO_ROLES.some((r) => r.id === roleId)) return;
  (await cookies()).set(ROLE_COOKIE, roleId, OPTS);
  revalidatePath('/', 'layout');
}
