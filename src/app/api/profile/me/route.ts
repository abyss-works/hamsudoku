import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db';
import { fetchNickname } from '../../../../server/profile';

export async function GET() {
  const { uid, email } = await getSessionUser();
  const db = createPrismaDb();
  if (uid) await db.ensureUser(uid, email);
  const result = await fetchNickname(db, uid);
  if (result.status === 401) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  return NextResponse.json({ ok: true, nickname: result.nickname });
}
