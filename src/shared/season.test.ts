import { describe, expect, it } from 'vitest';
import { seasonIdSchema } from './endless';
import { rankedSeasonId, rankingFrozen, seasonId, seasonStartUtc } from './season';

describe('seasonId', () => {
  it('월요일 00:00 KST에 새 시즌이 시작된다', () => {
    expect(seasonId(new Date('2026-10-04T14:59:59Z'))).toBe('2026-W40');
    expect(seasonId(new Date('2026-10-04T15:00:00Z'))).toBe('2026-W41');
  });

  it('연도 경계 주를 ISO 기준으로 계산한다', () => {
    expect(seasonId(new Date('2025-12-29T00:00:00Z'))).toBe('2026-W01');
  });

  it('seasonId 출력이 계약 스키마를 만족한다', () => {
    expect(seasonIdSchema.safeParse(seasonId(new Date('2026-10-07T00:00:00Z'))).success).toBe(true);
  });
});

describe('seasonStartUtc', () => {
  it('시즌 시작 시각을 되돌려준다', () => {
    expect(seasonStartUtc('2026-W41').toISOString()).toBe('2026-10-04T15:00:00.000Z');
  });
});

describe('rankingFrozen', () => {
  it('월요일 00:00~04:00 KST에는 집계가 마감된다', () => {
    expect(rankingFrozen(new Date('2026-10-04T15:00:00Z'))).toBe(true);
    expect(rankingFrozen(new Date('2026-10-04T15:30:00Z'))).toBe(true);
    expect(rankingFrozen(new Date('2026-10-04T18:59:59Z'))).toBe(true);
  });

  it('마감 창 밖에는 집계가 열린다', () => {
    expect(rankingFrozen(new Date('2026-10-04T14:59:59Z'))).toBe(false);
    expect(rankingFrozen(new Date('2026-10-04T19:00:00Z'))).toBe(false);
    expect(rankingFrozen(new Date('2026-10-06T00:00:00Z'))).toBe(false);
  });
});

describe('rankedSeasonId', () => {
  it('마감 창에는 끝난 시즌을, 그 외에는 현재 시즌을 돌려준다', () => {
    expect(rankedSeasonId(new Date('2026-10-04T15:30:00Z'))).toBe('2026-W40');
    expect(rankedSeasonId(new Date('2026-10-04T19:00:00Z'))).toBe('2026-W41');
    expect(rankedSeasonId(new Date('2026-10-06T00:00:00Z'))).toBe('2026-W41');
  });
});
