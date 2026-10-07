import { describe, expect, it } from 'vitest';
import { seasonId, seasonStartUtc } from './season';

describe('seasonId', () => {
  it('월요일 00:00 KST에 새 시즌이 시작된다', () => {
    expect(seasonId(new Date('2026-10-04T14:59:59Z'))).toBe('2026-W40');
    expect(seasonId(new Date('2026-10-04T15:00:00Z'))).toBe('2026-W41');
  });

  it('연도 경계 주를 ISO 기준으로 계산한다', () => {
    expect(seasonId(new Date('2025-12-29T00:00:00Z'))).toBe('2026-W01');
  });
});

describe('seasonStartUtc', () => {
  it('시즌 시작 시각을 되돌려준다', () => {
    expect(seasonStartUtc('2026-W41').toISOString()).toBe('2026-10-04T15:00:00.000Z');
  });
});
