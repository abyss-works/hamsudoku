// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAccount } from './useAccount';
import { useProfileService } from './useProfileService';
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
const mockedSignin = vi.mocked(authApi.signin);
const mockedSignout = vi.mocked(authApi.signout);
const mockedProfileGet = vi.mocked(profileApi.get);
const mockedProfileSave = vi.mocked(profileApi.save);

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useAccount 계정 전환 격리 및 생명주기 (accountLifecycle)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('지연된 이전 계정의 Profile 조회 응답이 전환된 새 계정의 프로필을 덮어쓰지 않는다', async () => {
    // 1. User1 부팅: auth.me는 즉시 반환, profile.get은 지연
    const user1ProfileDeferred = createDeferred<{ nickname: string | null }>();
    mockedMe.mockResolvedValueOnce({ uid: 'user-1', email: 'u1@test.com', cloud: true });
    mockedProfileGet.mockReturnValueOnce(user1ProfileDeferred.promise);

    const { result } = renderHook(() => useAccount());

    // auth 상태가 반영되고 초기 loading이 완료될 때까지 대기
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.uid).toBe('user-1');
    expect(result.current.nickname).toBeNull();

    // 2. User1 프로필이 도착하기 전에 User2로 로그인 전환
    mockedSignin.mockResolvedValueOnce({ ok: true });
    mockedMe.mockResolvedValueOnce({ uid: 'user-2', email: 'u2@test.com', cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: 'User2Nick' });

    await act(async () => {
      const signinRes = await result.current.signin('u2@test.com', 'password');
      expect(signinRes.ok).toBe(true);
    });

    expect(result.current.uid).toBe('user-2');
    expect(result.current.nickname).toBe('User2Nick');

    // 3. 이제 뒤늦게 User1의 프로필 응답이 도착
    await act(async () => {
      user1ProfileDeferred.resolve({ nickname: 'User1StaleNick' });
      await user1ProfileDeferred.promise;
    });

    // 격리 검증: User2의 프로필이 User1의 이전 응답('User1StaleNick')으로 오염되지 않아야 함!
    expect(result.current.uid).toBe('user-2');
    expect(result.current.nickname).toBe('User2Nick');
  });

  it('지연된 이전 계정의 닉네임 저장 완료 응답이 계정 전환 후 새 계정에 반영되지 않는다', async () => {
    // 1. User1 로그인 상태로 시작
    mockedMe.mockResolvedValueOnce({ uid: 'user-1', email: 'u1@test.com', cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: 'User1Initial' });

    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.nickname).toBe('User1Initial'));

    // 2. User1이 닉네임 저장을 요청했으나 서버 응답이 지연됨
    const saveDeferred = createDeferred<{ ok: true; nickname: string }>();
    mockedProfileSave.mockReturnValueOnce(saveDeferred.promise);

    let savePromise: Promise<unknown>;
    act(() => {
      savePromise = result.current.saveNickname('User1NewNick');
    });

    // 3. 저장 응답이 오기 전에 계정이 로그아웃 및 게스트로 전환
    mockedSignout.mockResolvedValueOnce(undefined);
    mockedSession.mockResolvedValueOnce({ uid: 'guest-anon' });
    mockedMe.mockResolvedValueOnce({ uid: 'guest-anon', email: null, cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: null });

    await act(async () => {
      await result.current.signout();
    });

    expect(result.current.uid).toBe('guest-anon');
    expect(result.current.nickname).toBeNull();

    // 4. 뒤늦게 이전 User1의 닉네임 저장 응답이 도착
    await act(async () => {
      saveDeferred.resolve({ ok: true, nickname: 'User1NewNick' });
      await savePromise;
    });

    // 격리 검증: guest의 프로필이 이전 User1의 'User1NewNick'으로 오염되지 않아야 함!
    expect(result.current.uid).toBe('guest-anon');
    expect(result.current.nickname).toBeNull();
  });

  it('컴포넌트 unmount 뒤 완료된 프로필 응답은 상태 갱신을 일으키지 않는다', async () => {
    const profileDeferred = createDeferred<{ nickname: string | null }>();
    mockedMe.mockResolvedValueOnce({ uid: 'user-1', email: 'u1@test.com', cloud: true });
    mockedProfileGet.mockReturnValueOnce(profileDeferred.promise);

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result, unmount } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // unmount 실행
    unmount();

    // 뒤늦게 프로필 응답 도착
    await act(async () => {
      profileDeferred.resolve({ nickname: 'LateNick' });
      await profileDeferred.promise;
    });

    // unmount 이후 상태 갱신 경고나 오류가 없어야 함
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('게스트 시점의 warmSession 함수를 보관한 뒤 signin 완료 후 실행해도 게스트 복원을 실행하지 않는다', async () => {
    mockedMe
      .mockResolvedValueOnce({ uid: null, email: null, cloud: true })
      .mockResolvedValueOnce({ uid: 'guest-init', email: null, cloud: true });
    mockedSession.mockResolvedValueOnce({ uid: 'guest-init' });
    mockedProfileGet.mockResolvedValueOnce({ nickname: null });

    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.uid).toBe('guest-init');
    expect(result.current.email).toBeNull();

    // 게스트 시점의 warmSession 함수 참조를 보관
    const staleWarmSession = result.current.warmSession;

    // User1으로 로그인
    mockedSignin.mockResolvedValueOnce({ ok: true });
    mockedMe.mockResolvedValueOnce({ uid: 'user-1', email: 'user1@test.com', cloud: true });
    mockedProfileGet.mockResolvedValueOnce({ nickname: 'User1Nick' });

    await act(async () => {
      const res = await result.current.signin('user1@test.com', 'pwd');
      expect(res.ok).toBe(true);
    });

    expect(result.current.uid).toBe('user-1');
    expect(result.current.email).toBe('user1@test.com');
    expect(result.current.nickname).toBe('User1Nick');

    // 로그인 완료 후, 이전 게스트 시점에 캡처된 staleWarmSession 실행
    mockedSession.mockClear();
    await act(async () => {
      await staleWarmSession();
    });

    // 로그인된 사용자의 세션을 파괴하거나 guest로 복원해서는 안 됨
    expect(mockedSession).not.toHaveBeenCalled();
    expect(result.current.uid).toBe('user-1');
    expect(result.current.email).toBe('user1@test.com');
    expect(result.current.nickname).toBe('User1Nick');
  });

  it('React StrictMode 환경에서도 계정과 프로필이 정상적으로 부팅된다', async () => {
    mockedMe.mockResolvedValue({ uid: 'user-strict', email: 'strict@test.com', cloud: true });
    mockedProfileGet.mockResolvedValue({ nickname: 'StrictModeNick' });

    const { result } = renderHook(() => useAccount(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <React.StrictMode>{children}</React.StrictMode>
      ),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.nickname).toBe('StrictModeNick'));
    expect(result.current.uid).toBe('user-strict');
    expect(result.current.email).toBe('strict@test.com');
  });

  it('StrictMode 또는 remount 환경에서 이전 마운트 세션의 지연 응답은 재마운트 후에도 반영되지 않는다', async () => {
    const setup1Deferred = createDeferred<{ nickname: string | null }>();
    mockedProfileGet.mockReturnValueOnce(setup1Deferred.promise);

    let activeService!: ReturnType<typeof useProfileService>;
    const { unmount } = renderHook(() => {
      const profile = useProfileService();
      activeService = profile;
      return profile;
    });

    // 1. 첫 번째 마운트 세션에서 loadProfile 시작
    let loadPromise1: Promise<string | null>;
    act(() => {
      loadPromise1 = activeService.loadProfile('u1');
    });

    // 2. StrictMode 시뮬레이션: cleanup(unmount) 실행
    unmount();

    // 3. 재마운트: 두 번째 마운트 세션 시작 (isMounted가 다시 true가 됨)
    mockedProfileGet.mockResolvedValueOnce({ nickname: 'FreshSessionNick' });
    const { result: session2 } = renderHook(() => useProfileService());
    await act(async () => {
      await session2.current.loadProfile('u2');
    });
    expect(session2.current.nickname).toBe('FreshSessionNick');

    // 4. 이제 첫 번째 마운트 세션의 지연된 응답 도착
    await act(async () => {
      setup1Deferred.resolve({ nickname: 'StaleSession1Nick' });
      await loadPromise1;
    });

    // 5. 검증: 이전 세션의 응답은 첫 번째 세션(unmounted)에 무시되고,
    // 새 세션(session2)의 닉네임('FreshSessionNick')도 오염되지 않는다
    expect(activeService.nickname).toBeNull();
    expect(session2.current.nickname).toBe('FreshSessionNick');
  });
});
