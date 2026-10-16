import { beforeAll, describe, expect, it, vi } from 'vitest';
import { seasonId } from '../../../../shared/season';
import { ACTIVE_NOW, callRoute, seedUser, signInAs, useRouteDatabase } from '../../../../../tools/dbTest/routeHarness';

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

describe('GET /api/endless/me', () => {
  it('세션이 없으면 401을 반환한다', async () => {
    expect(await callRoute(GET, { path: '/api/endless/me' })).toEqual({
      status: 401,
      body: { ok: false, msg: '로그인이 필요해요.' },
    });
  });

  it('기록이 없으면 0으로 채운 요약을 반환한다', async () => {
    await seedUser(db, 'user-a');
    signInAs('user-a');
    expect(await callRoute(GET, { path: '/api/endless/me' })).toEqual({
      status: 200,
      body: { wallet: { balance: 0 }, clearedCount: 0, streak: { current: 0, best: 0 }, season: seasonId(ACTIVE_NOW) },
    });
  });

  it('지갑 잔액, 클리어한 판 수, 연속 기록을 반환한다', async () => {
    await seedUser(db, 'user-a');
    await db.query(`insert into "SeedWallet" ("userId", balance) values ('user-a', 17), ('user-b', 99)`);
    await db.query(`insert into "EndlessStreak" ("userId", current, best) values ('user-a', 2, 5)`);
    await db.query(
      `insert into "EndlessProgress" ("userId", "stageId", cleared, attempts, "lastPlayedAt") values
       ('user-a', 'e-1-0', true, 1, $1), ('user-a', 'e-1-1', true, 3, $1), ('user-a', 'e-1-2', false, 2, $1),
       ('user-b', 'e-1-0', true, 1, $1)`,
      [ACTIVE_NOW],
    );
    signInAs('user-a');

    expect((await callRoute(GET, { path: '/api/endless/me' })).body).toEqual({
      wallet: { balance: 17 },
      clearedCount: 2,
      streak: { current: 2, best: 5 },
      season: seasonId(ACTIVE_NOW),
    });
  });
});
