import { beforeAll, describe, expect, it, vi } from 'vitest';
import { authResults, callRoute, sentryLogs, seedUser, useRouteDatabase } from '../../../../../tools/dbTest/routeHarness';

vi.mock('@sentry/nextjs', async () => (await import('../../../../../tools/dbTest/routeHarness')).mockSentry());
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

function signIn(body: unknown) {
  return callRoute(POST, { path: '/api/auth/signin', body });
}

describe('POST /api/auth/signin', () => {
  it('요청 형식이 틀리면 400을 반환한다', async () => {
    expect(await signIn({ email: 'not-email', password: 'secret1' })).toEqual({
      status: 400,
      body: { ok: false, msg: '이메일과 비밀번호를 확인하세요.' },
    });
  });

  it('로그인에 실패하면 401과 실패 결과를 반환하고 실패 코드만 기록한다', async () => {
    authResults.signIn = { ok: false, msg: '이메일 또는 비밀번호가 틀렸어요.', code: 'invalid_credentials' };

    const res = await signIn({ email: 'a@example.com', password: 'secret1' });

    expect(res).toEqual({
      status: 401,
      body: { ok: false, msg: '이메일 또는 비밀번호가 틀렸어요.', code: 'invalid_credentials' },
    });
    expect(sentryLogs).toEqual([{ level: 'warn', message: 'Auth signin failed', attributes: { code: 'invalid_credentials' } }]);
    expect(await db.query(`select 1 from "User"`)).toHaveLength(0);
  });

  it('처음 로그인한 계정의 사용자와 프로필을 만든다', async () => {
    authResults.nextUid = 'user-a';

    const res = await signIn({ email: 'a@example.com', password: 'secret1' });

    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(await db.query(`select id, email from "User"`)).toEqual([{ id: 'user-a', email: 'a@example.com' }]);
    expect(await db.query(`select "userId", nickname from "Profile"`)).toEqual([{ userId: 'user-a', nickname: null }]);
  });

  it('기존 사용자는 이메일을 갱신하고 프로필을 유지한다', async () => {
    await seedUser(db, 'user-a', '햄스터');
    authResults.nextUid = 'user-a';

    await signIn({ email: 'a@example.com', password: 'secret1' });

    expect(await db.query(`select id, email from "User"`)).toEqual([{ id: 'user-a', email: 'a@example.com' }]);
    expect(await db.query(`select "userId", nickname from "Profile"`)).toEqual([{ userId: 'user-a', nickname: '햄스터' }]);
  });
});
