import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ACTIVE_NOW, callRoute, secondsBefore, seedUser, signInAs, useRouteDatabase } from '../../../../tools/dbTest/routeHarness';

vi.mock('next/server', async (original) =>
  (await import('../../../../tools/dbTest/routeHarness')).mockNextServer(await original()),
);
vi.mock('../../../server/auth', async (original) =>
  (await import('../../../../tools/dbTest/routeHarness')).mockAuth(await original()),
);

const db = useRouteDatabase();
let GET: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ GET } = await import('./route'));
});

type Clear = { stageCode: string; bestElapsedSec: number | null; attempts: number; lastClearedAt: string };

describe('GET /api/records', () => {
  it('세션이 없으면 401을 반환한다', async () => {
    expect(await callRoute(GET, { path: '/api/records' })).toEqual({
      status: 401,
      body: { ok: false, msg: '로그인이 필요해요.' },
    });
  });

  it('기록이 없으면 빈 목록을 반환한다', async () => {
    await seedUser(db, 'user-a');
    signInAs('user-a');
    expect(await callRoute(GET, { path: '/api/records' })).toEqual({ status: 200, body: { ok: true, clears: [] } });
  });

  it('자신의 스테이지 요약 기록만 반환한다', async () => {
    await seedUser(db, 'user-a');
    const first = secondsBefore(ACTIVE_NOW, 7200);
    const second = secondsBefore(ACTIVE_NOW, 60);
    await db.query(
      `insert into "ClearRecord" ("userId", "stageCode", "bestElapsedSec", attempts, "lastClearedAt", "updatedAt") values
       ('user-a', '1-1', 30, 2, $1, $1),
       ('user-a', '1-2', null, 1, $2, $2),
       ('user-b', '1-1', 10, 1, $2, $2)`,
      [first, second],
    );
    signInAs('user-a');

    const res = await callRoute<{ ok: boolean; clears: Clear[] }>(GET, { path: '/api/records' });

    expect(res.status).toBe(200);
    expect([...res.body.clears].sort((a, b) => a.stageCode.localeCompare(b.stageCode))).toEqual([
      { stageCode: '1-1', bestElapsedSec: 30, attempts: 2, lastClearedAt: first.toISOString() },
      { stageCode: '1-2', bestElapsedSec: null, attempts: 1, lastClearedAt: second.toISOString() },
    ]);
  });
});
