import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { seasonId } from '../../../../shared/season';
import {
  ACTIVE_NOW,
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
let POST: (req: Request) => Promise<Response>;
let rankGET: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ GET, POST } = await import('./route'));
  ({ GET: rankGET } = await import('../../endless/rank/route'));
});

afterEach(() => {
  delete process.env.ADMIN_UIDS;
});

const SEASON = seasonId(ACTIVE_NOW);

async function seedSeason() {
  const inWindow = secondsBefore(ACTIVE_NOW, 3600);
  await seedUser(db, 'admin', '관리자');
  await seedUser(db, 'user-a', '에이');
  await seedUser(db, 'guest-1');
  await seedUser(db, 'guest-2');
  await seedLedger(db, { id: 'l1', userId: 'admin', season: SEASON, amount: 2, createdAt: inWindow });
  await seedLedger(db, { id: 'l2', userId: 'user-a', season: SEASON, amount: 6, createdAt: inWindow });
  await seedLedger(db, { id: 'l3', userId: 'guest-1', season: SEASON, amount: 9, createdAt: inWindow });
  await seedLedger(db, { id: 'l4', userId: 'guest-2', season: SEASON, amount: 4, createdAt: inWindow });
  await seedLedger(db, { id: 'l5', userId: 'guest-2', season: SEASON, amount: 1, createdAt: inWindow });
}

function list() {
  return callRoute(GET, { path: '/api/admin/rank' });
}

function remove(body: unknown) {
  return callRoute(POST, { path: '/api/admin/rank', body });
}

function publicTop() {
  return callRoute<{ top: { userId: string }[] }>(rankGET, { path: '/api/endless/rank' }).then((res) =>
    res.body.top.map((entry) => entry.userId),
  );
}

describe('/api/admin/rank', () => {
  it('관리자가 아니면 조회와 제외 모두 403이다', async () => {
    await seedSeason();
    signInAs('user-a');
    process.env.ADMIN_UIDS = 'admin';

    expect((await list()).status).toBe(403);
    expect((await remove({ userIds: ['guest-1'] })).status).toBe(403);
    expect(await db.query(`select 1 from "SeedLedger" where not "rankingEligible"`)).toHaveLength(0);
  });

  it('조회는 현재 시즌 원장 합계를 점수 내림차순으로 닉네임과 함께 반환한다', async () => {
    await seedSeason();
    signInAs('admin');
    process.env.ADMIN_UIDS = 'admin';

    expect(await list()).toEqual({
      status: 200,
      body: {
        ok: true,
        season: SEASON,
        entries: [
          { userId: 'guest-1', nickname: null, score: 9 },
          { userId: 'user-a', nickname: '에이', score: 6 },
          { userId: 'guest-2', nickname: null, score: 5 },
          { userId: 'admin', nickname: '관리자', score: 2 },
        ],
      },
    });
  });

  it('제외하면 조회 목록과 공개 순위에서 즉시 빠지고 캐시가 갱신된 뒤에도 돌아오지 않는다', async () => {
    await seedSeason();
    signInAs('admin');
    process.env.ADMIN_UIDS = 'admin';
    expect(await publicTop()).toEqual(['guest-1', 'user-a', 'guest-2', 'admin']);

    expect(await remove({ userIds: ['guest-1', 'guest-2', 'unknown-user'] })).toEqual({ status: 200, body: { ok: true, removed: 2 } });

    expect((await list()).body).toMatchObject({
      entries: [
        { userId: 'user-a', score: 6 },
        { userId: 'admin', score: 2 },
      ],
    });
    expect(await publicTop()).toEqual(['user-a', 'admin']);
    useFixedNow(new Date(ACTIVE_NOW.getTime() + 61_000));
    expect(await publicTop()).toEqual(['user-a', 'admin']);
  });

  it('자기 자신은 제외하지 않는다', async () => {
    await seedSeason();
    signInAs('admin');
    process.env.ADMIN_UIDS = 'admin';

    expect(await remove({ userIds: ['admin'] })).toEqual({ status: 200, body: { ok: true, removed: 0 } });
    expect(await db.query(`select 1 from "SeedLedger" where "userId" = 'admin' and "rankingEligible"`)).toHaveLength(1);
  });

  it.each([[{}], [{ userIds: [] }], [{ userIds: [''] }]])('본문 %j는 400이다', async (body) => {
    signInAs('admin');
    process.env.ADMIN_UIDS = 'admin';
    expect((await remove(body)).status).toBe(400);
  });
});
