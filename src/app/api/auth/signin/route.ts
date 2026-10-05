import { NextResponse } from 'next/server';
import { z } from 'zod';
import { signInWithEmail } from '../../../../server/auth';

const Body = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '이메일과 비밀번호를 확인하세요.' }, { status: 400 });
  const result = await signInWithEmail(parsed.data.email, parsed.data.password);
  return NextResponse.json(result, { status: result.ok ? 200 : 401 });
}
