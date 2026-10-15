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
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: supabaseStub }) }));

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
