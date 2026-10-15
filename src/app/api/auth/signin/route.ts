import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, signInWithEmail } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db/prisma';

const Body = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '이메일과 비밀번호를 확인하세요.' }, { status: 400 });
  const result = await signInWithEmail(parsed.data.email, parsed.data.password);
  if (result.ok) {
    const { uid } = await getSessionUser();
    if (uid) await createPrismaDb().ensureUser(uid, parsed.data.email);
  } else {
    // 식별자(이메일·비밀번호)를 싣지 않고 실패 코드만 남긴다.
    Sentry.logger.warn('Auth signin failed', { code: result.code ?? 'unknown' });
  }
  return NextResponse.json(result, { status: result.ok ? 200 : 401 });
}
