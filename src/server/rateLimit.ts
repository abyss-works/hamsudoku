import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

export type RateLimitPolicy = 'anonymous-session' | 'signin' | 'signup' | 'reset';

const MINUTE_MS = 60_000;

/** IP당 허용 횟수와 구간. 정상 사용에서는 닿지 않고 반복 시도만 막는 값이다. */
export const RATE_LIMIT_POLICIES: Record<RateLimitPolicy, { limit: number; windowMs: number }> = {
  'anonymous-session': { limit: 10, windowMs: 10 * MINUTE_MS },
  signin: { limit: 10, windowMs: MINUTE_MS },
  signup: { limit: 5, windowMs: 10 * MINUTE_MS },
  reset: { limit: 3, windowMs: 10 * MINUTE_MS },
};

const LONGEST_WINDOW_MS = Math.max(...Object.values(RATE_LIMIT_POLICIES).map((policy) => policy.windowMs));

export type RateLimitDecision = { success: boolean; reset: number };
export type RateLimiter = (policy: RateLimitPolicy, identifier: string) => Promise<RateLimitDecision>;

/**
 * 프로세스 메모리의 슬라이딩 윈도 제한기. 정책·식별자마다 허용된 요청 시각을 보관하고 구간이 지난 시각은 버린다.
 * 거절된 요청은 기록하지 않으므로 구간을 늘리지 않는다. reset은 구간 안 가장 오래된 요청이 빠지는 시각(ms)이다.
 * 상태가 프로세스 안에만 있으므로 복제본마다 따로 센다.
 */
export function createMemoryRateLimiter(now: () => number = () => Date.now()): RateLimiter & { size(): number } {
  const hits = new Map<string, number[]>();
  let lastSweepAt = 0;

  function sweep(at: number) {
    if (at - lastSweepAt < LONGEST_WINDOW_MS) return;
    lastSweepAt = at;
    for (const [key, times] of hits) {
      const windowMs = RATE_LIMIT_POLICIES[key.slice(0, key.indexOf(':')) as RateLimitPolicy].windowMs;
      if (times[times.length - 1] + windowMs <= at) hits.delete(key);
    }
  }

  const limiter: RateLimiter = async (policy, identifier) => {
    const at = now();
    sweep(at);
    const { limit, windowMs } = RATE_LIMIT_POLICIES[policy];
    const key = `${policy}:${identifier}`;
    const times = (hits.get(key) ?? []).filter((time) => time + windowMs > at);
    if (times.length >= limit) {
      hits.set(key, times);
      return { success: false, reset: times[0] + windowMs };
    }
    times.push(at);
    hits.set(key, times);
    return { success: true, reset: times[0] + windowMs };
  };
  return Object.assign(limiter, { size: () => hits.size });
}

const processLimiter = createMemoryRateLimiter();

/** 프로세스 전체에서 공유하는 제한기. 요청 사이에 횟수가 이어진다. */
export function rateLimiterFromEnv(): RateLimiter {
  return processLimiter;
}

/** 요청자 IP. ingress가 x-forwarded-for의 첫 값을 접속 주소로 채운다. */
export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/**
 * 정책 한도를 넘은 요청이면 429 응답을 돌려준다. 제한기가 없거나 확인이 실패하면 요청을 막지 않는다.
 */
export async function rejectIfRateLimited(
  limiter: RateLimiter | null,
  policy: RateLimitPolicy,
  req: Request,
  now: number = Date.now(),
): Promise<Response | null> {
  if (!limiter) return null;
  let decision: RateLimitDecision;
  try {
    decision = await limiter(policy, clientIp(req));
  } catch {
    Sentry.logger.warn('Rate limit check failed', { policy });
    return null;
  }
  if (decision.success) return null;
  const retryAfterSec = Math.max(1, Math.ceil((decision.reset - now) / 1000));
  return NextResponse.json(
    { ok: false, msg: '요청이 많아요. 잠시 후 다시 시도해 주세요.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  );
}
