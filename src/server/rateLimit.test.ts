import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clientIp,
  createMemoryRateLimiter,
  rateLimiterFromEnv,
  rejectIfRateLimited,
  RATE_LIMIT_POLICIES,
} from './rateLimit';

const warn = vi.hoisted(() => vi.fn());
vi.mock('@sentry/nextjs', () => ({ logger: { warn } }));

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

function request(headers: Record<string, string> = {}) {
  return new Request('https://example.com/api/auth/signin', { method: 'POST', headers });
}

beforeEach(() => {
  warn.mockClear();
});

describe('RATE_LIMIT_POLICIES', () => {
  it('정책별 한도와 구간을 유지한다', () => {
    expect(RATE_LIMIT_POLICIES).toEqual({
      'anonymous-session': { limit: 10, windowMs: 10 * MINUTE },
      signin: { limit: 10, windowMs: MINUTE },
      signup: { limit: 5, windowMs: 10 * MINUTE },
      reset: { limit: 3, windowMs: 10 * MINUTE },
    });
  });
});

describe('createMemoryRateLimiter', () => {
  it('구간 안에서 한도까지 허용하고 다음 요청부터 거절하며 가장 오래된 요청이 빠지는 시각을 reset으로 준다', async () => {
    let now = NOW;
    const limiter = createMemoryRateLimiter(() => now);

    for (let i = 0; i < 3; i++) {
      expect(await limiter('reset', '1.1.1.1')).toEqual({ success: true, reset: NOW + 10 * MINUTE });
      now += 1000;
    }

    expect(await limiter('reset', '1.1.1.1')).toEqual({ success: false, reset: NOW + 10 * MINUTE });
  });

  it('구간이 지나 가장 오래된 요청이 빠지면 다시 허용한다', async () => {
    let now = NOW;
    const limiter = createMemoryRateLimiter(() => now);
    await limiter('reset', 'ip');
    now += 1000;
    await limiter('reset', 'ip');
    now += 1000;
    await limiter('reset', 'ip');
    expect((await limiter('reset', 'ip')).success).toBe(false);

    now = NOW + 10 * MINUTE - 1;
    expect((await limiter('reset', 'ip')).success).toBe(false);
    now = NOW + 10 * MINUTE;
    expect((await limiter('reset', 'ip')).success).toBe(true);
    expect((await limiter('reset', 'ip')).success).toBe(false);
  });

  it('거절된 요청은 구간을 늘리지 않는다', async () => {
    let now = NOW;
    const limiter = createMemoryRateLimiter(() => now);
    for (let i = 0; i < 3; i++) await limiter('reset', 'ip');
    for (let i = 0; i < 5; i++) {
      now += 1000;
      expect((await limiter('reset', 'ip')).success).toBe(false);
    }

    now = NOW + 10 * MINUTE;
    expect((await limiter('reset', 'ip')).success).toBe(true);
  });

  it('정책과 식별자별로 따로 센다', async () => {
    const limiter = createMemoryRateLimiter(() => NOW);
    for (let i = 0; i < 3; i++) await limiter('reset', 'a');

    expect((await limiter('reset', 'a')).success).toBe(false);
    expect((await limiter('reset', 'b')).success).toBe(true);
    expect((await limiter('signup', 'a')).success).toBe(true);
  });

  it('정책 한도 수치대로 동작한다', async () => {
    const limiter = createMemoryRateLimiter(() => NOW);
    for (const [policy, { limit }] of Object.entries(RATE_LIMIT_POLICIES)) {
      for (let i = 0; i < limit; i++) {
        expect((await limiter(policy as keyof typeof RATE_LIMIT_POLICIES, 'x')).success).toBe(true);
      }
      expect((await limiter(policy as keyof typeof RATE_LIMIT_POLICIES, 'x')).success).toBe(false);
    }
  });

  it('구간이 모두 지난 식별자는 메모리에서 정리한다', async () => {
    let now = NOW;
    const limiter = createMemoryRateLimiter(() => now);
    await limiter('signin', 'a');
    await limiter('reset', 'b');
    expect(limiter.size()).toBe(2);

    now += 10 * MINUTE + 1;
    await limiter('signin', 'c');

    expect(limiter.size()).toBe(1);
  });
});

describe('rateLimiterFromEnv', () => {
  it('요청마다 같은 제한기를 돌려줘 요청 사이에 횟수가 이어진다', async () => {
    expect(rateLimiterFromEnv()).toBe(rateLimiterFromEnv());
    const limiter = rateLimiterFromEnv();
    for (let i = 0; i < 3; i++) await limiter('reset', 'shared-ip');
    expect((await rateLimiterFromEnv()('reset', 'shared-ip')).success).toBe(false);
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
      throw new Error('limiter failure');
    });

    expect(await rejectIfRateLimited(limiter, 'anonymous-session', request(), NOW)).toBeNull();
    expect(warn).toHaveBeenCalledWith('Rate limit check failed', { policy: 'anonymous-session' });
  });
});
