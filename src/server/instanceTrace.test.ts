import { describe, expect, it } from 'vitest';
import { createInstanceTracker, recordInitDuration } from './instanceTrace';

function fakeSpan() {
  const attributes: Record<string, unknown> = {};
  return { attributes, setAttribute: (key: string, value: unknown) => void (attributes[key] = value) };
}

describe('createInstanceTracker', () => {
  it('인스턴스의 첫 요청만 콜드로 표시하고 요청 순번과 인스턴스 경과 시간을 남긴다', () => {
    const clock = [120.4, 5000];
    const tracker = createInstanceTracker(() => clock.shift() ?? 0, { bootMs: 80.2, initMs: 30.6 });
    const first = fakeSpan();
    const second = fakeSpan();

    tracker.onRootSpanStart(first);
    tracker.onRootSpanStart(second);

    expect(first.attributes).toEqual({
      'instance.cold': true,
      'instance.request_index': 1,
      'instance.uptime_ms': 120,
      'instance.boot_ms': 80,
      'instance.init_ms': 31,
    });
    expect(second.attributes).toEqual({ 'instance.cold': false, 'instance.request_index': 2, 'instance.uptime_ms': 5000 });
  });

  it('초기화 시간을 모르면 첫 요청에도 콜드 표시와 순번·경과 시간만 남긴다', () => {
    const tracker = createInstanceTracker(() => 10, undefined);
    const span = fakeSpan();

    tracker.onRootSpanStart(span);

    expect(span.attributes).toEqual({ 'instance.cold': true, 'instance.request_index': 1, 'instance.uptime_ms': 10 });
  });
});

describe('recordInitDuration', () => {
  it('초기화 전후 시각으로 부팅 시점과 초기화 소요 시간을 만든다', () => {
    expect(recordInitDuration(80, 110.5)).toEqual({ bootMs: 80, initMs: 30.5 });
  });
});
