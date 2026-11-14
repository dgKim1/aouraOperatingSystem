/** R-SCALE-01 — 타입 + 런타임 (AC-4-07) */
import { describe, expect, it } from 'vitest';
import { addKrw, krw, plus, ScaleMixError } from '@/domain/money';

describe('R-SCALE-01 FULL 과 SAMPLE 을 섞지 않는다', () => {
  it('같은 스케일은 더해진다', () => {
    expect(plus(krw('FULL', 1), krw('FULL', 2))).toBe(3);
  });
  it('FULL + SAMPLE 은 타입 오류', () => {
    const full = krw('FULL', 2_800_000_000);
    const sample = krw('SAMPLE', 50_690_961);
    // @ts-expect-error — R-SCALE-01: 스케일이 다른 금액은 더할 수 없다
    plus(full, sample);
    // @ts-expect-error — 브랜드 없는 number 도 FULL 자리에 못 들어간다
    plus(full, 1);
  });
  it('런타임에서도 섞이면 ScaleMixError', () => {
    expect(() =>
      addKrw('FULL', { scale: 'FULL', value: krw('FULL', 1) }, { scale: 'SAMPLE' as 'FULL', value: krw('FULL', 2) }),
    ).toThrow(ScaleMixError);
  });
});
