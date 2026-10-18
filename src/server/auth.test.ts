import { afterEach, describe, expect, it, vi } from 'vitest';

describe('auth errors', () => {
  it('미설정이면 무해하게 실패한다', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    const { signInWithEmail, requestPasswordReset, applyNewPassword } = await import('./auth');
    expect((await signInWithEmail('a@b.c', '123456')).ok).toBe(false);
    expect((await requestPasswordReset('a@b.c', 'http://x')).ok).toBe(false);
    expect((await applyNewPassword('123456')).ok).toBe(false);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const supabaseStub = vi.hoisted(() => ({
  getClaims: vi.fn(),
  getUser: vi.fn(),
  signInAnonymously: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
const clientOptions = vi.hoisted(() => ({ last: null as null | { global?: { fetch?: unknown } } }));
const serverFetch = vi.hoisted(() => vi.fn());
vi.mock('./keepAliveFetch', () => ({ serverFetch }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, options: { global?: { fetch?: unknown } }) => {
    clientOptions.last = options;
    return { auth: supabaseStub };
  },
}));

describe('getSessionUser', () => {
  it('서명을 로컬 검증한 claims로 세션을 판정하고 Auth 서버 getUser를 호출하지 않는다', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
    supabaseStub.getClaims.mockResolvedValue({
      data: { claims: { sub: 'u1', email: 'e@x.y', is_anonymous: false } },
      error: null,
    });
    const { getSessionUser } = await import('./auth');
    expect(await getSessionUser()).toEqual({ uid: 'u1', email: 'e@x.y' });
    expect(supabaseStub.getUser).not.toHaveBeenCalled();
  });
  it('익명 세션은 이메일을 숨기고, 검증 실패는 비로그인으로 본다', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
    const { getSessionUser } = await import('./auth');
    supabaseStub.getClaims.mockResolvedValueOnce({
      data: { claims: { sub: 'anon-1', email: 'anon@x.y', is_anonymous: true } },
      error: null,
    });
    expect(await getSessionUser()).toEqual({ uid: 'anon-1', email: null });
    supabaseStub.getClaims.mockResolvedValueOnce({ data: null, error: { message: 'invalid' } });
    expect(await getSessionUser()).toEqual({ uid: null, email: null });
  });
});

describe('ensureSession', () => {
  it('검증된 세션이 있으면 Auth 서버를 호출하지 않고 그 사용자를 반환한다', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
    supabaseStub.getUser.mockClear();
    supabaseStub.signInAnonymously.mockClear();
    supabaseStub.getClaims.mockResolvedValueOnce({
      data: { claims: { sub: 'u1', is_anonymous: true } },
      error: null,
    });
    const { ensureSession } = await import('./auth');

    expect(await ensureSession()).toEqual({ uid: 'u1', email: null });
    expect(supabaseStub.getUser).not.toHaveBeenCalled();
    expect(supabaseStub.signInAnonymously).not.toHaveBeenCalled();
  });

  it('검증된 세션이 없으면 익명 로그인으로 새 사용자를 만든다', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
    supabaseStub.getClaims.mockResolvedValueOnce({ data: null, error: null });
    supabaseStub.signInAnonymously.mockResolvedValueOnce({ data: { user: { id: 'anon-2' } }, error: null });
    const { ensureSession } = await import('./auth');

    expect(await ensureSession()).toEqual({ uid: 'anon-2', email: null });
  });

  it('로그인된 기존 세션은 이메일을 함께 반환한다', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
    supabaseStub.getClaims.mockResolvedValueOnce({
      data: { claims: { sub: 'u3', email: 'u3@x.y', is_anonymous: false } },
      error: null,
    });
    const { ensureSession } = await import('./auth');

    expect(await ensureSession()).toEqual({ uid: 'u3', email: 'u3@x.y' });
  });
});

describe('Supabase 서버 클라이언트', () => {
  it('Auth 요청을 연결을 유지하는 서버 fetch로 보낸다', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
    supabaseStub.getClaims.mockResolvedValueOnce({ data: null, error: null });
    const { getSessionUser } = await import('./auth');

    await getSessionUser();

    expect(clientOptions.last?.global?.fetch).toBe(serverFetch);
  });
});
