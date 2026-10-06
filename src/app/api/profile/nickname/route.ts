import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db';
import { saveNickname } from '../../../../server/profile';

const Body = z.object({ nickname: z.string() });

export async function POST(req: Request) {
  const { uid, email } = await getSessionUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '요청을 확인하세요.' }, { status: 400 });
  const db = createPrismaDb();
  if (uid) await db.ensureUser(uid, email);
  const result = await saveNickname(db, uid, parsed.data.nickname);
  if (result.status === 401) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  if (result.status === 400) return NextResponse.json({ ok: false, msg: result.msg ?? '요청을 확인하세요.' }, { status: 400 });
  return NextResponse.json({ ok: true, nickname: result.nickname });
}
