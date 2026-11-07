// @vitest-environment node
import { APIError } from 'better-auth/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInAnonymous: vi.fn(),
  upgradeAnonymous: vi.fn(),
  signInEmail: vi.fn(),
  signOut: vi.fn(),
  requestPasswordReset: vi.fn(),
  openRecoverySession: vi.fn(),
  resetPassword: vi.fn(),
}));
const state = vi.hoisted(() => ({
  configured: true,
  jar: new Map<string, string>(),
  sets: [] as { name: string; value: string; options: Record<string, unknown> }[],
  deleted: [] as string[],
}));

vi.mock('./identity/instance', () => ({
  appAuth: () => ({ api }),
  isIdentityConfigured: () => state.configured,
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ cookie: [...state.jar].map(([k, v]) => `${k}=${v}`).join('; ') }),
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown> = {}) => {
      state.sets.push({ name, value, options });
      state.jar.set(name, value);
    },
    delete: (name: string) => {
      state.deleted.push(name);
      state.jar.delete(name);
    },
  }),
}));

import {
  applyNewPassword,
  currentAccount,
  ensureSession,
  exchangeRecoveryCode,
  getSessionUser,
  isAuthConfigured,
  requestPasswordReset,
  signInWithEmail,
  signOutAccount,
  signUpWithEmail,
} from './auth';

const apiError = (code: string, status: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'UNPROCESSABLE_ENTITY' = 'BAD_REQUEST') =>
  new APIError(status, { code, message: code });

/** 인증 API가 returnHeaders로 돌려주는 응답. */
function reply<T>(response: T, ...setCookies: string[]) {
  const headers = new Headers();
  for (const c of setCookies) headers.append('set-cookie', c);
  return { headers, response };
}
const SESSION_COOKIE = 'better-auth.session_token=tok.sig; Max-Age=31536000; Path=/; HttpOnly; SameSite=Lax';

const account = { user: { id: 'u1', email: 'e@x.y', isAnonymous: false } };
const guest = { user: { id: 'anon-1', email: 'x@anonymous.invalid', isAnonymous: true } };

