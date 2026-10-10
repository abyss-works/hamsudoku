// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useProfileService } from './useProfileService';
import { profileApi } from './accountApi';

vi.mock('./accountApi', () => ({
  profileApi: {
    get: vi.fn(),
    save: vi.fn(),
    lookup: vi.fn(),
  },
}));

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

describe('useProfileService 단위 및 격리 계약', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loadProfile 호출 시 닉네임을 조회하고 반영한다', async () => {
    mockedProfileGet.mockResolvedValueOnce({ nickname: '테스트닉' });
    const { result } = renderHook(() => useProfileService());

    expect(result.current.nickname).toBeNull();

    await act(async () => {
      const nick = await result.current.loadProfile('u1');
      expect(nick).toBe('테스트닉');
    });

    expect(result.current.nickname).toBe('테스트닉');
  });

  it('loadProfile에 null을 전달하면 프로필 상태가 리셋된다', async () => {
    mockedProfileGet.mockResolvedValueOnce({ nickname: '테스트닉' });
    const { result } = renderHook(() => useProfileService());

    await act(async () => {
      await result.current.loadProfile('u1');
    });
    expect(result.current.nickname).toBe('테스트닉');

    await act(async () => {
      await result.current.loadProfile(null);
    });
    expect(result.current.nickname).toBeNull();
  });

  it('지연된 이전 uid의 조회 응답은 현재 uid의 프로필을 덮어쓰지 않는다', async () => {
    const u1Deferred = createDeferred<{ nickname: string | null }>();
    mockedProfileGet.mockReturnValueOnce(u1Deferred.promise);

    const { result } = renderHook(() => useProfileService());

    // u1 로드 시작 (지연)
    let p1: Promise<string | null>;
    act(() => {
      p1 = result.current.loadProfile('u1');
    });

    // 도중에 u2 로드 시작 및 완료
    mockedProfileGet.mockResolvedValueOnce({ nickname: 'User2Nick' });
    await act(async () => {
      await result.current.loadProfile('u2');
    });
    expect(result.current.nickname).toBe('User2Nick');

    // 이제 u1 지연 응답 도착
    await act(async () => {
      u1Deferred.resolve({ nickname: 'User1StaleNick' });
      await p1;
    });

    // u2의 닉네임이 그대로 보존되어야 함
    expect(result.current.nickname).toBe('User2Nick');
  });

  it('saveNickname 호출 시 성공하면 닉네임 상태를 갱신한다', async () => {
    mockedProfileSave.mockResolvedValueOnce({ ok: true, nickname: '새닉네임' });
    const { result } = renderHook(() => useProfileService('u1'));

    await act(async () => {
      const res = await result.current.saveNickname('새닉네임', 'u1');
      expect(res.ok).toBe(true);
    });

    expect(result.current.nickname).toBe('새닉네임');
  });

  it('saveNickname 진행 중 대상 uid가 바뀌면 새 계정 프로필에 반영하지 않는다', async () => {
    const saveDeferred = createDeferred<{ ok: true; nickname: string }>();
    mockedProfileSave.mockReturnValueOnce(saveDeferred.promise);

    const { result } = renderHook(() => useProfileService('u1'));

    let savePromise: Promise<unknown>;
    act(() => {
      savePromise = result.current.saveNickname('U1Nick', 'u1');
    });

    // 계정이 u2로 전환됨
    mockedProfileGet.mockResolvedValueOnce({ nickname: 'U2Nick' });
    await act(async () => {
      await result.current.loadProfile('u2');
    });
    expect(result.current.nickname).toBe('U2Nick');

    // 뒤늦게 U1의 저장 완료 도착
    await act(async () => {
      saveDeferred.resolve({ ok: true, nickname: 'U1Nick' });
      await savePromise;
    });

    // u2의 프로필이 U1의 닉네임으로 덮어씌워지지 않아야 함
    expect(result.current.nickname).toBe('U2Nick');
  });

  it('unmount 뒤 도착한 응답은 상태 갱신을 일으키지 않는다', async () => {
    const profileDeferred = createDeferred<{ nickname: string | null }>();
    mockedProfileGet.mockReturnValueOnce(profileDeferred.promise);

    const { result, unmount } = renderHook(() => useProfileService());

    let loadPromise: Promise<string | null>;
    act(() => {
      loadPromise = result.current.loadProfile('u1');
    });

    unmount();

    await act(async () => {
      profileDeferred.resolve({ nickname: 'LateNick' });
      await loadPromise;
    });

    expect(result.current.nickname).toBeNull();
  });
});
