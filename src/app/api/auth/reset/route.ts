import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requestPasswordReset } from '../../../../server/auth';
import { withServerTiming } from '../../../../server/serverTiming';

const Body = z.object({ email: z.string().email() });

async function handlePost(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '이메일을 확인하세요.' }, { status: 400 });
  const redirectTo = `${new URL(req.url).origin}/api/auth/callback`;
  const result = await requestPasswordReset(parsed.data.email, redirectTo);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export const POST = withServerTiming(handlePost);
