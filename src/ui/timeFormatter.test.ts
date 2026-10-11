import { describe, expect, it } from 'vitest';
import { formatElapsed } from './timeFormatter';

describe('formatElapsed in ui/timeFormatter', () => {
  it('초 단위 시간을 m:ss 형태로 포맷한다', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(7)).toBe('0:07');
    expect(formatElapsed(65)).toBe('1:05');
  });
});
