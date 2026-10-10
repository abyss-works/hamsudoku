// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { encryptSolution } from '../../server/crypto';
import { useEndlessSession } from './useEndlessSession';
import { resetSoundForTests } from '../../platform/audio/sound';
import { StrictMode, useEffect, useRef } from 'react';

vi.mock('howler', () => ({
  Howl: vi.fn(function () { return { play: vi.fn(() => 7), rate: vi.fn(), volume: vi.fn() }; }),
  Howler: { ctx: null },
}));

function stubFetch(clearResponse: () => Response | Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/endless/next') {
        const { clientPublicKey } = JSON.parse(String(init?.body)) as { clientPublicKey: string };
        const enc = await encryptSolution(clientPublicKey, '0,0;1,1');
        return Response.json({ stage: { id: 'e-1', size: 5, regions: '0'.repeat(25) }, ...enc, attemptKey: 'k1' });
      }
      if (url === '/api/endless/clear') return clearResponse();
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
});

describe('useEndlessSession', () => {
  it('StrictMode 생명주기 재실행 뒤 최초 판 응답을 유지한다', async () => {
    stubFetch(() => Response.json({ ok: true }));
    const { result } = renderHook(() => {
      const session = useEndlessSession();
      const started = useRef(false);
      useEffect(() => {
        if (started.current) return;
        started.current = true;
        void session.start();
      }, [session.start]);
      return session;
    }, { wrapper: StrictMode });
    await waitFor(() => expect(result.current.puzzle).not.toBeNull());
  });
  it('unmount은 대기 중 재시도를 정리하고 다음 제출을 실행하지 않는다', async () => {
    stubFetch(() => { throw new TypeError('network'); });
    const { result, unmount } = renderHook(() => useEndlessSession());
    await act(async () => { await result.current.start(); });
    vi.useFakeTimers();
    let finished: Promise<void>;
    await act(async () => {
      finished = result.current.finish();
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { await vi.runAllTimersAsync(); await finished!; });
    const clears = vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/endless/clear');
    expect(clears).toHaveLength(1);
  });
  it('시작하면 판이 열리고 씨앗 3으로 시작한다', async () => {
    stubFetch(() => Response.json({ ok: true }));
    const { result } = renderHook(() => useEndlessSession());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.phase).toBe('playing');
    expect(result.current.seeds).toBe(3);
    expect(result.current.puzzle?.size).toBe(5);
    expect(result.current.puzzle?.solution).toEqual([[0, 0], [1, 1]]);
  });

  it('오답 3번이면 게임오버되고 실패를 보고한다', async () => {
    stubFetch(() => Response.json({ ok: true }));
    const { result } = renderHook(() => useEndlessSession());
    await act(async () => {
      await result.current.start();
    });
    act(() => result.current.reportWrong());
    act(() => result.current.reportWrong());
    act(() => result.current.reportWrong());
    expect(result.current.seeds).toBe(0);
    expect(result.current.phase).toBe('gameover');
    await waitFor(() => {
      const calls = (fetch as unknown as { mock: { calls: [string][] } }).mock.calls.map((c) => c[0]);
      expect(calls).toContain('/api/endless/fail');
    });
  });

  it('클리어하면 미러가 낙관 반영되고 서버 응답으로 보정된다', async () => {
    stubFetch(() => Response.json({ ok: true, earned: 3, balance: 3, streak: 1, suspicious: false }));
    const { result } = renderHook(() => useEndlessSession());
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.finish();
    });
    await waitFor(() => {
      expect(result.current.phase).toBe('cleared');
      expect(result.current.mirror.wallet.balance).toBe(3);
      expect(result.current.mirror.streak).toEqual({ current: 1, best: 1 });
      expect(result.current.mirror.clearedIds).toEqual(['e-1']);
    });
    const saved = JSON.parse(localStorage.getItem('hamsudoku:endless:v1') ?? '{}') as { wallet?: { balance?: number } };
    expect(saved.wallet?.balance).toBe(3);
  });

  it('무효 응답이면 낙관 반영을 되돌린다', async () => {
    stubFetch(() => Response.json({ ok: false, reason: '정답이 맞지 않아요.' }));
    const { result } = renderHook(() => useEndlessSession());
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.finish();
    });
    expect(result.current.mirror.wallet.balance).toBe(0);
    expect(result.current.error).toBe('정답이 맞지 않아요.');
    expect(result.current.finishResult).toEqual({ ok: false, earned: 0 });
  });

  it('재시도 후에도 무효면 낙관 반영을 되돌린다', async () => {
    let first = true;
    stubFetch(() => {
      if (first) {
        first = false;
        throw new TypeError('network');
      }
      return Response.json({ ok: false, reason: '정답이 맞지 않아요.' });
    });
    const { result } = renderHook(() => useEndlessSession());
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.finish();
    });
    await waitFor(
      () => {
        expect(result.current.mirror.wallet.balance).toBe(0);
        expect(result.current.finishResult).toEqual({ ok: false, earned: 0 });
      },
      { timeout: 6000 },
    );
  });

  it('네트워크 오류는 3초 뒤 1회 재시도한다', async () => {
    let first = true;
    stubFetch(() => {
      if (first) {
        first = false;
        throw new TypeError('network');
      }
      return Response.json({ ok: true, earned: 3, balance: 3, streak: 1, suspicious: false });
    });
    const { result } = renderHook(() => useEndlessSession());
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await result.current.finish();
    });
    await waitFor(
      () => {
        expect(result.current.mirror.wallet.balance).toBe(3);
      },
      { timeout: 6000 },
    );
  });
});
