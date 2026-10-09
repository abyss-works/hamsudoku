// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAccount } from './useAccount';
import { authApi, profileApi } from '../api/stagesApi';

vi.mock('../api/stagesApi', () => ({
  authApi: {
    me: vi.fn(),
    session: vi.fn(async () => ({ uid: null })),
    signup: vi.fn(),
    signin: vi.fn(),
    signout: vi.fn(),
    reset: vi.fn(),
    setPassword: vi.fn(),
  },
  profileApi: {
    get: vi.fn(),
    save: vi.fn(),
    lookup: vi.fn(),
  },
}));

const mockedMe = vi.mocked(authApi.me);
const mockedSession = vi.mocked(authApi.session);
const mockedProfileGet = vi.mocked(profileApi.get);
const mockedProfileSave = vi.mocked(profileApi.save);

describe('useAccount nickname', () => {
  it('부팅 때 닉네임을 불러온다', async () => {
    mockedMe.mockResolvedValue({ uid: 'u1', email: 'e@x.y', cloud: true });
    mockedProfileGet.mockResolvedValue({ nickname: '햄찌' });
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.nickname).toBe('햄찌'));
  });

  it('저장 성공하면 상태가 바뀐다', async () => {
    mockedMe.mockResolvedValue({ uid: 'u1', email: 'e@x.y', cloud: true });
    mockedProfileGet.mockResolvedValue({ nickname: '햄찌' });
    mockedProfileSave.mockImplementation(async (n: string) => ({ ok: true, nickname: n }));
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.nickname).toBe('햄찌'));
    let r: { ok: boolean; msg?: string } = { ok: false };
    await act(async () => {
      r = await result.current.saveNickname('치즈볼');
    });
    expect(r.ok).toBe(true);
    expect(result.current.nickname).toBe('치즈볼');
  });

  it('저장 실패하면 상태가 그대로다', async () => {
    mockedMe.mockResolvedValue({ uid: 'u1', email: 'e@x.y', cloud: true });
    mockedProfileGet.mockResolvedValue({ nickname: '햄찌' });
    mockedProfileSave.mockResolvedValue({ ok: false, msg: '닉네임은 2~12자로 입력하세요.' });
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.nickname).toBe('햄찌'));
    let r: { ok: boolean; msg?: string } = { ok: true };
    await act(async () => {
      r = await result.current.saveNickname(' ');
    });
    expect(r).toEqual({ ok: false, msg: '닉네임은 2~12자로 입력하세요.' });
    expect(result.current.nickname).toBe('햄찌');
  });
});

describe('useAccount warmSession', () => {
  it('게스트는 익명 세션을 확보하고 상태를 읽는다', async () => {
    mockedMe.mockResolvedValue({ uid: null, email: null, cloud: true });
    mockedSession.mockResolvedValue({ uid: 'anon9' });
    mockedProfileGet.mockResolvedValue({ nickname: null });
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockedMe.mockResolvedValue({ uid: 'anon9', email: null, cloud: true });
    await act(async () => {
      await result.current.warmSession();
    });
    expect(mockedSession).toHaveBeenCalled();
    expect(result.current.uid).toBe('anon9');
  });

  it('로그인 사용자는 세션을 건드리지 않는다', async () => {
    mockedMe.mockResolvedValue({ uid: 'u1', email: 'e@x.y', cloud: true });
    mockedProfileGet.mockResolvedValue({ nickname: '햄찌' });
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.email).toBe('e@x.y'));
    mockedSession.mockClear();
    await act(async () => {
      await result.current.warmSession();
    });
    expect(mockedSession).not.toHaveBeenCalled();
    expect(result.current.uid).toBe('u1');
  });
});
