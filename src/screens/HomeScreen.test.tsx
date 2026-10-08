// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeScreen } from './HomeScreen';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeProps(overrides: Partial<Parameters<typeof HomeScreen>[0]> = {}): Parameters<typeof HomeScreen>[0] {
  return {
    email: 'a@b.c',
    nickname: '햄찌',
    uid: 'u1',
    summary: {
      me: { wallet: { balance: 5 }, clearedCount: 2, streak: { current: 1, best: 3 }, season: '2026-W41' },
      rank: null,
      loading: false,
      error: null,
      refresh: vi.fn(async () => {}),
      refreshSoft: vi.fn(async () => {}),
    },
    onSaveNickname: async () => ({ ok: true }),
    onSignup: async () => ({ ok: true }),
    onSignin: async () => ({ ok: true }),
    onReset: async () => ({ ok: true }),
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
    const refreshSoft = vi.fn(async () => {});
    render(<HomeScreen {...makeProps({ summary: { ...makeProps().summary, refreshSoft } })} />);
    await waitFor(() => {
      expect(refreshSoft).toHaveBeenCalled();
    });
  });
});

describe('HomeScreen 무한모드 게스트 게이트', () => {
  const guestProps = (overrides: Partial<Parameters<typeof HomeScreen>[0]> = {}): Parameters<typeof HomeScreen>[0] => {
    const base = makeProps();
    return {
      ...base,
      email: null,
      endlessEnabled: true,
      onLogin: vi.fn(),
      ...overrides,
    };
  };

  it('게스트가 무한모드를 누르면 로그인 안내를 보여준다', () => {
    const onLogin = vi.fn();
    render(<HomeScreen {...guestProps({ onLogin })} />);
    fireEvent.click(screen.getByRole('button', { name: '무한모드' }));
    expect(screen.getByRole('dialog', { name: '로그인 안내' })).toBeTruthy();
    expect(screen.getByText(/로그인 후 즐길 수 있어요/)).toBeTruthy();
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('안내에서 로그인을 누르면 계정 연동 다이얼로그가 열린다', () => {
    const onSignup = vi.fn(async () => ({ ok: true }));
    render(<HomeScreen {...guestProps({ onSignup })} />);
    fireEvent.click(screen.getByRole('button', { name: '무한모드' }));
    fireEvent.click(screen.getByRole('button', { name: '로그인 안내 로그인' }));
    expect(screen.getByRole('dialog', { name: '계정 연동' })).toBeTruthy();
  });

  it('로그인 사용자는 안내 없이 바로 진입한다', () => {
    const onEndless = vi.fn();
    render(<HomeScreen {...guestProps({ email: 'a@b.c', onEndless })} />);
    fireEvent.click(screen.getByRole('button', { name: '무한모드' }));
    expect(onEndless).toHaveBeenCalled();
  });
});
