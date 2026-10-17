import { beforeAll, describe, expect, it, vi } from 'vitest';
import { callRoute, seedUser, signInAs, useRouteDatabase } from '../../../../../tools/dbTest/routeHarness';

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

describe('GET /api/profile/me', () => {
  it('세션이 없으면 401을 반환한다', async () => {
    expect(await callRoute(GET, { path: '/api/profile/me' })).toEqual({
      status: 401,
      body: { ok: false, msg: '로그인이 필요해요.' },
    });
  });

  it('닉네임이 없으면 null을 반환한다', async () => {
    await seedUser(db, 'user-a');
    signInAs('user-a');
    expect(await callRoute(GET, { path: '/api/profile/me' })).toEqual({ status: 200, body: { ok: true, nickname: null } });
  });

  it('저장된 닉네임을 반환한다', async () => {
    await seedUser(db, 'user-a', '햄스터');
    await seedUser(db, 'user-b', '다른이름');
    signInAs('user-a');
    expect(await callRoute(GET, { path: '/api/profile/me' })).toEqual({ status: 200, body: { ok: true, nickname: '햄스터' } });
  });
});
