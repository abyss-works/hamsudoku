// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Stage } from './stagesApi';
import type { ClearEntry } from '../../platform/storage/save';
import { useStageRecordsSync } from './useStageRecordsSync';

const syncMocks = vi.hoisted(() => ({
  fetchAttemptKey: vi.fn(),
  pushClear: vi.fn(),
  pull: vi.fn(),
  reconcile: vi.fn(),
}));

vi.mock('./sync', () => ({
  fetchAttemptKey: syncMocks.fetchAttemptKey,
  pushClear: syncMocks.pushClear,
  pull: syncMocks.pull,
  reconcile: syncMocks.reconcile,
}));

describe('스테이지 기록 동기화 (useStageRecordsSync)', () => {
  const dummyStage: Stage = {
    id: 's1',
    code: '1-1',
    title: '첫 판',
    locked: false,
    puzzle: { cells: [], givens: [] } as any,
  };

  let mockClears: Map<string, ClearEntry>;
  let mockRecord: any;
  let mockReplace: any;
  let mockMergeIn: any;
  let mockOnUnauthorized: any;
  let defaultAccount: { uid: string | null; email: string | null; cloud: boolean; loading: boolean };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClears = new Map();
    mockRecord = vi.fn((code: string, elapsedSec: number) => {
      mockClears.set(code, { stageCode: code, elapsedSec, attempts: 1, clearedAt: new Date().toISOString() });
    });
    mockReplace = vi.fn((entries: ClearEntry[]) => {
      mockClears.clear();
      for (const e of entries) mockClears.set(e.stageCode, e);
    });
    mockMergeIn = vi.fn((entries: ClearEntry[]) => {
      for (const e of entries) mockClears.set(e.stageCode, e);
    });
    mockOnUnauthorized = vi.fn();
    defaultAccount = {
      uid: 'user-a',
      email: 'a@example.com',
      cloud: true,
      loading: false,
    };
    syncMocks.fetchAttemptKey.mockResolvedValue('attempt-key-1');
    syncMocks.pushClear.mockResolvedValue('ok');
    syncMocks.pull.mockResolvedValue({ clears: [], unauthorized: false });
    syncMocks.reconcile.mockResolvedValue({ clears: [], unauthorized: false });
  });

  afterEach(cleanup);

  it('스테이지 진입 후 기록 제출 시 attemptKey를 소비하고 pushClear를 호출한다', async () => {
    const { result } = renderHook(() =>
      useStageRecordsSync({
        account: defaultAccount,
        save: { clears: mockClears, record: mockRecord, replace: mockReplace, mergeIn: mockMergeIn },
        onUnauthorized: mockOnUnauthorized,
      })
    );

    act(() => result.current.prepareAttempt(dummyStage));
    await act(async () => {});

    await act(async () => {
      result.current.recordClear('1-1', 15, dummyStage);
    });

    expect(mockRecord).toHaveBeenCalledWith('1-1', 15);
    expect(syncMocks.pushClear).toHaveBeenCalledWith('1-1', 15, 'attempt-key-1');

    // 한 번 소비된 키는 재사용되지 않는다
    await act(async () => {
      result.current.recordClear('1-1', 16, dummyStage);
    });
    expect(syncMocks.pushClear).toHaveBeenLastCalledWith('1-1', 16, undefined);
  });

  it('같은 판 재진입은 이전 입장 요청의 키를 사용하지 않는다', async () => {
    let completeFirst!: (value: string) => void;
    syncMocks.fetchAttemptKey.mockReturnValueOnce(new Promise((resolve) => { completeFirst = resolve; }));
    syncMocks.fetchAttemptKey.mockReturnValueOnce(new Promise(() => {}));

    const { result } = renderHook(() =>
      useStageRecordsSync({
        account: defaultAccount,
        save: { clears: mockClears, record: mockRecord, replace: mockReplace, mergeIn: mockMergeIn },
        onUnauthorized: mockOnUnauthorized,
      })
    );

    act(() => result.current.prepareAttempt(dummyStage));
    await act(async () => { result.current.recordClear('1-1', 10, dummyStage); });

    act(() => result.current.prepareAttempt(dummyStage));
    await act(async () => completeFirst('previous-attempt'));
    await act(async () => { result.current.recordClear('1-1', 11, dummyStage); });

    expect(syncMocks.pushClear).toHaveBeenLastCalledWith('1-1', 11, undefined);
  });

  it('기록 제출 뒤 늦게 도착한 입장 키를 재시도 기록에 사용하지 않는다', async () => {
    let completeLate!: (value: string) => void;
    syncMocks.fetchAttemptKey.mockReturnValueOnce(new Promise((resolve) => { completeLate = resolve; }));

    const { result } = renderHook(() =>
      useStageRecordsSync({
        account: defaultAccount,
        save: { clears: mockClears, record: mockRecord, replace: mockReplace, mergeIn: mockMergeIn },
        onUnauthorized: mockOnUnauthorized,
      })
    );

    act(() => result.current.prepareAttempt(dummyStage));
    await act(async () => { result.current.recordClear('1-1', 10, dummyStage); });
    await act(async () => completeLate('late-attempt'));
    await act(async () => { result.current.recordClear('1-1', 11, dummyStage); });

    expect(syncMocks.pushClear).toHaveBeenLastCalledWith('1-1', 11, undefined);
  });

  it('unmount 뒤 기록 응답은 unauthorized 콜백을 실행하지 않는다', async () => {
    let completePush!: (value: string) => void;
    syncMocks.pushClear.mockReturnValueOnce(new Promise((resolve) => { completePush = resolve; }));

    const { result, unmount } = renderHook(() =>
      useStageRecordsSync({
        account: defaultAccount,
        save: { clears: mockClears, record: mockRecord, replace: mockReplace, mergeIn: mockMergeIn },
        onUnauthorized: mockOnUnauthorized,
      })
    );

    act(() => { result.current.recordClear('1-1', 10, dummyStage); });
    unmount();
    await act(async () => completePush('unauthorized'));

    expect(mockOnUnauthorized).not.toHaveBeenCalled();
  });

  it('동일 계정 재로그인 뒤 이전 기록 응답은 새 세션에 unauthorized를 실행하지 않는다', async () => {
    let completePush!: (value: string) => void;
    syncMocks.pushClear.mockReturnValueOnce(new Promise((resolve) => { completePush = resolve; }));

    let account = { ...defaultAccount };
    const { result, rerender } = renderHook(() =>
      useStageRecordsSync({
        account,
        save: { clears: mockClears, record: mockRecord, replace: mockReplace, mergeIn: mockMergeIn },
        onUnauthorized: mockOnUnauthorized,
      })
    );

    act(() => { result.current.recordClear('1-1', 10, dummyStage); });
    account = { ...defaultAccount, uid: 'user-b' };
    rerender();
    account = { ...defaultAccount, uid: 'user-a' };
    rerender();
    await act(async () => completePush('unauthorized'));

    expect(mockOnUnauthorized).not.toHaveBeenCalled();
  });

  it('StrictMode 생명주기 재실행 뒤에도 초기 기록 동기화를 완료한다', async () => {
    syncMocks.reconcile.mockResolvedValue({
      clears: [{ stageCode: '1-1', elapsedSec: 10, attempts: 1, clearedAt: '2026-10-10T00:00:00.000Z' }],
      unauthorized: false,
    });

    renderHook(
      () =>
        useStageRecordsSync({
          account: defaultAccount,
          save: { clears: mockClears, record: mockRecord, replace: mockReplace, mergeIn: mockMergeIn },
          onUnauthorized: mockOnUnauthorized,
        }),
      { wrapper: StrictMode }
    );

    await waitFor(() => expect(mockMergeIn).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ stageCode: '1-1' })])
    ));
  });

  it('계정이 바뀌면 이전 계정의 늦은 동기화 결과를 버린다', async () => {
    let completeReconcile!: (value: unknown) => void;
    syncMocks.reconcile.mockReturnValueOnce(new Promise((resolve) => { completeReconcile = resolve; }));

    let account = { ...defaultAccount };
    const { rerender } = renderHook(() =>
      useStageRecordsSync({
        account,
        save: { clears: mockClears, record: mockRecord, replace: mockReplace, mergeIn: mockMergeIn },
        onUnauthorized: mockOnUnauthorized,
      })
    );

    await waitFor(() => expect(syncMocks.reconcile).toHaveBeenCalled());
    account = { ...defaultAccount, uid: 'user-b' };
    rerender();

    await act(async () => {
      completeReconcile({
        clears: [{ stageCode: '1-1', elapsedSec: 10, attempts: 1, clearedAt: '2026-10-10T00:00:00.000Z' }],
        unauthorized: false,
      });
    });

    expect(mockMergeIn).not.toHaveBeenCalled();
  });

  it('로그인 데이터 유보(hold) 중에는 pull을 실행하지 않고 beginSwitch 때 pull([])을 실행한다', async () => {
    let account = { ...defaultAccount };
    const { result, rerender } = renderHook(() =>
      useStageRecordsSync({
        account,
        save: { clears: mockClears, record: mockRecord, replace: mockReplace, mergeIn: mockMergeIn },
        onUnauthorized: mockOnUnauthorized,
      })
    );

    act(() => result.current.markSwitched(true));
    account = { ...defaultAccount, uid: 'user-b' };
    rerender();

    expect(syncMocks.pull).not.toHaveBeenCalled();

    await act(async () => {
      result.current.beginSwitch();
    });

    expect(syncMocks.pull).toHaveBeenCalledWith([]);
  });

  it('cancelSwitch 호출 시 유보 플래그를 해제하고 세대를 증가시켜 비동기 응답을 무시한다', async () => {
    let completePull!: (value: unknown) => void;
    syncMocks.pull.mockReturnValueOnce(new Promise((resolve) => { completePull = resolve; }));

    let account = { ...defaultAccount };
    const { result, rerender } = renderHook(() =>
      useStageRecordsSync({
        account,
        save: { clears: mockClears, record: mockRecord, replace: mockReplace, mergeIn: mockMergeIn },
        onUnauthorized: mockOnUnauthorized,
      })
    );

    act(() => result.current.markSwitched(false));
    account = { ...defaultAccount, uid: 'user-b' };
    rerender();

    act(() => result.current.cancelSwitch());

    await act(async () => {
      completePull({
        clears: [{ stageCode: '1-1', elapsedSec: 10, attempts: 1, clearedAt: '2026-10-10T00:00:00.000Z' }],
        unauthorized: false,
      });
    });

    expect(mockReplace).not.toHaveBeenCalled();
  });
});
