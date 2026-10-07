import { describe, expect, it } from 'vitest';
import { MASCOTS, pickMascot } from './mascots';

describe('pickMascot', () => {
  it('원본 1종과 변형 3종을 둔다', () => {
    expect(MASCOTS).toEqual([
      '/hamster-mascot.svg',
      '/hamster-mascot-pearl.svg',
      '/hamster-mascot-gray.svg',
      '/hamster-mascot-choco.svg',
    ]);
  });

  it('난수 구간을 균등하게 나눈다', () => {
    expect(pickMascot(() => 0)).toBe('/hamster-mascot.svg');
    expect(pickMascot(() => 0.249)).toBe('/hamster-mascot.svg');
    expect(pickMascot(() => 0.25)).toBe('/hamster-mascot-pearl.svg');
    expect(pickMascot(() => 0.5)).toBe('/hamster-mascot-gray.svg');
    expect(pickMascot(() => 0.75)).toBe('/hamster-mascot-choco.svg');
    expect(pickMascot(() => 0.999)).toBe('/hamster-mascot-choco.svg');
  });
});
