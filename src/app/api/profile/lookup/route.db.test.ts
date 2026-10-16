import { beforeAll, describe, expect, it, vi } from 'vitest';
import { callRoute, seedUser, signInAs, useRouteDatabase } from '../../../../../tools/dbTest/routeHarness';

vi.mock('next/server', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockNextServer(await original()),
);
vi.mock('../../../../server/auth', async (original) =>
  (await import('../../../../../tools/dbTest/routeHarness')).mockAuth(await original()),
);

const db = useRouteDatabase();
let POST: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ POST } = await import('./route'));
});

function lookup(body: unknown) {
  return callRoute(POST, { path: '/api/profile/lookup', body });
}

describe('POST /api/profile/lookup', () => {
  it('세션이 없으면 401을 반환한다', async () => {
    expect(await lookup({ userIds: ['user-a'] })).toEqual({ status: 401, body: { ok: false, msg: '로그인이 필요해요.' } });
  });

  it('100개를 넘는 조회는 400을 반환한다', async () => {
    signInAs('user-a');
    const userIds = Array.from({ length: 101 }, (_, i) => `user-${i}`);
    expect(await lookup({ userIds })).toEqual({ status: 400, body: { ok: false, msg: '요청을 확인하세요.' } });
  });

  it('요청한 사용자마다 닉네임 또는 null을 반환한다', async () => {
    await seedUser(db, 'user-a', '햄스터');
    await seedUser(db, 'user-b');
    signInAs('user-a');

    const res = await lookup({ userIds: ['user-a', 'user-b', 'user-unknown'] });

    expect(res).toEqual({
      status: 200,
      body: { ok: true, nicknames: { 'user-a': '햄스터', 'user-b': null, 'user-unknown': null } },
    });
  });
});
