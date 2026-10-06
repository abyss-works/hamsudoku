import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db';
import { lookupNicknames } from '../../../../server/profile';

const Body = z.object({ userIds: z.array(z.string()).max(100) });

export async function POST(req: Request) {
  const { uid } = await getSessionUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '요청을 확인하세요.' }, { status: 400 });
  const db = createPrismaDb();
  const result = await lookupNicknames(db, uid, parsed.data.userIds);
  if (result.status === 401) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  return NextResponse.json({ ok: true, nicknames: result.nicknames });
}
