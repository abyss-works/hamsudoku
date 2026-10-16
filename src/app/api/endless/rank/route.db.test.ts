import { beforeAll, describe, expect, it, vi } from 'vitest';
import { seasonId, seasonWindow } from '../../../../shared/season';
import {
  ACTIVE_NOW,
  FROZEN_NOW,
  FakeRankStore,
  callRoute,
  outbound,
  rankStore,
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
vi.mock('../../../../server/rank', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockRank(await original()),
);

const db = useRouteDatabase();
let GET: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ GET } = await import('./route'));
});

const SEASON = seasonId(ACTIVE_NOW);

async function seedSeason() {
  const inWindow = secondsBefore(ACTIVE_NOW, 3600);
  await seedUser(db, 'user-a', '에이');
  await seedUser(db, 'user-b', '비');
  await seedUser(db, 'user-c');
  await seedLedger(db, { id: 'l1', userId: 'user-a', season: SEASON, amount: 5, createdAt: inWindow });
  await seedLedger(db, { id: 'l2', userId: 'user-b', season: SEASON, amount: 8, createdAt: inWindow });
  await seedLedger(db, { id: 'l3', userId: 'user-c', season: SEASON, amount: 5, createdAt: inWindow });
  await seedLedger(db, { id: 'l4', userId: 'user-d', season: SEASON, amount: 20, createdAt: inWindow, rankingEligible: false });
}

async function finalizeSeedSeason() {
  const window = seasonWindow(SEASON);
  await db.query(
    `insert into "SeasonFinalization" (season, "startAt", "endAt", "finalizedAt", status) values ($1, $2, $3, $4, 'finalized')`,
    [SEASON, window.startAt, window.endAt, secondsBefore(FROZEN_NOW, 600)],
  );
  await db.query(
    `insert into "SeasonRankResult" (season, "userId", score, rank) values
     ($1, 'user-b', 8, 1), ($1, 'user-c', 5, 2), ($1, 'user-a', 5, 3)`,
    [SEASON],
  );
}

function rank() {
  return callRoute(GET, { path: '/api/endless/rank' });
}

describe('GET /api/endless/rank', () => {
  it('세션이 없으면 401을 반환한다', async () => {
    expect(await rank()).toEqual({ status: 401, body: { ok: false, msg: '로그인이 필요해요.' } });
  });

  it('순위 저장소가 없으면 빈 상위 목록과 원장 기준 내 순위를 반환한다', async () => {
    await seedSeason();
    signInAs('user-a');
    expect(await rank()).toEqual({
      status: 200,
      body: {
        season: SEASON,
        top: [],
        snapshotAt: ACTIVE_NOW.toISOString(),
        me: { rank: 3, score: 5 },
        frozen: false,
        status: 'active',
      },
    });
  });

  it('진행 중인 시즌은 원장 적립으로 상위 목록을 만들고 닉네임을 붙인다', async () => {
    await seedSeason();
    rankStore.current = new FakeRankStore();
    signInAs('user-c');

    expect((await rank()).body).toEqual({
      season: SEASON,
      top: [
        { userId: 'user-b', nickname: '비', score: 8 },
        { userId: 'user-c', nickname: null, score: 5 },
        { userId: 'user-a', nickname: '에이', score: 5 },
      ],
      snapshotAt: ACTIVE_NOW.toISOString(),
      me: { rank: 2, score: 5 },
      frozen: false,
      status: 'active',
    });
  });

  it('집계 마감 창에 확정 전이면 집계 중 상태를 반환하고 확정 작업을 요청한다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeason();
    signInAs('user-b');

    expect((await rank()).body).toEqual({
      season: SEASON,
      top: [],
      snapshotAt: FROZEN_NOW.toISOString(),
      me: { rank: 1, score: 8 },
      frozen: true,
      status: 'aggregating',
    });
    expect(outbound.requests).toHaveLength(1);
    expect(outbound.requests[0]).toMatchObject({
      method: 'POST',
      body: { season: SEASON, recover: true },
      headers: { 'upstash-deduplication-id': `finalize-${SEASON}` },
    });
    expect(outbound.requests[0].url).toContain('http://app.test/api/internal/ranking-finalize');
  });

  it('확정 작업 요청이 실패해도 집계 중 상태를 반환한다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeason();
    outbound.status = 400;
    signInAs('user-b');

    const res = await rank();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'aggregating', me: { rank: 1, score: 8 } });
  });

  it('확정된 시즌은 확정 결과로 상위 목록과 내 순위를 반환한다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeason();
    await finalizeSeedSeason();
    signInAs('user-a');

    expect((await rank()).body).toEqual({
      season: SEASON,
      top: [
        { userId: 'user-b', nickname: '비', score: 8 },
        { userId: 'user-c', nickname: null, score: 5 },
        { userId: 'user-a', nickname: '에이', score: 5 },
      ],
      snapshotAt: secondsBefore(FROZEN_NOW, 600).toISOString(),
      me: { rank: 3, score: 5 },
      frozen: true,
      status: 'finalized',
    });
    expect(outbound.requests).toHaveLength(0);
  });

  it('확정 결과에 없는 사용자는 순위 없이 0점이다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeason();
    await finalizeSeedSeason();
    signInAs('user-z');
    expect((await rank()).body).toMatchObject({ status: 'finalized', me: { rank: null, score: 0 } });
  });
});
