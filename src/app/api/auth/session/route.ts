import { after, NextResponse } from 'next/server';
import { rememberAccount } from '../../../../server/account/rememberAccount';
import { ensureSession, getSessionUser } from '../../../../server/auth';
import { rateLimiterFromEnv, rejectIfRateLimited } from '../../../../server/rateLimit';
import { withServerTiming } from '../../../../server/serverTiming';

async function handlePost(req: Request) {
  // 익명 사용자를 새로 만드는 요청만 제한한다. 기존 세션 확인은 Redis를 거치지 않는다.
  if (!(await getSessionUser()).uid) {
    const limited = await rejectIfRateLimited(rateLimiterFromEnv(), 'anonymous-session', req);
    if (limited) return limited;
  }
  const session = await ensureSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });
  rememberAccount({ uid: session.uid, email: session.email }, after);
  return NextResponse.json({ ok: true, uid: session.uid, email: session.email });
}

export const POST = withServerTiming(handlePost);
