// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useAccount } from '../service/useAccount';

const api = vi.hoisted(() => ({ me: vi.fn(), session: vi.fn(), profile: vi.fn() }));
vi.mock('../api/accountApi', () => ({
  authApi: {
    me: api.me,
    session: api.session,
    signup: vi.fn(), signin: vi.fn(), signout: vi.fn(), reset: vi.fn(), setPassword: vi.fn(),
  },
  profileApi: { get: api.profile, save: vi.fn() },
}));
afterEach(cleanup);

it('게스트 세션 복원이 계정 없음으로 끝나면 이전 프로필을 비운다', async () => {
  api.me.mockResolvedValueOnce({ uid: 'guest-1', email: null, cloud: true });
  api.profile.mockResolvedValue({ nickname: '이전 프로필' });
  api.session.mockResolvedValue(null);
  const { result } = renderHook(() => useAccount());
  await waitFor(() => expect(result.current.nickname).toBe('이전 프로필'));
  api.me.mockResolvedValueOnce({ uid: null, email: null, cloud: true });
  await act(async () => result.current.warmSession());
  expect(result.current.uid).toBeNull();
  expect(result.current.nickname).toBeNull();
});