beforeEach(() => {
  state.configured = true;
  state.jar.clear();
  state.sets.length = 0;
  state.deleted.length = 0;
  for (const fn of Object.values(api)) fn.mockReset();
  vi.stubEnv('BETTER_AUTH_URL', 'https://app.test');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('설정 없음', () => {
  it('인증을 호출하지 않고 무해하게 실패한다', async () => {
    state.configured = false;

    expect(isAuthConfigured()).toBe(false);
    expect(await getSessionUser()).toEqual({ uid: null, email: null });
    expect(await ensureSession()).toBeNull();
    expect(await signUpWithEmail('a@b.c', '123456')).toEqual({ ok: false, msg: '클라우드 미설정' });
    expect(await signInWithEmail('a@b.c', '123456')).toEqual({ ok: false, msg: '클라우드 미설정' });
    expect(await requestPasswordReset('a@b.c')).toEqual({ ok: false, msg: '클라우드 미설정' });
    expect(await applyNewPassword('123456')).toEqual({ ok: false, msg: '클라우드 미설정' });
    expect(await exchangeRecoveryCode('token')).toBe(false);
    await signOutAccount();
    for (const fn of Object.values(api)) expect(fn).not.toHaveBeenCalled();
  });
});

describe('getSessionUser', () => {
  it('쿠키 캐시 없이 세션 표를 읽고 uid와 이메일을 반환한다', async () => {
    api.getSession.mockResolvedValue(reply(account));

    expect(await getSessionUser()).toEqual({ uid: 'u1', email: 'e@x.y' });
    expect(api.getSession).toHaveBeenCalledWith(
      expect.objectContaining({ query: { disableCookieCache: true }, returnHeaders: true }),
    );
  });

  it('익명 세션은 이메일을 숨기고, 세션이 없으면 비로그인으로 본다', async () => {
    api.getSession.mockResolvedValueOnce(reply(guest));
    expect(await getSessionUser()).toEqual({ uid: 'anon-1', email: null });

    api.getSession.mockResolvedValueOnce(reply(null));
    expect(await getSessionUser()).toEqual({ uid: null, email: null });
  });

  it('세션 갱신으로 받은 쿠키를 응답에 싣는다', async () => {
    api.getSession.mockResolvedValue(reply(account, SESSION_COOKIE));

    await getSessionUser();

    expect(state.sets).toEqual([
      expect.objectContaining({ name: 'better-auth.session_token', value: 'tok.sig' }),
    ]);
  });

  it('currentAccount는 로그인한 계정의 이메일만 반환한다', async () => {
    api.getSession.mockResolvedValueOnce(reply(account));
    expect(await currentAccount()).toBe('e@x.y');
    api.getSession.mockResolvedValueOnce(reply(guest));
    expect(await currentAccount()).toBeNull();
  });
});

describe('ensureSession', () => {
  it('기존 세션이 있으면 익명 로그인을 하지 않고 그 사용자를 반환한다', async () => {
    api.getSession.mockResolvedValue(reply(guest));

    expect(await ensureSession()).toEqual({ uid: 'anon-1', email: null });
    expect(api.signInAnonymous).not.toHaveBeenCalled();
  });

  it('로그인된 기존 세션은 이메일을 함께 반환한다', async () => {
    api.getSession.mockResolvedValue(reply(account));

    expect(await ensureSession()).toEqual({ uid: 'u1', email: 'e@x.y' });
  });

  it('세션이 없으면 익명 사용자를 만들고 세션 쿠키를 싣는다', async () => {
    api.getSession.mockResolvedValue(reply(null));
    api.signInAnonymous.mockResolvedValue(reply({ token: 't', user: { id: 'anon-2' } }, SESSION_COOKIE));

    expect(await ensureSession()).toEqual({ uid: 'anon-2', email: null });
    expect(state.sets.map((s) => s.name)).toEqual(['better-auth.session_token']);
  });

  it('익명 사용자를 만들 수 없으면 null이다', async () => {
    api.getSession.mockResolvedValue(reply(null));
    api.signInAnonymous.mockResolvedValue(reply(null));

    expect(await ensureSession()).toBeNull();
  });
});

describe('signUpWithEmail', () => {
  it('익명 사용자를 같은 uid로 승격하고 갱신된 쿠키를 싣는다', async () => {
    api.upgradeAnonymous.mockResolvedValue(reply({ user: { id: 'anon-1', email: 'a@b.c' } }, SESSION_COOKIE));

    expect(await signUpWithEmail('a@b.c', 'secret1')).toEqual({ ok: true });
    expect(api.upgradeAnonymous).toHaveBeenCalledWith(
      expect.objectContaining({ body: { email: 'a@b.c', password: 'secret1' } }),
    );
    expect(state.sets).toHaveLength(1);
  });

  it('중복 이메일은 user_already_exists 코드로 돌려준다', async () => {
    api.upgradeAnonymous.mockRejectedValue(apiError('USER_ALREADY_EXISTS', 'UNPROCESSABLE_ENTITY'));

    expect(await signUpWithEmail('a@b.c', 'secret1')).toEqual({
      ok: false,
      msg: '이미 가입된 이메일이에요.',
      code: 'user_already_exists',
    });
  });

  it('짧은 비밀번호는 weak_password 코드로 돌려준다', async () => {
    api.upgradeAnonymous.mockRejectedValue(apiError('PASSWORD_TOO_SHORT'));

    expect(await signUpWithEmail('a@b.c', '123')).toEqual({
      ok: false,
      msg: '비밀번호가 너무 짧아요 (6자 이상).',
      code: 'weak_password',
    });
  });

  it('데이터베이스 같은 내부 오류는 삼키지 않는다', async () => {
    api.upgradeAnonymous.mockRejectedValue(new Error('connection refused'));

    await expect(signUpWithEmail('a@b.c', 'secret1')).rejects.toThrow('connection refused');
  });
});

describe('signInWithEmail', () => {
  it('성공하면 새 세션 쿠키를 싣는다', async () => {
    state.jar.set('better-auth.session_token', 'tok.sig');
    api.getSession.mockResolvedValue(reply(guest));
    api.signInEmail.mockResolvedValue(reply({ user: { id: 'u1' } }, SESSION_COOKIE));

    expect(await signInWithEmail('a@b.c', 'secret1')).toEqual({ ok: true });
    expect(api.signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({ body: { email: 'a@b.c', password: 'secret1' } }),
    );
    expect(api.signInEmail.mock.calls[0][0].headers.get('cookie')).toContain('better-auth.session_token');
    expect(state.sets).toHaveLength(1);
  });

  it('유효하지 않은 세션 쿠키는 로그인 요청에 싣지 않는다', async () => {
    state.jar.set('better-auth.session_token', 'stale.sig');
    api.getSession.mockResolvedValue(reply(null));
    api.signInEmail.mockResolvedValue(reply({ user: { id: 'u1' } }, SESSION_COOKIE));

    expect(await signInWithEmail('a@b.c', 'secret1')).toEqual({ ok: true });

    expect(api.signInEmail.mock.calls[0][0].headers.get('cookie')).toBeNull();
  });

  it('틀린 자격은 invalid_credentials 코드로 돌려주고 쿠키를 건드리지 않는다', async () => {
    api.getSession.mockResolvedValue(reply(guest));
    api.signInEmail.mockRejectedValue(apiError('INVALID_EMAIL_OR_PASSWORD', 'UNAUTHORIZED'));

    expect(await signInWithEmail('a@b.c', 'wrong-pass')).toEqual({
      ok: false,
      msg: '이메일 또는 비밀번호가 틀렸어요.',
      code: 'invalid_credentials',
    });
    expect(state.sets).toHaveLength(0);
  });
});

describe('signOutAccount', () => {
  it('세션을 끊고 지우는 쿠키를 싣는다', async () => {
    api.signOut.mockResolvedValue(
      reply({ success: true }, 'better-auth.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax'),
    );

    await signOutAccount();

    expect(api.signOut).toHaveBeenCalledTimes(1);
    expect(state.sets).toEqual([expect.objectContaining({ name: 'better-auth.session_token', value: '' })]);
  });
});

describe('requestPasswordReset', () => {
  it('이메일로 재설정 메일을 요청한다', async () => {
    api.requestPasswordReset.mockResolvedValue(reply({ status: true }));

    expect(await requestPasswordReset('a@b.c')).toEqual({ ok: true });
    expect(api.requestPasswordReset).toHaveBeenCalledWith(expect.objectContaining({ body: { email: 'a@b.c' } }));
  });
});

describe('재설정 링크 착지', () => {
  it('유효한 토큰이면 세션 쿠키와 http 전용 재설정 쿠키를 싣고 true를 반환한다', async () => {
    api.openRecoverySession.mockResolvedValue(reply({ user: { id: 'u1' } }, SESSION_COOKIE));

    expect(await exchangeRecoveryCode('reset-token')).toBe(true);

    expect(api.openRecoverySession).toHaveBeenCalledWith(expect.objectContaining({ body: { token: 'reset-token' } }));
    const recovery = state.sets.find((s) => s.name === 'hamsudoku.recovery');
    expect(recovery?.value).toBe('reset-token');
    expect(recovery?.options).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: true, path: '/api/auth', maxAge: 3600 });
    expect(state.sets.map((s) => s.name)).toContain('better-auth.session_token');
  });

  it('유효하지 않은 토큰이면 false이고 쿠키를 싣지 않는다', async () => {
    api.openRecoverySession.mockRejectedValue(apiError('INVALID_TOKEN'));

    expect(await exchangeRecoveryCode('bad')).toBe(false);
    expect(state.sets).toHaveLength(0);
  });
});

