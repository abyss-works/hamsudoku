// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAuthService } from './useAuthService';
import { authApi } from '../api/accountApi';

vi.mock('../api/accountApi', () => ({
  authApi: {
    me: vi.fn(),
    session: vi.fn(async () => ({ uid: null })),
    signup: vi.fn(),
    signin: vi.fn(),
    signout: vi.fn(),
    reset: vi.fn(),
    setPassword: vi.fn(),
  },
}));

const mockedMe = vi.mocked(authApi.me);
const mockedSession = vi.mocked(authApi.session);

describe('useAuthService 단위 및 생명주기 계약', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('부팅 시 기존 사용자가 있으면 auth 상태를 로드하고 loading을 false로 전환한다', async () => {
    mockedMe.mockResolvedValueOnce({ uid: 'u1', email: 'u1@test.com', cloud: true });
    const onBootAuth = vi.fn();

    const { result } = renderHook(() => useAuthService({ onBootAuth }));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.uid).toBe('u1');
    expect(result.current.email).toBe('u1@test.com');
    expect(result.current.cloud).toBe(true);
    expect(onBootAuth).toHaveBeenCalledWith('u1');
  });

  it('부팅 시 uid가 없으면 session()을 확보하고 me()를 다시 읽는다', async () => {
    mockedMe
      .mockResolvedValueOnce({ uid: null, email: null, cloud: true })
      .mockResolvedValueOnce({ uid: 'anon1', email: null, cloud: true });
    mockedSession.mockResolvedValueOnce({ uid: 'anon1' });
    const onBootAuth = vi.fn();

    const { result } = renderHook(() => useAuthService({ onBootAuth }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockedSession).toHaveBeenCalled();
    expect(result.current.uid).toBe('anon1');
    expect(onBootAuth).toHaveBeenCalledWith('anon1');
  });

  it('warmSession은 로그인 사용자는 건너뛰고 게스트만 세션을 확보한다', async () => {
    mockedMe.mockResolvedValueOnce({ uid: 'u1', email: 'user@test.com', cloud: true });
    const { result } = renderHook(() => useAuthService());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedSession.mockClear();
    await act(async () => {
      await result.current.warmSession();
    });
    expect(mockedSession).not.toHaveBeenCalled();

    // 이제 게스트 상태로 refresh
    mockedMe.mockResolvedValueOnce({ uid: 'anon2', email: null, cloud: true });
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.email).toBeNull();

    mockedSession.mockResolvedValueOnce({ uid: 'anon3' });
    mockedMe.mockResolvedValueOnce({ uid: 'anon3', email: null, cloud: true });
    await act(async () => {
      await result.current.warmSession();
    });
    expect(mockedSession).toHaveBeenCalled();
    expect(result.current.uid).toBe('anon3');
  });

  it('StrictMode 환경에서도 정상적으로 부팅을 완료한다', async () => {
    mockedMe.mockResolvedValue({ uid: 'u-strict', email: 'strict@test.com', cloud: true });
    const onBootAuth = vi.fn();

    const { result } = renderHook(() => useAuthService({ onBootAuth }), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <React.StrictMode>{children}</React.StrictMode>
      ),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.uid).toBe('u-strict');
  });
});
