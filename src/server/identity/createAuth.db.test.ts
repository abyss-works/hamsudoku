import { parseSetCookieHeader } from 'better-auth/cookies';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../../../tools/dbTest/testDatabase';
import { createAuth, type Auth } from './createAuth';
import type { MailSender } from './mail';

const BASE_URL = 'http://app.test';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let database: TestDatabase;
let pool: Pool;
let auth: Auth;
const sent: { to: string; url: string }[] = [];
const mail: MailSender = {
  async sendPasswordReset(to, url) {
    sent.push({ to, url });
  },
};

beforeAll(async () => {
  database = await createTestDatabase();
  pool = new Pool({ connectionString: database.url, max: 2 });
  auth = createAuth({ executor: drizzle({ client: pool }), secret: 'test-secret-test-secret-test-secret', baseURL: BASE_URL, mail });
});

afterAll(async () => {
  await pool?.end();
  await database?.drop();
});

beforeEach(async () => {
  await pool.query('truncate table auth.users, auth.verifications cascade');
  sent.length = 0;
});

/** 응답의 Set-Cookie를 모아 다음 요청의 Cookie 헤더로 돌려주는 브라우저 대역. */
function browser() {
  const jar = new Map<string, string>();
  return {
    headers: () => new Headers({ cookie: [...jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ') }),
    keep(headers: Headers) {
      for (const [name, attrs] of parseSetCookieHeader(headers.get('set-cookie') ?? '')) {
        if (attrs.value === '' || attrs['max-age'] === 0) jar.delete(name);
        else jar.set(name, attrs.value);
      }
    },
  };
}

async function guest() {
  const b = browser();
  const { headers, response } = await auth.api.signInAnonymous({ headers: b.headers(), returnHeaders: true });
  b.keep(headers);
  return { b, uid: response!.user.id };
}

const sessionOf = (b: ReturnType<typeof browser>) =>
  auth.api.getSession({ headers: b.headers(), query: { disableCookieCache: true } });

const legacyHash = (password: string) => bcrypt.hashSync(password, '$2a$10$abcdefghijklmnopqrstuu');

async function seedLegacyUser(id: string, email: string, password: string) {
  await pool.query(`insert into auth.users (id, email, email_verified) values ($1, $2, true)`, [id, email]);
  await pool.query(
    `insert into auth.accounts (id, user_id, account_id, provider_id, password) values ($1, $2, $2, 'credential', $3)`,
    [`acc-${id}`, id, legacyHash(password)],
  );
}

describe('익명 세션', () => {
  it('UUID 형식 id의 익명 사용자와 세션을 만들고 이메일은 자리표시 주소다', async () => {
    const { b, uid } = await guest();

    expect(uid).toMatch(UUID);
    const session = await sessionOf(b);
    expect(session?.user.id).toBe(uid);
    expect((session?.user as { isAnonymous?: boolean }).isAnonymous).toBe(true);
    expect(session?.user.email).toMatch(/^[0-9a-f-]{36}@anonymous\.invalid$/);
  });

  it('쿠키가 없으면 세션이 없다', async () => {
    expect(await sessionOf(browser())).toBeNull();
  });
});

describe('익명 승격', () => {
  it('같은 사용자 id에 소문자 이메일과 bcrypt credential 계정을 붙이고 세션을 유지한다', async () => {
    const { b, uid } = await guest();

    const { headers, response } = await auth.api.upgradeAnonymous({
      headers: b.headers(),
      body: { email: 'Hamster@Example.com', password: 'secret1' },
      returnHeaders: true,
    });
    b.keep(headers);

    expect(response.user).toEqual({ id: uid, email: 'hamster@example.com' });
    const users = await pool.query(`select id, email, is_anonymous from auth.users`);
    expect(users.rows).toEqual([{ id: uid, email: 'hamster@example.com', is_anonymous: false }]);
    const accounts = await pool.query(`select user_id, account_id, provider_id, password from auth.accounts`);
    expect(accounts.rows).toHaveLength(1);
    expect(accounts.rows[0]).toMatchObject({ user_id: uid, account_id: uid, provider_id: 'credential' });
    expect(bcrypt.compareSync('secret1', accounts.rows[0].password)).toBe(true);
    const session = await sessionOf(b);
    expect(session?.user.id).toBe(uid);
    expect((session?.user as { isAnonymous?: boolean }).isAnonymous).toBe(false);
  });

  it('이미 쓰는 이메일은 대소문자와 무관하게 거절하고 게스트를 그대로 둔다', async () => {
    await seedLegacyUser('11111111-1111-4111-8111-111111111111', 'taken@example.com', 'secret1');
    const { b, uid } = await guest();

    await expect(
      auth.api.upgradeAnonymous({ headers: b.headers(), body: { email: 'TAKEN@example.com', password: 'secret1' } }),
    ).rejects.toMatchObject({ body: { code: 'USER_ALREADY_EXISTS' } });
    expect((await sessionOf(b))?.user.id).toBe(uid);
  });

  it.each([
    ['12345', 'PASSWORD_TOO_SHORT'],
    ['x'.repeat(129), 'PASSWORD_TOO_LONG'],
  ])('길이 경계 밖의 비밀번호(%s자)는 %s로 거절한다', async (password, code) => {
    const { b } = await guest();
    await expect(
      auth.api.upgradeAnonymous({ headers: b.headers(), body: { email: 'a@example.com', password } }),
    ).rejects.toMatchObject({ body: { code } });
  });

  it('6자와 128자 비밀번호는 허용한다', async () => {
    for (const [email, password] of [['a@example.com', '123456'], ['b@example.com', 'x'.repeat(128)]]) {
      const { b } = await guest();
      await auth.api.upgradeAnonymous({ headers: b.headers(), body: { email, password } });
    }
    expect((await pool.query(`select 1 from auth.accounts`)).rowCount).toBe(2);
  });

  it('이미 가입한 사용자와 세션 없는 요청은 거절한다', async () => {
    const { b } = await guest();
    await auth.api.upgradeAnonymous({ headers: b.headers(), body: { email: 'a@example.com', password: 'secret1' } });

    await expect(
      auth.api.upgradeAnonymous({ headers: b.headers(), body: { email: 'b@example.com', password: 'secret1' } }),
    ).rejects.toMatchObject({ body: { code: 'USER_IS_NOT_ANONYMOUS' } });
    await expect(
      auth.api.upgradeAnonymous({ headers: browser().headers(), body: { email: 'c@example.com', password: 'secret1' } }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('이메일 로그인', () => {
  const UID = '3f2c1a9e-5b7d-4e21-9a0c-6d8f4b1e2a77';

  it('이전 인증 서버에서 옮긴 id와 bcrypt 해시로 로그인하면 같은 uid의 세션이 선다', async () => {
    await seedLegacyUser(UID, 'legacy@example.com', 'hamster-pass-1');
    const b = browser();

    const { headers, response } = await auth.api.signInEmail({
      headers: b.headers(),
      body: { email: 'Legacy@Example.com', password: 'hamster-pass-1' },
      returnHeaders: true,
    });
    b.keep(headers);

    expect(response.user.id).toBe(UID);
    expect((await sessionOf(b))?.user.id).toBe(UID);
  });

  it('틀린 비밀번호와 없는 이메일은 같은 오류 코드로 거절한다', async () => {
    await seedLegacyUser(UID, 'legacy@example.com', 'hamster-pass-1');

    for (const body of [
      { email: 'legacy@example.com', password: 'wrong-pass' },
      { email: 'nobody@example.com', password: 'hamster-pass-1' },
    ]) {
      await expect(auth.api.signInEmail({ headers: browser().headers(), body })).rejects.toMatchObject({
        body: { code: 'INVALID_EMAIL_OR_PASSWORD' },
      });
    }
  });

  it('게스트 세션에서 다른 계정으로 로그인해도 게스트 사용자 행은 남는다', async () => {
    await seedLegacyUser(UID, 'legacy@example.com', 'hamster-pass-1');
    const { b, uid: guestUid } = await guest();

    const { headers } = await auth.api.signInEmail({
      headers: b.headers(),
      body: { email: 'legacy@example.com', password: 'hamster-pass-1' },
      returnHeaders: true,
    });
    b.keep(headers);

    expect((await sessionOf(b))?.user.id).toBe(UID);
    const rows = await pool.query(`select id from auth.users where id = $1`, [guestUid]);
    expect(rows.rowCount).toBe(1);
  });

  it('로그아웃하면 세션 행이 지워져 쿠키로 더 이상 조회되지 않는다', async () => {
    const { b } = await guest();
    const before = b.headers();

    const { headers } = await auth.api.signOut({ headers: b.headers(), returnHeaders: true });
    b.keep(headers);

    expect(await sessionOf(b)).toBeNull();
    expect(await auth.api.getSession({ headers: before, query: { disableCookieCache: true } })).toBeNull();
  });
});

describe('비밀번호 재설정', () => {
  const UID = '3f2c1a9e-5b7d-4e21-9a0c-6d8f4b1e2a77';

  async function requestToken(email: string): Promise<string> {
    await auth.api.requestPasswordReset({ body: { email } });
    const url = new URL(sent.at(-1)!.url);
    expect(url.origin + url.pathname).toBe(`${BASE_URL}/api/auth/callback`);
    return url.searchParams.get('token')!;
  }

  it('가입된 이메일로만 BETTER_AUTH_URL 기준 링크를 보내고 토큰은 1시간 유효하다', async () => {
    await seedLegacyUser(UID, 'legacy@example.com', 'hamster-pass-1');

    await auth.api.requestPasswordReset({ body: { email: 'nobody@example.com' } });
    expect(sent).toHaveLength(0);

    const token = await requestToken('legacy@example.com');

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('legacy@example.com');
    expect(token).toMatch(/^[A-Za-z0-9]{24}$/);
    const rows = await pool.query<{ ttl: number }>(
      `select extract(epoch from expires_at - now())::int as ttl from auth.verifications where identifier = $1`,
      [`reset-password:${token}`],
    );
    expect(rows.rows[0].ttl).toBeGreaterThan(3590);
    expect(rows.rows[0].ttl).toBeLessThanOrEqual(3600);
  });

  it('링크로 같은 uid의 세션을 열고, 새 비밀번호를 정하면 기존 세션을 모두 폐기한다', async () => {
    await seedLegacyUser(UID, 'legacy@example.com', 'hamster-pass-1');
    const loggedIn = browser();
    const signedIn = await auth.api.signInEmail({
      headers: loggedIn.headers(),
      body: { email: 'legacy@example.com', password: 'hamster-pass-1' },
      returnHeaders: true,
    });
    loggedIn.keep(signedIn.headers);
    const token = await requestToken('legacy@example.com');

    const recovering = browser();
    const opened = await auth.api.openRecoverySession({ headers: recovering.headers(), body: { token }, returnHeaders: true });
    recovering.keep(opened.headers);
    expect((await sessionOf(recovering))?.user.id).toBe(UID);

    await auth.api.resetPassword({ body: { newPassword: 'brand-new-1', token } });

    expect(await sessionOf(recovering)).toBeNull();
    expect(await sessionOf(loggedIn)).toBeNull();
    await expect(
      auth.api.signInEmail({ headers: browser().headers(), body: { email: 'legacy@example.com', password: 'hamster-pass-1' } }),
    ).rejects.toMatchObject({ body: { code: 'INVALID_EMAIL_OR_PASSWORD' } });
    const again = await auth.api.signInEmail({
      headers: browser().headers(),
      body: { email: 'legacy@example.com', password: 'brand-new-1' },
    });
    expect(again.user.id).toBe(UID);
  });

  it('토큰은 한 번만 쓸 수 있고 너무 짧은 비밀번호는 토큰을 소비하지 않는다', async () => {
    await seedLegacyUser(UID, 'legacy@example.com', 'hamster-pass-1');
    const token = await requestToken('legacy@example.com');

    await expect(auth.api.resetPassword({ body: { newPassword: '12345', token } })).rejects.toMatchObject({
      body: { code: 'PASSWORD_TOO_SHORT' },
    });
    await auth.api.resetPassword({ body: { newPassword: 'brand-new-1', token } });

    await expect(auth.api.resetPassword({ body: { newPassword: 'another-1', token } })).rejects.toMatchObject({
      body: { code: 'INVALID_TOKEN' },
    });
  });

  it('만료된 토큰과 모르는 토큰으로는 세션도 비밀번호 변경도 할 수 없다', async () => {
    await seedLegacyUser(UID, 'legacy@example.com', 'hamster-pass-1');
    const token = await requestToken('legacy@example.com');
    await pool.query(`update auth.verifications set expires_at = now() - interval '1 second'`);

    for (const t of [token, 'unknown-token']) {
      await expect(auth.api.openRecoverySession({ headers: browser().headers(), body: { token: t } })).rejects.toMatchObject({
        body: { code: 'INVALID_TOKEN' },
      });
      await expect(auth.api.resetPassword({ body: { newPassword: 'brand-new-1', token: t } })).rejects.toMatchObject({
        body: { code: 'INVALID_TOKEN' },
      });
    }
  });
});
