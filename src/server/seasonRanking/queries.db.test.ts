import { describe, expect, it } from 'vitest';
import { seasonWindow } from '../../shared/season';
import { useStoreDatabase } from '../../../tools/dbTest/storeHarness';
import {
  findFinalizedSeason,
  findFinalizedSeasonTop,
  findSeasonStanding,
  listSeasonEarnings,
  listUnfinalizedLedgerSeasons,
} from './queries';

const store = useStoreDatabase();

// 2026-W41 집계 구간: 2026-10-04T19:00:00Z 이상 2026-10-11T15:00:00Z 미만.
const SEASON = '2026-W41';
const WINDOW = seasonWindow(SEASON);
const IN_WINDOW = new Date('2026-10-08T03:00:00.000Z');

async function ledger(id: string, userId: string, amount: number, options: { season?: string; at?: Date; eligible?: boolean; kind?: string } = {}) {
  await store.query(
    `insert into "SeedLedger" (id, "userId", kind, amount, "stageId", season, "createdAt", "rankingEligible") values ($1, $2, $3, $4, null, $5, $6, $7)`,
    [id, userId, options.kind ?? 'earn', amount, options.season ?? SEASON, options.at ?? IN_WINDOW, options.eligible ?? true],
  );
}

async function seedSeason() {
  await ledger('l1', 'user-a', 3);
  await ledger('l2', 'user-a', 2);
  await ledger('l3', 'user-b', 5);
  await ledger('l4', 'user-c', 3);
  await ledger('l5', 'user-d', 10, { eligible: false });
  await ledger('l6', 'user-e', 7, { at: new Date('2026-10-11T15:00:00.000Z') });
  await ledger('l7', 'user-e', 1, { at: new Date('2026-10-11T14:59:59.000Z') });
  await ledger('l8', 'user-f', 9, { season: '2026-W40' });
  await ledger('l9', 'user-g', 4, { kind: 'spend' });
}

async function finalize(season: string, results: { userId: string; score: number; rank: number }[], status = 'finalized') {
  await store.query(
    `insert into "SeasonFinalization" (season, "startAt", "endAt", "finalizedAt", status) values ($1, $2, $3, $4, $5)`,
    [season, WINDOW.startAt, WINDOW.endAt, new Date('2026-10-11T15:01:00.000Z'), status],
  );
  for (const r of results) {
    await store.query(`insert into "SeasonRankResult" (season, "userId", score, rank) values ($1, $2, $3, $4)`, [
      season,
      r.userId,
      r.score,
      r.rank,
    ]);
  }
}

describe('seasonRanking 원장 조회', () => {
  it('시즌 적립 합계는 구간 안의 랭킹 대상 적립만 사용자별로 더한다', async () => {
    await seedSeason();
    const rows = await listSeasonEarnings(store.db, SEASON, WINDOW);
    expect([...rows].sort((a, b) => a.userId.localeCompare(b.userId))).toEqual([
      { userId: 'user-a', amount: 5 },
      { userId: 'user-b', amount: 5 },
      { userId: 'user-c', amount: 3 },
      { userId: 'user-e', amount: 1 },
    ]);
  });

  it('확정되지 않은 시즌은 원장 순위와 닉네임을 반환한다', async () => {
    await seedSeason();
    await store.query(`insert into "Profile" ("userId", nickname, "updatedAt") values ('user-a', '햄스터', now())`);

    expect(await findSeasonStanding(store.db, { season: SEASON, userId: 'user-a', window: WINDOW })).toEqual({
      finalized: false,
      rank: 2,
      score: 5,
      nickname: '햄스터',
    });
    expect(await findSeasonStanding(store.db, { season: SEASON, userId: 'user-b', window: WINDOW })).toMatchObject({ rank: 1, score: 5 });
    expect(await findSeasonStanding(store.db, { season: SEASON, userId: 'user-d', window: WINDOW })).toEqual({
      finalized: false,
      rank: null,
      score: 0,
      nickname: null,
    });
  });

  it('확정된 시즌은 확정 결과의 순위를 반환하고 결과에 없으면 순위 없이 0점이다', async () => {
    await seedSeason();
    await finalize(SEASON, [{ userId: 'user-a', score: 12, rank: 4 }]);

    expect(await findSeasonStanding(store.db, { season: SEASON, userId: 'user-a', window: WINDOW })).toEqual({
      finalized: true,
      rank: 4,
      score: 12,
      nickname: null,
    });
    expect(await findSeasonStanding(store.db, { season: SEASON, userId: 'user-b', window: WINDOW })).toEqual({
      finalized: true,
      rank: null,
      score: 0,
      nickname: null,
    });
  });
});

describe('seasonRanking 확정 결과 조회', () => {
  it('확정되지 않은 시즌은 null이다', async () => {
    await finalize(SEASON, [{ userId: 'user-a', score: 1, rank: 1 }], 'pending');
    expect(await findFinalizedSeasonTop(store.db, SEASON, 50)).toBeNull();
    expect(await findFinalizedSeason(store.db, SEASON)).toBeNull();
  });

  it('상위 결과는 순위 순서로 제한 개수만 반환하고 전체 결과는 모두 반환한다', async () => {
    await finalize(
      SEASON,
      Array.from({ length: 5 }, (_, i) => ({ userId: `user-${i}`, score: 50 - i, rank: i + 1 })).reverse(),
    );

    const top = await findFinalizedSeasonTop(store.db, SEASON, 3);
    expect(top).toEqual({
      header: {
        season: SEASON,
        startAt: WINDOW.startAt.toISOString(),
        endAt: WINDOW.endAt.toISOString(),
        finalizedAt: '2026-10-11T15:01:00.000Z',
        status: 'finalized',
      },
      results: [0, 1, 2].map((i) => ({ season: SEASON, userId: `user-${i}`, score: 50 - i, rank: i + 1 })),
    });
    expect((await findFinalizedSeason(store.db, SEASON))?.results).toHaveLength(5);
  });

  it('참여자가 없는 확정 시즌은 빈 결과를 반환한다', async () => {
    await finalize(SEASON, []);
    expect((await findFinalizedSeasonTop(store.db, SEASON, 50))?.results).toEqual([]);
  });

  it('원장에 적립이 있으면서 확정되지 않은 시즌을 찾는다', async () => {
    await seedSeason();
    await ledger('w39', 'user-a', 1, { season: '2026-W39' });
    await finalize('2026-W40', []);

    expect(await listUnfinalizedLedgerSeasons(store.db)).toEqual(['2026-W39', SEASON]);
  });
});
