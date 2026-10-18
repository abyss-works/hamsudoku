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

function establish() {
  return callRoute(POST, { path: '/api/auth/session', method: 'POST' });
}

describe('POST /api/auth/session', () => {
  it('세션을 만들 수 없으면 401을 반환하고 아무것도 기록하지 않는다', async () => {
    expect(await establish()).toEqual({ status: 401, body: { ok: false } });
    expect(await db.query(`select 1 from "User"`)).toHaveLength(0);
  });

  it('세션이 성립하면 사용자를 반환하고 응답 뒤에 사용자와 프로필 행을 기록한다', async () => {
    signInAs('user-a');

    expect(await establish()).toEqual({ status: 200, body: { ok: true, uid: 'user-a', email: null } });
    expect(await db.query(`select id, email from "User"`)).toEqual([{ id: 'user-a', email: null }]);
    expect(await db.query(`select "userId", nickname from "Profile"`)).toEqual([{ userId: 'user-a', nickname: null }]);
  });

  it('로그인된 세션은 이메일을 함께 반환한다', async () => {
    signInAs('user-b', 'b@example.com');

    expect(await establish()).toEqual({ status: 200, body: { ok: true, uid: 'user-b', email: 'b@example.com' } });
  });

  it('이미 기록된 사용자의 이메일과 닉네임을 유지한다', async () => {
    await seedUser(db, 'user-a', '햄스터');
    await db.query(`update "User" set email = 'a@example.com' where id = 'user-a'`);
    signInAs('user-a');

    await establish();

    expect(await db.query(`select id, email from "User"`)).toEqual([{ id: 'user-a', email: 'a@example.com' }]);
    expect(await db.query(`select nickname from "Profile"`)).toEqual([{ nickname: '햄스터' }]);
  });
});
