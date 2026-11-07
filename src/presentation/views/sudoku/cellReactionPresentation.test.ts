import { describe, expect, it } from 'vitest';
import { heartBursts, reactionDuration } from './cellReactionPresentation';

describe('cellReactionPresentation', () => {
  it.each([0, 1, 2, 3])('하트 %i개의 위치를 만든다', (count) => {
    const bursts = heartBursts(count);
    expect(bursts).toHaveLength(count);
    if (count > 0) expect(bursts[0]).toEqual({ id: 0, x: 0, delay: 0 });
  });

  it('놀람 표정은 정답 표정보다 짧게 유지한다', () => {
    expect(reactionDuration('surprised')).toBe(0.6);
    expect(reactionDuration('smile')).toBe(1.2);
    expect(reactionDuration('excited')).toBe(1.2);
  });
});
