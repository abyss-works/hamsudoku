// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { outbound, useRouteDatabase } from '../../tools/dbTest/routeHarness';

// 브라우저 쿠키 저장소 대역. 서버 코드가 쓰는 쿠키가 다음 요청에 그대로 실려 간다.
const jar = vi.hoisted(() => new Map<string, string>());
vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({ cookie: [...jar].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ') }),
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string, options: { maxAge?: number } = {}) => {
      if (value === '' || options.maxAge === 0) jar.delete(name);
      else jar.set(name, value);
    },
    delete: (name: string) => jar.delete(name),
  }),
}));
vi.mock('@sentry/nextjs', async () => (await import('../../tools/dbTest/routeHarness')).mockSentry());

const db = useRouteDatabase();
let auth: typeof import('./auth');

beforeAll(async () => {
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-test-secret-test-secret');
  vi.stubEnv('BETTER_AUTH_URL', 'http://app.test');
  vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
  vi.stubEnv('MAIL_FROM', 'hamsudoku <no-reply@app.test>');
  auth = await import('./auth');
});

beforeEach(async () => {
  jar.clear();
  await db.query('truncate table auth.users, auth.verifications cascade');
});

function sentResetToken(): string {
  const mails = outbound.requests.filter((r) => r.url === 'https://api.resend.com/emails');
  const body = mails.at(-1)!.body as { text: string };
  return new URL(body.text.match(/https?:\/\/\S+/)![0]).searchParams.get('token')!;
}

describe('인증 흐름', () => {
  it('익명 세션 → 가입(uid 유지) → 로그아웃 → 로그인 → 비밀번호 재설정까지 같은 uid를 유지한다', async () => {
    const session = await auth.ensureSession();
    expect(session?.email).toBeNull();
    const uid = session!.uid;
    expect(await auth.ensureSession()).toEqual({ uid, email: null });
    expect(await auth.getSessionUser()).toEqual({ uid, email: null });

    expect(await auth.signUpWithEmail('Hamster@Example.com', 'secret1')).toEqual({ ok: true });
    expect(await auth.getSessionUser()).toEqual({ uid, email: 'hamster@example.com' });
    expect(await auth.currentAccount()).toBe('hamster@example.com');

    await auth.signOutAccount();
    expect(await auth.getSessionUser()).toEqual({ uid: null, email: null });

    expect(await auth.signInWithEmail('hamster@example.com', 'wrong-pass')).toMatchObject({ ok: false, code: 'invalid_credentials' });
    expect(await auth.signInWithEmail('hamster@example.com', 'secret1')).toEqual({ ok: true });
    expect(await auth.getSessionUser()).toEqual({ uid, email: 'hamster@example.com' });

    await auth.signOutAccount();
    expect(await auth.requestPasswordReset('hamster@example.com')).toEqual({ ok: true });
    const mailBody = outbound.requests.at(-1)!.body as { to: string[]; subject: string; from: string };
    expect(mailBody).toMatchObject({ to: ['hamster@example.com'], from: 'hamsudoku <no-reply@app.test>' });

    expect(await auth.exchangeRecoveryCode(sentResetToken())).toBe(true);
    expect(await auth.getSessionUser()).toEqual({ uid, email: 'hamster@example.com' });
    expect(await auth.applyNewPassword('brand-new-1')).toEqual({ ok: true });
    expect(jar.has('hamsudoku.recovery')).toBe(false);
    expect(await auth.getSessionUser()).toEqual({ uid, email: 'hamster@example.com' });

    await auth.signOutAccount();
    expect(await auth.signInWithEmail('hamster@example.com', 'secret1')).toMatchObject({ ok: false, code: 'invalid_credentials' });
    expect(await auth.signInWithEmail('hamster@example.com', 'brand-new-1')).toEqual({ ok: true });
    expect(await auth.getSessionUser()).toEqual({ uid, email: 'hamster@example.com' });
  });

  it('이미 가입된 이메일로 승격하면 user_already_exists이고 게스트 세션은 유지된다', async () => {
    await auth.ensureSession();
    await auth.signUpWithEmail('taken@example.com', 'secret1');
    jar.clear();
    const guest = await auth.ensureSession();

    expect(await auth.signUpWithEmail('taken@example.com', 'secret1')).toMatchObject({
      ok: false,
      code: 'user_already_exists',
    });
    expect(await auth.getSessionUser()).toEqual({ uid: guest!.uid, email: null });
  });

  it('재설정 쿠키가 없거나 토큰이 소비된 뒤에는 새 비밀번호를 적용하지 않는다', async () => {
    await auth.ensureSession();
    await auth.signUpWithEmail('a@example.com', 'secret1');
    await auth.requestPasswordReset('a@example.com');
    const token = sentResetToken();
    expect(await auth.exchangeRecoveryCode(token)).toBe(true);
    expect(await auth.applyNewPassword('123')).toMatchObject({ ok: false, code: 'weak_password' });
    expect(await auth.applyNewPassword('brand-new-1')).toEqual({ ok: true });

    jar.set('hamsudoku.recovery', token);
    expect(await auth.applyNewPassword('another-pass-1')).toMatchObject({ ok: false, code: 'invalid_token' });
    jar.delete('hamsudoku.recovery');
    expect(await auth.applyNewPassword('another-pass-1')).toMatchObject({ ok: false, code: 'invalid_token' });
    expect(await auth.exchangeRecoveryCode('unknown-token')).toBe(false);
  });

  it('기존 인증 서버에서 옮긴 사용자 id와 bcrypt 해시로 로그인한다', async () => {
    const uid = '3f2c1a9e-5b7d-4e21-9a0c-6d8f4b1e2a77';
    const hash = (await import('bcryptjs')).default.hashSync('hamster-pass-1', '$2a$10$abcdefghijklmnopqrstuu');
    await db.query(`insert into auth.users (id, email, email_verified, is_anonymous) values ($1, 'legacy@example.com', true, false)`, [uid]);
    await db.query(
      `insert into auth.accounts (id, user_id, account_id, provider_id, password) values ('acc-1', $1, $1, 'credential', $2)`,
      [uid, hash],
    );

    expect(await auth.signInWithEmail('legacy@example.com', 'hamster-pass-1')).toEqual({ ok: true });
    expect(await auth.getSessionUser()).toEqual({ uid, email: 'legacy@example.com' });
  });

  it('서버에서 세션이 사라진 쿠키가 남아 있어도 로그인하면 새 세션이 선다', async () => {
    await auth.ensureSession();
    await auth.signUpWithEmail('a@example.com', 'secret1');
    const { uid } = await auth.getSessionUser() as { uid: string };
    await db.query('delete from auth.sessions');

    expect(await auth.signInWithEmail('a@example.com', 'secret1')).toEqual({ ok: true });

    expect(await auth.getSessionUser()).toEqual({ uid, email: 'a@example.com' });
  });
});
