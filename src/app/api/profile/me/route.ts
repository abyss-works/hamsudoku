import { NextResponse } from 'next/server';
import { fetchNickname } from '../../../../server/account/nicknames';
import { getSessionUser } from '../../../../server/auth';

export async function GET() {
  const { uid } = await getSessionUser();
  const result = await fetchNickname(uid);
  if (result.status === 401) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  return NextResponse.json({ ok: true, nickname: result.nickname });
}
