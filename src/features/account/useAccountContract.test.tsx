// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAccount } from './useAccount';
import { authApi, profileApi } from './accountApi';

vi.mock('./accountApi', () => ({
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
const mockedSignup = vi.mocked(authApi.signup);
const mockedSignin = vi.mocked(authApi.signin);
const mockedSignout = vi.mocked(authApi.signout);
const mockedReset = vi.mocked(authApi.reset);
const mockedSetPassword = vi.mocked(authApi.setPassword);
const mockedProfileGet = vi.mocked(profileApi.get);
const mockedProfileSave = vi.mocked(profileApi.save);

describe('useAccount 공개 계약 및 동작 검증 (useAccountContract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('공개 인터페이스의 모든 필드와 메서드가 올바르게 제공된다', async () => {
    mockedMe.mockResolvedValueOnce({ uid: 'u1', email: 'u1@test.com', cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: '테스터' });

    const { result } = renderHook(() => useAccount());

    // 초기 loading 중
    expect(result.current).toHaveProperty('uid');
    expect(result.current).toHaveProperty('email');
    expect(result.current).toHaveProperty('nickname');
    expect(result.current).toHaveProperty('cloud');
    expect(result.current).toHaveProperty('loading');
    expect(typeof result.current.signup).toBe('function');
    expect(typeof result.current.signin).toBe('function');
    expect(typeof result.current.signout).toBe('function');
    expect(typeof result.current.warmSession).toBe('function');
    expect(typeof result.current.reset).toBe('function');
    expect(typeof result.current.setPassword).toBe('function');
    expect(typeof result.current.saveNickname).toBe('function');

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.nickname).toBe('테스터'));
    expect(result.current.uid).toBe('u1');
    expect(result.current.email).toBe('u1@test.com');
    expect(result.current.cloud).toBe(true);
  });

  it('signin 성공 시 인증 갱신 및 프로필 조회가 완료될 때까지 대기하고 결과를 반환한다', async () => {
    mockedMe.mockResolvedValueOnce({ uid: 'u-init', email: null, cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: null });

    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedSignin.mockResolvedValueOnce({ ok: true });
    mockedMe.mockResolvedValueOnce({ uid: 'u-signed', email: 'signed@test.com', cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: '로그인유저' });

    let signinRes: { ok: boolean };
    await act(async () => {
      signinRes = await result.current.signin('signed@test.com', 'pwd');
    });

    expect(signinRes!.ok).toBe(true);
    expect(result.current.uid).toBe('u-signed');
    expect(result.current.email).toBe('signed@test.com');
    expect(result.current.nickname).toBe('로그인유저');
  });

  it('signup 성공 시 인증 갱신 및 프로필 조회가 완료될 때까지 대기한다', async () => {
    mockedMe.mockResolvedValueOnce({ uid: null, email: null, cloud: true });
    mockedSession.mockResolvedValueOnce({ uid: 'guest-1' });
    mockedMe.mockResolvedValueOnce({ uid: 'guest-1', email: null, cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: null });

    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedSignup.mockResolvedValueOnce({ ok: true });
    mockedMe.mockResolvedValueOnce({ uid: 'u-new', email: 'new@test.com', cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: '신규유저' });

    let signupRes: { ok: boolean };
    await act(async () => {
      signupRes = await result.current.signup('new@test.com', 'pwd');
    });

    expect(signupRes!.ok).toBe(true);
    expect(result.current.uid).toBe('u-new');
    expect(result.current.email).toBe('new@test.com');
    expect(result.current.nickname).toBe('신규유저');
  });

  it('signout 호출 시 authApi.signout 후 익명 세션을 복구한다', async () => {
    mockedMe.mockResolvedValueOnce({ uid: 'u-logged', email: 'log@test.com', cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: '로깅유저' });

    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.email).toBe('log@test.com'));

    mockedSignout.mockResolvedValueOnce(undefined);
    mockedSession.mockResolvedValueOnce({ uid: 'guest-restored' });
    mockedMe.mockResolvedValueOnce({ uid: 'guest-restored', email: null, cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: null });

    await act(async () => {
      await result.current.signout();
    });

    expect(mockedSignout).toHaveBeenCalled();
    expect(mockedSession).toHaveBeenCalled();
    expect(result.current.uid).toBe('guest-restored');
    expect(result.current.email).toBeNull();
    expect(result.current.nickname).toBeNull();
  });

  it('reset 및 setPassword는 authApi로 위임된다', async () => {
    mockedMe.mockResolvedValueOnce({ uid: 'u1', email: 'u1@test.com', cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: null });

    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedReset.mockResolvedValueOnce({ ok: true });
    let resetRes: unknown;
    await act(async () => {
      resetRes = await result.current.reset('u1@test.com');
    });
    expect(mockedReset).toHaveBeenCalledWith('u1@test.com');
    expect(resetRes).toEqual({ ok: true });

    mockedSetPassword.mockResolvedValueOnce({ ok: true });
    let pwRes: unknown;
    await act(async () => {
      pwRes = await result.current.setPassword('newpass');
    });
    expect(mockedSetPassword).toHaveBeenCalledWith('newpass');
    expect(pwRes).toEqual({ ok: true });
  });

  it('saveNickname 호출 시 profileApi.save로 위임하고 성공 시 닉네임을 갱신한다', async () => {
    mockedMe.mockResolvedValueOnce({ uid: 'u1', email: 'u1@test.com', cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: '이전닉' });

    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.nickname).toBe('이전닉'));

    mockedProfileSave.mockResolvedValueOnce({ ok: true, nickname: '신규닉' });
    let saveRes: unknown;
    await act(async () => {
      saveRes = await result.current.saveNickname('신규닉');
    });

    expect(mockedProfileSave).toHaveBeenCalledWith('신규닉');
    expect(saveRes).toEqual({ ok: true, nickname: '신규닉' });
    expect(result.current.nickname).toBe('신규닉');
  });
});
