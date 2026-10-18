import { describe, expect, it } from 'vitest';
import { apiTimingFrom, watchApiTimings } from './apiTiming';

const ORIGIN = 'https://hamsudoku.example';

describe('apiTimingFrom', () => {
  it('같은 출처 API 응답의 경로, 브라우저 기준 시간, 서버 처리 시간을 읽는다', () => {
    expect(
      apiTimingFrom(
        {
          name: `${ORIGIN}/api/endless/clear?x=1`,
          duration: 152.4,
          serverTiming: [
            { name: 'db', duration: 9, description: '2' },
            { name: 'total', duration: 83.2, description: '' },
          ],
        },
        ORIGIN,
      ),
    ).toEqual({ path: '/api/endless/clear', durationMs: 152, serverMs: 83 });
  });

  it('서버 처리 시간이 없으면 null로 두고, API가 아니거나 다른 출처면 무시한다', () => {
    expect(apiTimingFrom({ name: `${ORIGIN}/api/auth/me`, duration: 10, serverTiming: [] }, ORIGIN)).toEqual({
      path: '/api/auth/me',
      durationMs: 10,
      serverMs: null,
    });
    expect(apiTimingFrom({ name: `${ORIGIN}/sfx/good.wav`, duration: 10, serverTiming: [] }, ORIGIN)).toBeNull();
    expect(apiTimingFrom({ name: 'https://other.example/api/x', duration: 10, serverTiming: [] }, ORIGIN)).toBeNull();
  });
});

describe('watchApiTimings', () => {
  it('리소스 응답 중 API 응답의 시간만 전달하고 해제하면 관찰을 멈춘다', () => {
    let callback: ((list: { getEntries(): unknown[] }) => void) | null = null;
    let disconnected = false;
    class FakeObserver {
      constructor(cb: (list: { getEntries(): unknown[] }) => void) {
        callback = cb;
      }
      observe() {}
      disconnect() {
        disconnected = true;
      }
    }
    const seen: unknown[] = [];

    const stop = watchApiTimings((t) => seen.push(t), ORIGIN, FakeObserver as unknown as typeof PerformanceObserver);
    callback!({
      getEntries: () => [
        { name: `${ORIGIN}/api/records`, duration: 20, serverTiming: [{ name: 'total', duration: 5, description: '' }] },
        { name: `${ORIGIN}/logo.png`, duration: 30, serverTiming: [] },
      ],
    });
    stop();

    expect(seen).toEqual([{ path: '/api/records', durationMs: 20, serverMs: 5 }]);
    expect(disconnected).toBe(true);
  });
});
