import { describe, expect, it } from 'vitest';
import { verifiedElapsedSec } from './rules';

describe('verifiedElapsedSec', () => {
  it('발급 시각부터 제출 시각까지의 경과를 초 단위로 내림한다', () => {
    expect(verifiedElapsedSec({ nowMs: 100_999, issuedAtMs: 5_000, reportedSec: 3 })).toBe(95);
  });

  it('발급 시각이 제출 시각보다 뒤이면 클라이언트가 보고한 시간을 쓴다', () => {
    expect(verifiedElapsedSec({ nowMs: 5_000, issuedAtMs: 6_000, reportedSec: 3 })).toBe(3);
  });

  it('경과를 계산할 수 없으면 클라이언트가 보고한 시간을 쓴다', () => {
    expect(verifiedElapsedSec({ nowMs: Number.NaN, issuedAtMs: 6_000, reportedSec: 7 })).toBe(7);
  });
});
