import { beforeAll, describe, expect, it, vi } from 'vitest';
import { authResults, callRoute, sentryLogs, seedUser, signInAs, useRouteDatabase } from '../../../../../tools/dbTest/routeHarness';

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

function signUp(body: unknown) {
  return callRoute(POST, { path: '/api/auth/signup', body });
}

describe('POST /api/auth/signup', () => {
  it('요청 형식이 틀리면 400을 반환한다', async () => {
    expect(await signUp({ email: 'a@example.com', password: '123' })).toEqual({
      status: 400,
      body: { ok: false, msg: '이메일과 비밀번호를 확인하세요.' },
    });
  });

  it('익명 사용자를 승격하면 같은 사용자 행에 이메일을 기록한다', async () => {
    await seedUser(db, 'user-a', '햄스터');
    signInAs('user-a');

    const res = await signUp({ email: 'a@example.com', password: 'secret1' });

    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(await db.query(`select id, email from "User"`)).toEqual([{ id: 'user-a', email: 'a@example.com' }]);
    expect(await db.query(`select "userId", nickname from "Profile"`)).toEqual([{ userId: 'user-a', nickname: '햄스터' }]);
  });

  it.each([['email_exists'], ['user_already_exists']])('중복 이메일(%s)은 409를 반환한다', async (code) => {
    await seedUser(db, 'user-a');
    signInAs('user-a');
    authResults.signUp = { ok: false, msg: '이미 가입된 이메일이에요.', code };

    const res = await signUp({ email: 'a@example.com', password: 'secret1' });

    expect(res).toEqual({ status: 409, body: { ok: false, msg: '이미 가입된 이메일이에요.', code } });
    expect(sentryLogs).toEqual([{ level: 'warn', message: 'Auth signup failed', attributes: { code } }]);
    expect(await db.query(`select email from "User"`)).toEqual([{ email: null }]);
  });

  it('그 밖의 실패는 400을 반환한다', async () => {
    await seedUser(db, 'user-a');
    signInAs('user-a');
    authResults.signUp = { ok: false, msg: '비밀번호가 너무 짧아요 (6자 이상).', code: 'weak_password' };

    const res = await signUp({ email: 'a@example.com', password: 'secret1' });

    expect(res.status).toBe(400);
    expect(await db.query(`select email from "User"`)).toEqual([{ email: null }]);
  });
});
