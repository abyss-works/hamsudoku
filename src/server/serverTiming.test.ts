import { describe, expect, it } from 'vitest';
import { addTiming, classifySpan, formatServerTiming, spanHost, withServerTiming, type Timings } from './serverTiming';

describe('classifySpan', () => {
  it('DB span은 db, 외부 HTTP span은 호스트로 redis·supabase·http로 나누고 나머지는 제외한다', () => {
    expect(classifySpan({ op: 'db', host: undefined })).toBe('db');
    expect(classifySpan({ op: 'db.query', host: undefined })).toBe('db');
    expect(classifySpan({ op: 'http.client', host: 'apn1-example.upstash.io' })).toBe('redis');
    expect(classifySpan({ op: 'http.client', host: 'abcd.supabase.co' })).toBe('supabase');
    expect(classifySpan({ op: 'http.client', host: 'qstash.upstash.io' })).toBe('http');
    expect(classifySpan({ op: 'http.client', host: 'example.com' })).toBe('http');
    expect(classifySpan({ op: 'function', host: undefined })).toBeUndefined();
    expect(classifySpan({ op: undefined, host: undefined })).toBeUndefined();
  });
});

describe('spanHost', () => {
  it('server.address를 우선하고 없으면 URL 속성이나 설명의 URL에서 호스트를 읽는다', () => {
    expect(spanHost({ 'server.address': 'a.upstash.io', 'url.full': 'https://b.example/x' }, undefined)).toBe('a.upstash.io');
    expect(spanHost({ 'url.full': 'https://b.example/x' }, undefined)).toBe('b.example');
    expect(spanHost({ 'http.url': 'https://c.example/y' }, undefined)).toBe('c.example');
    expect(spanHost({}, 'POST https://d.example/z')).toBe('d.example');
    expect(spanHost({}, 'select 1')).toBeUndefined();
  });
});

describe('formatServerTiming', () => {
  it('구분별 합계 시간과 횟수, 전체 시간, 앱 버전을 Server-Timing 형식으로 만든다', () => {
    const timings: Timings = new Map();
    addTiming(timings, 'redis', 100.04);
    addTiming(timings, 'db', 5.26);
    addTiming(timings, 'db', 4);

    expect(formatServerTiming(timings, 130.55, '0.5.6')).toBe(
      'db;dur=9.3;desc="2", redis;dur=100;desc="1", total;dur=130.6, app;desc="0.5.6"',
    );
  });

  it('구분별 기록이 없으면 전체 시간과 앱 버전만 만든다', () => {
    expect(formatServerTiming(undefined, 12, '0.5.6')).toBe('total;dur=12, app;desc="0.5.6"');
  });
});

describe('withServerTiming', () => {
  it('응답 상태와 본문을 유지하고 Server-Timing 헤더를 붙인다', async () => {
    const timings: Timings = new Map();
    addTiming(timings, 'db', 3);
    const clock = [10, 25];
    const handler = withServerTiming(async (value: string) => Response.json({ value }, { status: 201 }), {
      version: '0.5.6',
      timings: () => timings,
      now: () => clock.shift() ?? 0,
    });

    const res = await handler('ok');

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ value: 'ok' });
    expect(res.headers.get('server-timing')).toBe('db;dur=3;desc="1", total;dur=15, app;desc="0.5.6"');
  });

  it('헤더를 바꿀 수 없는 응답은 그대로 반환한다', async () => {
    const redirect = Response.redirect('https://example.com/next', 302);
    const handler = withServerTiming(async () => redirect, { version: '0.5.6', timings: () => undefined, now: () => 0 });

    const res = await handler();

    expect(res).toBe(redirect);
    expect(res.headers.get('server-timing')).toBeNull();
  });
});
