import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useStoreDatabase } from '../../../tools/dbTest/storeHarness';
import { isUniqueViolation } from '../db/errors';
import { appendEarning, insertSeasonResultsFromLedger, lockSeasonForEarning, lockSeasonForFinalization, saveSeasonFinalizationHeader } from './store';

const store = useStoreDatabase();

const SEASON = '2026-W43';
const AT = new Date('2026-10-21T03:00:00.000Z');

/** 다른 연결에서 잠금을 잡은 채로 work를 실행하고 잠금을 푼다. */
async function whileHolding(lock: (tx: Parameters<typeof lockSeasonForEarning>[0]) => Promise<void>, work: () => Promise<void>) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let held!: () => void;
  const acquired = new Promise<void>((resolve) => (held = resolve));
  const holder = store.withTransaction(async (tx) => {
    await lock(tx);
    held();
    await released;
  });
  await acquired;
  try {
    await work();
  } finally {
    release();
    await holder;
  }
}

/** lock_timeout 안에 잠금을 얻으면 true, 시간 초과면 false. */
async function acquiresWithin(lock: (tx: Parameters<typeof lockSeasonForEarning>[0]) => Promise<void>): Promise<boolean> {
  try {
    await store.withTransaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '300ms'`);
      await lock(tx);
    });
    return true;
  } catch (error) {
    if ((error as { cause?: { code?: string } }).cause?.code === '55P03') return false;
    throw error;
  }
}

describe('seasonRanking 시즌 잠금', () => {
  it('클리어의 공유 잠금끼리는 서로 기다리지 않는다', async () => {
    await whileHolding(
      (tx) => lockSeasonForEarning(tx, SEASON),
      async () => expect(await acquiresWithin((tx) => lockSeasonForEarning(tx, SEASON))).toBe(true),
    );
  });

  it('시즌 확정의 배타 잠금은 클리어의 공유 잠금과 서로 배제된다', async () => {
    await whileHolding(
      (tx) => lockSeasonForEarning(tx, SEASON),
      async () => expect(await acquiresWithin((tx) => lockSeasonForFinalization(tx, SEASON))).toBe(false),
    );
    await whileHolding(
      (tx) => lockSeasonForFinalization(tx, SEASON),
      async () => expect(await acquiresWithin((tx) => lockSeasonForEarning(tx, SEASON))).toBe(false),
    );
  });

  it('다른 시즌의 잠금은 서로 막지 않는다', async () => {
    await whileHolding(
      (tx) => lockSeasonForFinalization(tx, SEASON),
      async () => expect(await acquiresWithin((tx) => lockSeasonForEarning(tx, '2026-W44'))).toBe(true),
    );
  });

  it('기존 클리어 커밋의 시즌 잠금과 같은 키를 쓴다', async () => {
    await whileHolding(
      (tx) => lockSeasonForEarning(tx, SEASON),
      async () =>
        expect(
          await acquiresWithin(async (tx) => {
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext('season:' || ${SEASON}))`);
          }),
        ).toBe(false),
    );
  });
});

describe('seasonRanking 적립', () => {
  it('랭킹 구간 안의 적립은 랭킹 대상으로 기록한다', async () => {
    const result = await store.withTransaction((tx) =>
      appendEarning(tx, { userId: 'user-a', stageId: 'e-1-0', season: SEASON, amount: 3, at: AT, inRankingWindow: true }),
    );

    expect(result).toEqual({ rankingEligible: true });
    expect(
      await store.query(`select "userId", kind, amount, "stageId", season, "rankingEligible", "createdAt" from "SeedLedger"`),
    ).toEqual([{ userId: 'user-a', kind: 'earn', amount: 3, stageId: 'e-1-0', season: SEASON, rankingEligible: true, createdAt: AT }]);
  });

  it('랭킹 구간 밖의 적립은 랭킹 대상에서 제외한다', async () => {
    const result = await appendEarning(store.db, {
      userId: 'user-a',
      stageId: 'e-1-0',
      season: SEASON,
      amount: 3,
      at: AT,
      inRankingWindow: false,
    });
    expect(result).toEqual({ rankingEligible: false });
  });

  it('확정된 시즌의 적립은 랭킹 대상에서 제외한다', async () => {
    await store.query(
      `insert into "SeasonFinalization" (season, "startAt", "endAt", "finalizedAt", status) values ($1, $2, $2, $2, 'finalized')`,
      [SEASON, AT],
    );
    const result = await appendEarning(store.db, {
      userId: 'user-a',
      stageId: 'e-1-0',
      season: SEASON,
      amount: 3,
      at: AT,
      inRankingWindow: true,
    });
    expect(result).toEqual({ rankingEligible: false });
  });
});

describe('seasonRanking 확정 저장', () => {
  const header = {
    season: SEASON,
    startAt: '2026-10-18T19:00:00.000Z',
    endAt: '2026-10-25T15:00:00.000Z',
    finalizedAt: '2026-10-25T15:01:00.000Z',
    status: 'finalized',
  };
  const window = { startAt: new Date(header.startAt), endAt: new Date(header.endAt) };
  const inWindow = new Date('2026-10-21T03:00:00.000Z');

  async function ledger(userId: string, amount: number, options: { at?: Date; eligible?: boolean } = {}) {
    await store.query(
      `insert into "SeedLedger" ("userId", kind, amount, season, "createdAt", "rankingEligible") values ($1, 'earn', $2, $3, $4, $5)`,
      [userId, amount, SEASON, options.at ?? inWindow, options.eligible ?? true],
    );
  }

  it('확정 머리 행을 저장하고 같은 시즌의 중복 저장은 unique 위반으로 거부한다', async () => {
    await store.withTransaction((tx) => saveSeasonFinalizationHeader(tx, header));
    expect(await store.query(`select season, "startAt", "endAt", "finalizedAt", status from "SeasonFinalization"`)).toEqual([
      { season: SEASON, startAt: window.startAt, endAt: window.endAt, finalizedAt: new Date(header.finalizedAt), status: 'finalized' },
    ]);
    const error = await store.withTransaction((tx) => saveSeasonFinalizationHeader(tx, header)).catch((e: unknown) => e);
    expect(isUniqueViolation(error)).toBe(true);
  });

  it('원장의 랭킹 대상 합계로 점수 내림차순·userId 내림차순 순위를 매겨 저장하고 순위 순서로 반환한다', async () => {
    await ledger('user-a', 3);
    await ledger('user-a', 2);
    await ledger('user-b', 5);
    await ledger('user-c', 3);
    await ledger('user-d', 10, { eligible: false });
    await ledger('user-e', 7, { at: window.endAt });
    await store.withTransaction((tx) => saveSeasonFinalizationHeader(tx, header));

    const results = await store.withTransaction((tx) => insertSeasonResultsFromLedger(tx, SEASON, window));

    expect(results).toEqual([
      { season: SEASON, userId: 'user-b', score: 5, rank: 1 },
      { season: SEASON, userId: 'user-a', score: 5, rank: 2 },
      { season: SEASON, userId: 'user-c', score: 3, rank: 3 },
    ]);
    expect(await store.query(`select "userId", score, rank from "SeasonRankResult" order by rank`)).toEqual(
      results.map(({ userId, score, rank }) => ({ userId, score, rank })),
    );
  });

  it('참여자가 없으면 결과 없이 끝난다', async () => {
    await store.withTransaction((tx) => saveSeasonFinalizationHeader(tx, header));
    expect(await store.withTransaction((tx) => insertSeasonResultsFromLedger(tx, SEASON, window))).toEqual([]);
  });
});
