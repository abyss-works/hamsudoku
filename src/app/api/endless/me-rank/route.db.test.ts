import { beforeAll, describe, expect, it, vi } from 'vitest';
import { seasonId, seasonWindow } from '../../../../shared/season';
import {
  ACTIVE_NOW,
  FROZEN_NOW,
  callRoute,
  secondsBefore,
  seedLedger,
  seedUser,
  signInAs,
  useFixedNow,
  useRouteDatabase,
} from '../../../../../tools/dbTest/routeHarness';

vi.mock('next/server', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockNextServer(await original()),
);
vi.mock('../../../../server/auth', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockAuth(await original()),
);

const db = useRouteDatabase();
let GET: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ GET } = await import('./route'));
});

const SEASON = seasonId(ACTIVE_NOW);

/** 시즌 원장: 동점은 userId 내림차순, 랭킹 제외·구간 밖·다른 시즌 적립은 집계하지 않는다. */
async function seedSeasonLedger() {
  const inWindow = secondsBefore(ACTIVE_NOW, 3600);
  const beforeWindow = secondsBefore(seasonWindow(SEASON).startAt, 3600);
  await seedLedger(db, { id: 'l1', userId: 'user-a', season: SEASON, amount: 3, createdAt: inWindow });
  await seedLedger(db, { id: 'l2', userId: 'user-a', season: SEASON, amount: 2, createdAt: inWindow });
  await seedLedger(db, { id: 'l3', userId: 'user-b', season: SEASON, amount: 5, createdAt: inWindow });
  await seedLedger(db, { id: 'l4', userId: 'user-c', season: SEASON, amount: 3, createdAt: inWindow });
  await seedLedger(db, { id: 'l5', userId: 'user-d', season: SEASON, amount: 10, createdAt: inWindow, rankingEligible: false });
  await seedLedger(db, { id: 'l6', userId: 'user-e', season: SEASON, amount: 7, createdAt: beforeWindow });
  await seedLedger(db, { id: 'l7', userId: 'user-f', season: '2020-W01', amount: 9, createdAt: inWindow });
}

function myRank() {
  return callRoute(GET, { path: '/api/endless/me-rank' });
}

describe('GET /api/endless/me-rank', () => {
  it('세션이 없으면 401을 반환한다', async () => {
    expect(await myRank()).toEqual({ status: 401, body: { ok: false, msg: '로그인이 필요해요.' } });
  });

  it('적립이 없으면 순위 없이 0점을 반환한다', async () => {
    await seedUser(db, 'user-a');
    signInAs('user-a');
    expect(await myRank()).toEqual({ status: 200, body: { season: SEASON, rank: null, score: 0, nickname: null } });
  });

  it.each([
    ['user-b', { rank: 1, score: 5 }],
    ['user-a', { rank: 2, score: 5 }],
    ['user-c', { rank: 3, score: 3 }],
    ['user-d', { rank: null, score: 0 }],
    ['user-e', { rank: null, score: 0 }],
  ])('진행 중인 시즌의 %s 순위를 원장에서 계산한다', async (uid, expected) => {
    await seedSeasonLedger();
    await seedUser(db, uid, '햄스터');
    signInAs(uid);
    expect((await myRank()).body).toEqual({ season: SEASON, ...expected, nickname: '햄스터' });
  });

  it('집계 마감 창에 확정 전이면 끝난 시즌의 원장 순위를 반환한다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeasonLedger();
    signInAs('user-a');
    expect((await myRank()).body).toEqual({ season: SEASON, rank: 2, score: 5, nickname: null });
  });

  it('확정된 시즌은 확정 결과의 순위를 반환한다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeasonLedger();
    const window = seasonWindow(SEASON);
    await db.query(
      `insert into "SeasonFinalization" (season, "startAt", "endAt", "finalizedAt", status) values ($1, $2, $3, $4, 'finalized')`,
      [SEASON, window.startAt, window.endAt, FROZEN_NOW],
    );
    await db.query(`insert into "SeasonRankResult" (season, "userId", score, rank) values ($1, 'user-a', 12, 4)`, [SEASON]);
    signInAs('user-a');
    expect((await myRank()).body).toEqual({ season: SEASON, rank: 4, score: 12, nickname: null });

    signInAs('user-b');
    expect((await myRank()).body).toEqual({ season: SEASON, rank: null, score: 0, nickname: null });
  });
});
