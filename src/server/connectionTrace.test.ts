import { channel } from 'node:diagnostics_channel';
import { describe, expect, it } from 'vitest';
import { recordNewConnection, traceNewConnections, type AttributeTarget } from './connectionTrace';

function fakeSpan(): AttributeTarget & { attributes: Record<string, unknown> } {
  const attributes: Record<string, unknown> = {};
  return {
    attributes,
    setAttribute(key, value) {
      attributes[key] = value;
    },
  };
}

describe('recordNewConnection', () => {
  it('같은 span에서 맺은 새 연결 수와 대상 호스트를 누적한다', () => {
    const span = fakeSpan();

    recordNewConnection(span, 'redis.example');
    recordNewConnection(span, 'auth.example');
    recordNewConnection(span, 'redis.example');

    expect(span.attributes).toEqual({
      'http.new_connections': 3,
      'http.new_connection_hosts': ['redis.example', 'auth.example'],
    });
  });

  it('span마다 따로 센다', () => {
    const first = fakeSpan();
    const second = fakeSpan();

    recordNewConnection(first, 'redis.example');
    recordNewConnection(second, 'redis.example');

    expect(first.attributes['http.new_connections']).toBe(1);
    expect(second.attributes['http.new_connections']).toBe(1);
  });
});

describe('traceNewConnections', () => {
  it('undici 연결 수립 이벤트를 진행 중인 span에 기록하고, span이 없으면 무시한다', () => {
    const span = fakeSpan();
    let active: AttributeTarget | undefined = span;
    const stop = traceNewConnections(() => active);
    try {
      channel('undici:client:connected').publish({ connectParams: { host: 'redis.example' } });
      active = undefined;
      channel('undici:client:connected').publish({ connectParams: { host: 'auth.example' } });
    } finally {
      stop();
    }
    channel('undici:client:connected').publish({ connectParams: { host: 'after.example' } });

    expect(span.attributes).toEqual({
      'http.new_connections': 1,
      'http.new_connection_hosts': ['redis.example'],
    });
  });
});
