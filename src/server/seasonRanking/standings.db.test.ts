import { beforeAll, describe, expect, it, vi } from 'vitest';
import { seedUser, useRouteDatabase } from '../../../tools/dbTest/routeHarness';

const lookup = vi.hoisted(() => ({ fail: false }));

vi.mock('../account/queries', async (original) => {
  const actual = await original<typeof import('../account/queries')>();
  return {
    ...actual,
    findNicknames: async (...args: Parameters<typeof actual.findNicknames>) => {
      if (lookup.fail) throw new Error('lookup failed');
      return actual.findNicknames(...args);
    },
  };
});

const db = useRouteDatabase();
let displayNicknames: typeof import('./standings').displayNicknames;

beforeAll(async () => {
  ({ displayNicknames } = await import('./standings'));
});

describe('displayNicknames', () => {
  it('조회에 성공하면 사용자별 닉네임을 돌려준다', async () => {
    lookup.fail = false;
    await seedUser(db, 'user-a', '햄찌');
    expect(await displayNicknames(['user-a', 'user-b'])).toEqual({ 'user-a': '햄찌', 'user-b': null });
  });

  it('조회가 실패하면 관측하고 모든 사용자를 null로 돌려준다', async () => {
    lookup.fail = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(await displayNicknames(['user-a', 'user-b'])).toEqual({ 'user-a': null, 'user-b': null });
      expect(warn).toHaveBeenCalledWith('Nickname lookup failed');
    } finally {
      warn.mockRestore();
      lookup.fail = false;
    }
  });
});
