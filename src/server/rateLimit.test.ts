import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clientIp, createUpstashRequester, rateLimiterFromEnv, rejectIfRateLimited } from './rateLimit';

const serverFetch = vi.hoisted(() => vi.fn(async (_url: string, _init?: RequestInit) => Response.json({ result: 1 })));
vi.mock('./keepAliveFetch', () => ({ serverFetch }));

const warn = vi.hoisted(() => vi.fn());
vi.mock('@sentry/nextjs', () => ({ logger: { warn } }));

const NOW = 1_800_000_000_000;

function request(headers: Record<string, string> = {}) {
  return new Request('https://example.com/api/auth/signin', { method: 'POST', headers });
}

beforeEach(() => {
  serverFetch.mockClear();
  warn.mockClear();
});

describe('rateLimiterFromEnv', () => {
  it('Redis 설정이 없으면 null을 반환한다', () => {
    expect(rateLimiterFromEnv({})).toBeNull();
    expect(rateLimiterFromEnv({ UPSTASH_REDIS_REST_URL: 'https://r.upstash.io' })).toBeNull();
  });

  it('Redis 설정이 있으면 제한기를 만든다', () => {
    expect(
      rateLimiterFromEnv({ UPSTASH_REDIS_REST_URL: 'https://r.upstash.io', UPSTASH_REDIS_REST_TOKEN: 't' }),
    ).toBeTypeOf('function');
  });
});

describe('createUpstashRequester', () => {
  it('연결 유지 fetch로 명령을 보내고 응답을 그대로 돌려준다', async () => {
    serverFetch.mockResolvedValueOnce(Response.json({ result: 7 }));
    const requester = createUpstashRequester('https://r.upstash.io', 'tok');

    const res = await requester.request({ path: ['pipeline'], body: [['incr', 'k']] });

    expect(res).toEqual({ result: 7 });
    expect(serverFetch).toHaveBeenCalledWith('https://r.upstash.io/pipeline', {
      method: 'POST',
      headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
      body: JSON.stringify([['incr', 'k']]),
    });
  });

  it('경로가 없으면 기본 주소로 보낸다', async () => {
    await createUpstashRequester('https://r.upstash.io', 'tok').request({ body: ['get', 'k'] });

    expect(serverFetch.mock.calls[0]?.[0]).toBe('https://r.upstash.io');
  });

  it('Redis가 오류를 반환하면 예외를 던진다', async () => {
    serverFetch.mockResolvedValueOnce(Response.json({ error: 'ERR boom' }, { status: 400 }));

    await expect(createUpstashRequester('https://r.upstash.io', 'tok').request({ body: ['x'] })).rejects.toThrow(
      'ERR boom',
    );
  });
});

describe('clientIp', () => {
  it('x-forwarded-for의 첫 주소를 쓴다', () => {
    expect(clientIp(request({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('주소 헤더가 없으면 unknown을 쓴다', () => {
    expect(clientIp(request())).toBe('unknown');
  });
});

describe('rejectIfRateLimited', () => {
  it('제한기가 없으면 통과시킨다', async () => {
    expect(await rejectIfRateLimited(null, 'signin', request(), NOW)).toBeNull();
  });

  it('한도 안이면 통과시키고 정책과 IP로 확인한다', async () => {
    const limiter = vi.fn(async () => ({ success: true, reset: NOW + 1000 }));

    expect(await rejectIfRateLimited(limiter, 'signin', request({ 'x-forwarded-for': '1.2.3.4' }), NOW)).toBeNull();
    expect(limiter).toHaveBeenCalledWith('signin', '1.2.3.4');
  });

  it('한도를 넘으면 429와 재시도 시각을 반환한다', async () => {
    const limiter = vi.fn(async () => ({ success: false, reset: NOW + 12_300 }));

    const res = await rejectIfRateLimited(limiter, 'signup', request(), NOW);

    expect(res?.status).toBe(429);
    expect(res?.headers.get('retry-after')).toBe('13');
    expect(await res?.json()).toEqual({ ok: false, msg: '요청이 많아요. 잠시 후 다시 시도해 주세요.' });
  });

  it('재시도 시각이 지났으면 1초 뒤로 안내한다', async () => {
    const limiter = vi.fn(async () => ({ success: false, reset: NOW - 500 }));

    const res = await rejectIfRateLimited(limiter, 'reset', request(), NOW);

    expect(res?.headers.get('retry-after')).toBe('1');
  });

  it('확인이 실패하면 통과시키고 경고를 남긴다', async () => {
    const limiter = vi.fn(async () => {
      throw new Error('redis down');
    });

    expect(await rejectIfRateLimited(limiter, 'anonymous-session', request(), NOW)).toBeNull();
    expect(warn).toHaveBeenCalledWith('Rate limit check failed', { policy: 'anonymous-session' });
  });
});