describe('applyNewPassword', () => {
  it('재설정 쿠키가 없으면 invalid_token으로 실패하고 재설정을 호출하지 않는다', async () => {
    const result = await applyNewPassword('secret1');

    expect(result).toMatchObject({ ok: false, code: 'invalid_token' });
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('토큰으로 비밀번호를 바꾸고 같은 계정으로 다시 로그인한 뒤 재설정 쿠키를 지운다', async () => {
    state.jar.set('hamsudoku.recovery', 'reset-token');
    state.jar.set('better-auth.session_token', 'tok.sig');
    const calls: string[] = [];
    api.getSession.mockImplementation(async () => {
      calls.push('getSession');
      return reply(account);
    });
    api.resetPassword.mockImplementation(async () => {
      calls.push('resetPassword');
      return reply({ status: true });
    });
    api.signInEmail.mockImplementation(async () => {
      calls.push('signInEmail');
      return reply({ user: { id: 'u1' } }, SESSION_COOKIE);
    });

    expect(await applyNewPassword('brand-new-1')).toEqual({ ok: true });

    // 재설정이 모든 세션을 폐기하므로 이메일은 폐기 전에 읽는다.
    expect(calls).toEqual(['getSession', 'resetPassword', 'signInEmail']);
    expect(api.resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({ body: { newPassword: 'brand-new-1', token: 'reset-token' } }),
    );
    expect(api.signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({ body: { email: 'e@x.y', password: 'brand-new-1' } }),
    );
    // 폐기된 세션 쿠키는 다시 로그인하는 요청에 싣지 않는다.
    expect(api.signInEmail.mock.calls[0][0].headers.get('cookie')).toBeNull();
    expect(state.deleted).toEqual(['hamsudoku.recovery']);
    expect(state.sets.map((s) => s.name)).toContain('better-auth.session_token');
  });

  it('비밀번호가 규칙에 맞지 않으면 토큰을 소비하지 않고 쿠키를 남긴다', async () => {
    state.jar.set('hamsudoku.recovery', 'reset-token');
    api.getSession.mockResolvedValue(reply(account));
    api.resetPassword.mockRejectedValue(apiError('PASSWORD_TOO_SHORT'));

    expect(await applyNewPassword('123')).toMatchObject({ ok: false, code: 'weak_password' });
    expect(state.deleted).toEqual([]);
    expect(api.signInEmail).not.toHaveBeenCalled();
  });

  it('만료된 토큰이면 invalid_token으로 실패한다', async () => {
    state.jar.set('hamsudoku.recovery', 'old-token');
    api.getSession.mockResolvedValue(reply(account));
    api.resetPassword.mockRejectedValue(apiError('INVALID_TOKEN'));

    expect(await applyNewPassword('brand-new-1')).toMatchObject({ ok: false, code: 'invalid_token' });
  });

  it('재설정 세션이 이미 없으면 invalid_token으로 실패한다', async () => {
    state.jar.set('hamsudoku.recovery', 'reset-token');
    api.getSession.mockResolvedValue(reply(null));

    expect(await applyNewPassword('brand-new-1')).toMatchObject({ ok: false, code: 'invalid_token' });
    expect(api.resetPassword).not.toHaveBeenCalled();
  });
});
