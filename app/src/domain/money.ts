/**
 * R-SCALE-01: FULL(풀스케일) 과 SAMPLE(표본) 금액은 더하거나 곱하지 않는다.
 * 타입(브랜드) + 런타임 assert 두 겹으로 막는다. 표본 비율을 풀스케일 금액에 곱하는 함수는 두지 않는다.
 */
import type { Krw } from './types';

type ScaleTag = 'FULL' | 'SAMPLE';

/** 런타임 스케일 표식 — 브랜드는 컴파일 타임에만 있으므로 값 객체가 아닌 함수 인자로 스케일을 받는다 */
export function krw<S extends ScaleTag>(_scale: S, value: number): Krw<S> {
  if (!Number.isFinite(value)) throw new Error(`금액이 숫자가 아님: ${value}`);
  return value as Krw<S>;
}

export class ScaleMixError extends Error {
  constructor(a: ScaleTag, b: ScaleTag) {
    super(`R-SCALE-01 위반: ${a} 금액과 ${b} 금액을 섞을 수 없음`);
  }
}

/** 같은 스케일끼리만 더한다. 스케일 인자를 명시해 런타임에서도 확인한다. */
export function addKrw<S extends ScaleTag>(scale: S, ...items: { scale: S; value: Krw<S> }[]): Krw<S> {
  let sum = 0;
  for (const it of items) {
    if (it.scale !== scale) throw new ScaleMixError(scale, it.scale);
    sum += it.value;
  }
  return sum as Krw<S>;
}

/** 브랜드 타입만으로 쓰는 간단 덧셈 — FULL + SAMPLE 은 타입 오류 */
export function plus<S extends ScaleTag>(a: Krw<S>, b: Krw<NoInfer<S>>): Krw<S> {
  return (a + b) as Krw<S>;
}

export function sumKrw<S extends ScaleTag>(values: readonly Krw<S>[]): Krw<S> {
  let s = 0;
  for (const x of values) s += x;
  return s as Krw<S>;
}

/** 반올림 half-up (양수 · 음수 모두 0.5 는 +∞ 방향) */
export function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}
