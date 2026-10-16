import { beforeAll, describe, expect, it } from 'vitest';
import { seasonWindow } from '../../shared/season';
import { FakeRankStore, seedLedger, useRouteDatabase } from '../../../tools/dbTest/routeHarness';

const db = useRouteDatabase();
let rebuildRankCache: typeof import('./rankCache').rebuildRankCache;

beforeAll(async () => {
  ({ rebuildRankCache } = await import('./rankCache'));
});

describe('rebuildRankCache', () => {
  it('시즌 구간의 랭킹 대상 원장 합계로 순위 저장소 점수를 다시 쓴다', async () => {
    const season = '2026-W41';
    const inWindow = new Date(seasonWindow(season).startAt.getTime() + 60_000);
    await seedLedger(db, { id: 'l1', userId: 'u1', season, amount: 3, createdAt: inWindow });
    await seedLedger(db, { id: 'l2', userId: 'u1', season, amount: 2, createdAt: inWindow });
    await seedLedger(db, { id: 'l3', userId: 'u2', season, amount: 4, createdAt: inWindow, rankingEligible: false });
    const store = new FakeRankStore();
    store.scores.set('u1', 99);

    expect(await rebuildRankCache(store, season)).toBe(1);
    expect([...store.scores]).toEqual([['u1', 5]]);
  });
});
