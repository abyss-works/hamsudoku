import { NextResponse } from 'next/server';
import { z } from 'zod';
import { applyNewPassword } from '../../../../server/auth';
import { withServerTiming } from '../../../../server/serverTiming';

const Body = z.object({ password: z.string().min(6) });

async function handlePost(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '비밀번호를 확인하세요.' }, { status: 400 });
  const result = await applyNewPassword(parsed.data.password);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export const POST = withServerTiming(handlePost);
