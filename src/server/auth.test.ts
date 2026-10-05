import { afterEach, describe, expect, it, vi } from 'vitest';

describe('auth errors', () => {
  it('미설정이면 무해하게 실패한다', async () => {
    vi.stubEnv('SUPABASE_URL', '');
    const { signInWithEmail } = await import('./auth');
    expect((await signInWithEmail('a@b.c', '123456')).ok).toBe(false);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
