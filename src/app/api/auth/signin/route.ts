import * as Sentry from '@sentry/nextjs';
import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { rememberAccount } from '../../../../server/account/rememberAccount';
import { getSessionUser, signInWithEmail } from '../../../../server/auth';
import { rateLimiterFromEnv, rejectIfRateLimited } from '../../../../server/rateLimit';
import { withServerTiming } from '../../../../server/serverTiming';

const Body = z.object({ email: z.string().email(), password: z.string().min(6) });

async function handlePost(req: Request) {
  const limited = await rejectIfRateLimited(rateLimiterFromEnv(), 'signin', req);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '이메일과 비밀번호를 확인하세요.' }, { status: 400 });
  const result = await signInWithEmail(parsed.data.email, parsed.data.password);
  if (result.ok) {
    const { uid } = await getSessionUser();
    if (uid) rememberAccount({ uid, email: parsed.data.email }, after);
  } else {
    // 식별자(이메일·비밀번호)를 싣지 않고 실패 코드만 남긴다.
    Sentry.logger.warn('Auth signin failed', { code: result.code ?? 'unknown' });
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 401 });
}

export const POST = withServerTiming(handlePost);
