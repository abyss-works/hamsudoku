import * as Sentry from '@sentry/nextjs';
import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { rememberAccount } from '../../../../server/account/rememberAccount';
import { getSessionUser, signUpWithEmail } from '../../../../server/auth';
import { rateLimiterFromEnv, rejectIfRateLimited } from '../../../../server/rateLimit';
import { withServerTiming } from '../../../../server/serverTiming';

const Body = z.object({ email: z.string().email(), password: z.string().min(6) });

async function handlePost(req: Request) {
  const limited = await rejectIfRateLimited(rateLimiterFromEnv(), 'signup', req);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '이메일과 비밀번호를 확인하세요.' }, { status: 400 });
  const result = await signUpWithEmail(parsed.data.email, parsed.data.password);
  if (result.ok) {
    const { uid } = await getSessionUser();
    if (uid) rememberAccount({ uid, email: parsed.data.email }, after);
    return NextResponse.json(result, { status: 200 });
  }
  // 식별자(이메일·비밀번호)를 싣지 않고 실패 코드만 남긴다.
  Sentry.logger.warn('Auth signup failed', { code: result.code ?? 'unknown' });
  // 중복 이메일은 요청 형식이 아니라 상태 충돌이므로 409를 내린다.
  if (result.code === 'email_exists' || result.code === 'user_already_exists') {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result, { status: 400 });
}

export const POST = withServerTiming(handlePost);
