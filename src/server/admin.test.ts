import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAdmin } from './admin';

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.ADMIN_UIDS;
});

describe('isAdmin', () => {
  it('ADMIN_UIDS에 uid가 있으면 통과한다', async () => {
    process.env.ADMIN_UIDS = 'uA, uB';
    vi.spyOn(await import('./auth'), 'getSessionUser').mockResolvedValue({ uid: 'uB', email: 'x@y.z' });
    expect(await isAdmin()).toBe(true);
  });

  it('목록에 없으면 거절한다', async () => {
    process.env.ADMIN_UIDS = 'uA';
    vi.spyOn(await import('./auth'), 'getSessionUser').mockResolvedValue({ uid: 'uX', email: 'x@y.z' });
    expect(await isAdmin()).toBe(false);
  });

  it('로그인이 없으면 거절한다', async () => {
    process.env.ADMIN_UIDS = 'uA';
    vi.spyOn(await import('./auth'), 'getSessionUser').mockResolvedValue({ uid: null, email: null });
    expect(await isAdmin()).toBe(false);
  });

  it('env 미설정이면 모두 거절한다', async () => {
    vi.spyOn(await import('./auth'), 'getSessionUser').mockResolvedValue({ uid: 'uA', email: 'x@y.z' });
    expect(await isAdmin()).toBe(false);
  });
});
