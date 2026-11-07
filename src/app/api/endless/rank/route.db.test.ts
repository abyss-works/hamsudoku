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

  it('진행 중인 시즌은 원장 적립으로 상위 목록을 만들고 닉네임을 붙인다', async () => {
    await seedSeason();
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

  it('집계 마감 창에 확정 전이면 집계 중 상태를 반환한다', async () => {
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
  });

  it('확정 결과에 없는 사용자는 순위 없이 0점이다', async () => {
    useFixedNow(FROZEN_NOW);
    await seedSeason();
    await finalizeSeedSeason();
    signInAs('user-z');
    expect((await rank()).body).toMatchObject({ status: 'finalized', me: { rank: null, score: 0 } });
  });

  it('상위 목록은 60초 동안 캐시하고 이후 요청에서 최신 원장으로 갱신한다', async () => {
    await seedSeason();
    signInAs('user-a');
    expect((await rank()).body).toMatchObject({ top: [{ userId: 'user-b' }, { userId: 'user-c' }, { userId: 'user-a' }] });

    await seedLedger(db, { id: 'l5', userId: 'user-z', season: SEASON, amount: 50, createdAt: secondsBefore(ACTIVE_NOW, 60) });

    useFixedNow(new Date(ACTIVE_NOW.getTime() + 59_000));
    const cached = await rank();
    expect(cached.body).toMatchObject({ top: [{ userId: 'user-b' }, { userId: 'user-c' }, { userId: 'user-a' }], snapshotAt: ACTIVE_NOW.toISOString() });
    expect(cached.body).toMatchObject({ me: { rank: 4, score: 5 } });

    useFixedNow(new Date(ACTIVE_NOW.getTime() + 60_000));
    const refreshed = await rank();
    expect(refreshed.body).toMatchObject({
      top: [{ userId: 'user-z', score: 50 }, { userId: 'user-b' }, { userId: 'user-c' }, { userId: 'user-a' }],
      snapshotAt: new Date(ACTIVE_NOW.getTime() + 60_000).toISOString(),
    });
  });

  it('상위 목록은 50명까지만 담는다', async () => {
    await db.query(
      `insert into "SeedLedger" ("userId", kind, amount, season, "createdAt", "rankingEligible")
       select 'user-' || lpad(n::text, 3, '0'), 'earn', n, $1, $2, true from generate_series(1, 60) as n`,
      [SEASON, secondsBefore(ACTIVE_NOW, 3600)],
    );
    signInAs('user-001');
    const body = (await rank()).body as { top: { userId: string; score: number }[] };
    expect(body.top).toHaveLength(50);
    expect(body.top[0]).toMatchObject({ userId: 'user-060', score: 60 });
    expect(body.top[49]).toMatchObject({ userId: 'user-011', score: 11 });
  });
});
