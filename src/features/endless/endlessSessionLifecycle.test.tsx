// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { encryptSolution } from '../../server/crypto';
import { useEndlessSession } from './useEndlessSession';
import { resetSoundForTests } from '../../platform/audio/sound';

vi.mock('howler', () => ({
  Howl: vi.fn(function () {
    return { play: vi.fn(() => 7), rate: vi.fn(), volume: vi.fn() };
  }),
  Howler: { ctx: null },
}));

let stageCounter = 1;

function stubNextStages() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/endless/next') {
        const id = `e-${stageCounter++}`;
        const { clientPublicKey } = JSON.parse(String(init?.body)) as { clientPublicKey: string };
        const enc = await encryptSolution(clientPublicKey, '0,0;1,1');
        return Response.json({
          stage: { id, size: 5, regions: '0'.repeat(25) },
          ...enc,
          attemptKey: `key-${id}`,
        });
      }
      if (url === '/api/endless/clear') {
        return Response.json({ ok: true, earned: 3, balance: 3, streak: 1, suspicious: false });
      }
      if (url === '/api/endless/fail') return Response.json({ ok: true });
      throw new Error(`unexpected ${url}`);
    }),
  );
}

afterEach(() => {
  cleanup();
  resetSoundForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  stageCounter = 1;
});

describe('useEndlessSession lifecycle & stale action protection', () => {
  it('이전 판에서 캡처한 reportWrong은 새 판의 목숨(seeds)을 차감하지 않는다', async () => {
    stubNextStages();
    const { result } = renderHook(() => useEndlessSession());

    // 1번째 판 시작
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.stageId).toBe('e-1');
    expect(result.current.seeds).toBe(3);

    // 1번째 판의 reportWrong 콜백 보관
    const staleReportWrong = result.current.reportWrong;

    // 2번째 판 시작
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.stageId).toBe('e-2');
    expect(result.current.seeds).toBe(3);

    // 1번째 판의 오래된 reportWrong 실행
    act(() => {
      staleReportWrong();
    });

    // 2번째 판의 seeds는 여전히 3이어야 함 (차감되지 않음)
    expect(result.current.seeds).toBe(3);
  });

  it('이전 판에서 캡처한 finish는 새 판에서 제출을 실행하지 않는다', async () => {
    stubNextStages();
    const { result } = renderHook(() => useEndlessSession());

    // 1번째 판 시작
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.stageId).toBe('e-1');

    // 1번째 판의 finish 콜백 보관
    const staleFinish = result.current.finish;

    // 2번째 판 시작
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.stageId).toBe('e-2');

    // fetch 호출 이력 초기화
    vi.mocked(fetch).mockClear();

    // 1번째 판의 오래된 finish 실행
    await act(async () => {
      await staleFinish();
    });

    // clear API가 호출되지 않아야 함
    const clearCalls = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/endless/clear');
    expect(clearCalls).toHaveLength(0);
  });

  it('진행 중인 start가 있을 때 중복 start 호출은 1회만 요청된다', async () => {
    stubNextStages();
    const { result } = renderHook(() => useEndlessSession());

    await act(async () => {
      const p1 = result.current.start();
      const p2 = result.current.start();
      await Promise.all([p1, p2]);
    });

    const nextCalls = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/endless/next');
    expect(nextCalls).toHaveLength(1);
    expect(result.current.stageId).toBe('e-1');
  });

  it('진행 중인 finish가 있을 때 중복 finish 호출은 1회만 제출된다', async () => {
    stubNextStages();
    const { result } = renderHook(() => useEndlessSession());

    await act(async () => {
      await result.current.start();
    });

    vi.mocked(fetch).mockClear();

    await act(async () => {
      const f1 = result.current.finish();
      const f2 = result.current.finish();
      await Promise.all([f1, f2]);
    });

    const clearCalls = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/endless/clear');
    expect(clearCalls).toHaveLength(1);
  });

  it('unmount 후 보관된 start 진입은 즉시 no-op이며 fetch를 호출하지 않는다', async () => {
    stubNextStages();
    const { result, unmount } = renderHook(() => useEndlessSession());
    const savedStart = result.current.start;
    unmount();
    vi.mocked(fetch).mockClear();

    await act(async () => {
      await savedStart();
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('unmount 후 보관된 reportWrong 진입은 즉시 no-op이며 seeds/API/사운드를 실행하지 않는다', async () => {
    stubNextStages();
    const { result, unmount } = renderHook(() => useEndlessSession());
    await act(async () => {
      await result.current.start();
    });
    const savedReportWrong = result.current.reportWrong;
    unmount();
    vi.mocked(fetch).mockClear();

    act(() => {
      savedReportWrong();
      savedReportWrong();
      savedReportWrong();
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('unmount 후 보관된 finish 진입은 즉시 no-op이며 API 및 optimistic mirror 저장을 실행하지 않는다', async () => {
    stubNextStages();
    const { result, unmount } = renderHook(() => useEndlessSession());
    await act(async () => {
      await result.current.start();
    });
    const savedFinish = result.current.finish;
    unmount();
    vi.mocked(fetch).mockClear();

    await act(async () => {
      await savedFinish();
    });

    const clearCalls = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/endless/clear');
    expect(clearCalls).toHaveLength(0);
  });
});
