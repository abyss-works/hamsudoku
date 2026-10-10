// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppService } from './useAppService';
import { PUZZLES } from './puzzles';
import { SAVE_KEY } from './save';

const deps = vi.hoisted(() => ({
  account: { uid: 'a', email: 'a@example.com' as string | null, nickname: '이름', cloud: true, loading: false,
    signin: vi.fn(), signup: vi.fn(), signout: vi.fn(), warmSession: vi.fn(), reset: vi.fn(), setPassword: vi.fn(), saveNickname: vi.fn() },
  reconcile: vi.fn(), pull: vi.fn(), pushClear: vi.fn(), fetchAttemptKey: vi.fn(),
}));
vi.mock('./useAccount', () => ({ useAccount: () => deps.account }));
vi.mock('./useStages', () => ({ useStages: () => ({ chapters: [{ id: 'lv1', title: '레벨 1', stages: [
  { id: 's1', code: '1-1', title: '첫 판', locked: false, puzzle: PUZZLES[0] },
  { id: 's2', code: '1-2', title: '둘째 판', locked: false, puzzle: PUZZLES[0] },
] }], loading: false, error: null }) }));
vi.mock('./useEndlessSummary', () => ({ useEndlessSummary: () => ({ me: {}, error: null, refreshSoft: vi.fn() }) }));
vi.mock('../ui/useFontsReady', () => ({ useFontsReady: () => true }));
vi.mock('./sync', () => ({ reconcile: deps.reconcile, pull: deps.pull, pushClear: deps.pushClear, fetchAttemptKey: deps.fetchAttemptKey }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  deps.account.uid = 'a';
  deps.account.email = 'a@example.com';
  deps.reconcile.mockResolvedValue({ clears: [], unauthorized: false });
  deps.pull.mockResolvedValue({ clears: [], unauthorized: false });
  deps.pushClear.mockResolvedValue('ok');
  deps.fetchAttemptKey.mockResolvedValue('attempt');
  deps.account.signin.mockResolvedValue({ ok: true });
  deps.account.signout.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('앱 Service', () => {
  it('같은 판 재진입은 이전 입장 요청의 키를 사용하지 않는다', async () => {
    let complete!: (value: string) => void;
    deps.fetchAttemptKey.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    deps.fetchAttemptKey.mockReturnValueOnce(new Promise(() => {}));
    const { result } = renderHook(useAppService);
    act(() => result.current.enter(result.current.chapters[0].stages[0]));
    await act(async () => result.current.handleRecord('1-1', 10));
    act(() => result.current.enter(result.current.chapters[0].stages[0]));
    await act(async () => complete('previous-attempt'));
    await act(async () => result.current.handleRecord('1-1', 11));
    expect(deps.pushClear).toHaveBeenLastCalledWith('1-1', 11, undefined);
  });

  it('기록 제출 뒤 늦게 도착한 입장 키를 재시도 기록에 사용하지 않는다', async () => {
    let complete!: (value: string) => void;
    deps.fetchAttemptKey.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    const { result } = renderHook(useAppService);
    act(() => result.current.enter(result.current.chapters[0].stages[0]));
    await act(async () => result.current.handleRecord('1-1', 10));
    await act(async () => complete('late-attempt'));
    await act(async () => result.current.handleRecord('1-1', 11));
    expect(deps.pushClear).toHaveBeenLastCalledWith('1-1', 11, undefined);
  });

  it('unmount 뒤 기록 응답은 로그아웃을 실행하지 않는다', async () => {
    let complete!: (value: string) => void;
    deps.pushClear.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    const { result, unmount } = renderHook(useAppService);
    act(() => result.current.handleRecord('1-1', 10));
    unmount();
    await act(async () => complete('unauthorized'));
    expect(deps.account.signout).not.toHaveBeenCalled();
  });

  it('동일 계정 재로그인 뒤 이전 기록 응답은 새 세션을 로그아웃하지 않는다', async () => {
    let complete!: (value: string) => void;
    deps.pushClear.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    const { result, rerender } = renderHook(useAppService);
    act(() => result.current.handleRecord('1-1', 10));
    deps.account.uid = 'b';
    act(rerender);
    deps.account.uid = 'a';
    act(rerender);
    await act(async () => complete('unauthorized'));
    expect(deps.account.signout).not.toHaveBeenCalled();
  });

  it('StrictMode 생명주기 재실행 뒤에도 초기 기록 동기화를 완료한다', async () => {
    deps.reconcile.mockResolvedValue({ clears: [{ stageCode: '1-1', elapsedSec: 10, attempts: 1, clearedAt: '2026-10-10T00:00:00.000Z' }], unauthorized: false });
    const { result } = renderHook(useAppService, { wrapper: StrictMode });
    await waitFor(() => expect(result.current.clears.size).toBe(1));
  });
  it('스테이지 진입과 기록은 입장 키를 한 번 소비하고 다음 판으로 이동한다', async () => {
    const { result } = renderHook(useAppService);
    await act(async () => { result.current.enter(result.current.chapters[0].stages[0]); });
    expect(result.current.screen).toBe('game');
    expect(result.current.stage?.code).toBe('1-1');
    await act(async () => { result.current.handleRecord('1-1', 12); });
    expect(deps.pushClear).toHaveBeenCalledWith('1-1', 12, 'attempt');
    const stored = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    expect(stored.clears[0]).toMatchObject({ stageCode: '1-1', elapsedSec: 12 });
    await act(async () => { result.current.goNextMap(); });
    expect(result.current.stage?.code).toBe('1-2');
  });

  it('계정이 바뀌면 이전 계정의 늦은 동기화 결과를 버린다', async () => {
    let complete!: (value: unknown) => void;
    deps.reconcile.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
    const { result, rerender } = renderHook(useAppService);
    await waitFor(() => expect(deps.reconcile).toHaveBeenCalled());
    deps.account.uid = 'b';
    act(rerender);
    await act(async () => { complete({ clears: [{ stageCode: '1-1', elapsedSec: 10, attempts: 1, clearedAt: '2026-10-10T00:00:00.000Z' }], unauthorized: false }); });
    expect(result.current.clears.size).toBe(0);
  });

  it('로그인 데이터 유보 중에는 교체하지 않고 기준 확정 때 계정 기록을 읽는다', async () => {
    const { result, rerender } = renderHook(useAppService);
    await act(async () => { await result.current.signinThenSwitch('b@example.com', 'password', true); });
    deps.account.uid = 'b';
    act(rerender);
    expect(deps.pull).not.toHaveBeenCalled();
    await act(async () => { result.current.beginSwitch(); });
    expect(deps.pull).toHaveBeenCalledWith([]);
  });

  it('복구 링크의 오류를 읽고 홈 복귀 때 복구 파라미터를 제거한다', () => {
    window.history.replaceState({}, '', '/?recovery=error');
    const { result } = renderHook(useAppService);
    expect(result.current.screen).toBe('recovery');
    expect(result.current.linkError).toBe(true);
    act(() => result.current.goHome());
    expect(result.current.screen).toBe('home');
    expect(window.location.search).toBe('');
  });
});
