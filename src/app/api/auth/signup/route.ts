import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser, signUpWithEmail } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db';

const Body = z.object({ email: z.string().email(), password: z.string().min(6) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '이메일과 비밀번호를 확인하세요.' }, { status: 400 });
  const result = await signUpWithEmail(parsed.data.email, parsed.data.password);
  if (result.ok) {
    const { uid } = await getSessionUser();
    if (uid) await createPrismaDb().ensureUser(uid, parsed.data.email);
    return NextResponse.json(result, { status: 200 });
  }
  // 중복 이메일은 요청 형식이 아니라 상태 충돌이므로 409를 내린다.
  if (result.code === 'email_exists' || result.code === 'user_already_exists') {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result, { status: 400 });
}
