import { NextResponse } from 'next/server';
import { failRequestSchema } from '../../../../shared/endless';
import { getSessionUser } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db';
import { submitEndlessFail } from '../../../../server/endless';

export async function POST(req: Request) {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const body = failRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, msg: '요청이 올바르지 않아요.' }, { status: 400 });
  const result = await submitEndlessFail(createPrismaDb(), uid, body.data, new Date().toISOString());
  if (result.status === 200) return NextResponse.json({ ok: true });
  if (result.status === 401) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  return NextResponse.json({ ok: false, msg: '입장 키가 유효하지 않아요.' }, { status: 403 });
}
