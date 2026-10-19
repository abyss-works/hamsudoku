import * as Sentry from '@sentry/nextjs';
import { Ratelimit, type Duration } from '@upstash/ratelimit';
import { Redis, type Requester } from '@upstash/redis';
import { NextResponse } from 'next/server';
import { serverFetch } from './keepAliveFetch';

export type RateLimitPolicy = 'anonymous-session' | 'signin' | 'signup' | 'reset';

/** IP당 허용 횟수와 구간. 정상 사용에서는 닿지 않고 반복 시도만 막는 값이다. */
export const RATE_LIMIT_POLICIES: Record<RateLimitPolicy, { limit: number; window: Duration }> = {
  'anonymous-session': { limit: 10, window: '10 m' },
  signin: { limit: 10, window: '1 m' },
  signup: { limit: 5, window: '10 m' },
  reset: { limit: 3, window: '10 m' },
};

/** 확인이 이 시간 안에 끝나지 않으면 라이브러리가 요청을 통과시킨다. */
const CHECK_TIMEOUT_MS = 1000;

export type RateLimitDecision = { success: boolean; reset: number };
export type RateLimiter = (policy: RateLimitPolicy, identifier: string) => Promise<RateLimitDecision>;

/** Upstash REST 명령을 연결 유지 fetch로 보내는 Redis 요청기. 라이브러리 기본 요청기는 전역 fetch를 쓴다. */
export function createUpstashRequester(url: string, token: string): Requester {
  return {
    async request<TResult>(req: { path?: string[]; body?: unknown }) {
      const res = await serverFetch([url, ...(req.path ?? [])].join('/'), {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(req.body),
      });
      const data = (await res.json()) as { result?: TResult; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `rate limit store ${res.status}`);
      return data;
    },
  };
}

export function rateLimiterFromEnv(env: Record<string, string | undefined> = process.env): RateLimiter | null {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const redis = new Redis(createUpstashRequester(url, token));
  const limiters = Object.fromEntries(
    Object.entries(RATE_LIMIT_POLICIES).map(([policy, { limit, window }]) => [
      policy,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, window),
        prefix: `ratelimit:${policy}`,
        timeout: CHECK_TIMEOUT_MS,
        analytics: false,
      }),
    ]),
  ) as Record<RateLimitPolicy, Ratelimit>;
  return (policy, identifier) => limiters[policy].limit(identifier);
}

/** 요청자 IP. 배포 플랫폼이 x-forwarded-for의 첫 값을 접속 주소로 채운다. */
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
