import { describe, expect, it } from 'vitest';
import { appVersionFrom, watchServerVersion } from './serverVersion';

describe('appVersionFrom', () => {
  it('Server-Timing의 app 항목 설명을 서버 앱 버전으로 읽고 없으면 null이다', () => {
    expect(appVersionFrom([{ name: 'db', description: '2' }, { name: 'app', description: '0.6.1' }])).toBe('0.6.1');
    expect(appVersionFrom([{ name: 'total', description: '' }])).toBeNull();
    expect(appVersionFrom([{ name: 'app', description: '' }])).toBeNull();
  });
});

describe('watchServerVersion', () => {
  it('리소스 응답의 서버 앱 버전을 전달하고 해제하면 관찰을 멈춘다', () => {
    let callback: ((list: { getEntries(): unknown[] }) => void) | null = null;
    let observed: unknown = null;
    let disconnected = false;
    class FakeObserver {
      constructor(cb: (list: { getEntries(): unknown[] }) => void) {
        callback = cb;
      }
      observe(options: unknown) {
        observed = options;
      }
      disconnect() {
        disconnected = true;
      }
    }
    const versions: string[] = [];

    const stop = watchServerVersion((v) => versions.push(v), FakeObserver as unknown as typeof PerformanceObserver);
    callback!({
      getEntries: () => [
        { serverTiming: [{ name: 'app', description: '0.6.1' }] },
        { serverTiming: [] },
        {},
      ],
    });
    stop();

    expect(observed).toEqual({ type: 'resource', buffered: true });
    expect(versions).toEqual(['0.6.1']);
    expect(disconnected).toBe(true);
  });

  it('관찰 기능이 없는 환경에서는 아무것도 하지 않는다', () => {
    const stop = watchServerVersion(() => {}, undefined);
    expect(() => stop()).not.toThrow();
  });
});
