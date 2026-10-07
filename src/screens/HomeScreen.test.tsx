// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { HomeScreen } from './HomeScreen';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeProps(overrides: Partial<Parameters<typeof HomeScreen>[0]> = {}): Parameters<typeof HomeScreen>[0] {
  return {
    email: 'a@b.c',
    nickname: '햄찌',
    summary: {
      me: { wallet: { balance: 5 }, clearedCount: 2, streak: { current: 1, best: 3 }, season: '2026-W41' },
      rank: null,
      loading: false,
      error: null,
      refresh: vi.fn(async () => {}),
    },
    onSaveNickname: async () => ({ ok: true }),
    onBrowse: () => {},
    onEndless: () => {},
    endlessEnabled: true,
    onLogin: () => {},
    onLogout: () => {},
    ...overrides,
  };
}

describe('HomeScreen 진입 갱신', () => {
  it('홈에 들어올 때마다 요약을 다시 요청한다', async () => {
    const refresh = vi.fn(async () => {});
    render(<HomeScreen {...makeProps({ summary: { ...makeProps().summary, refresh } })} />);
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });
});
