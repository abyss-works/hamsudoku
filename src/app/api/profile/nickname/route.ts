import { NextResponse } from 'next/server';
import { z } from 'zod';
import { changeNickname } from '../../../../server/account/nicknames';
import { getSessionUser } from '../../../../server/auth';
import { withServerTiming } from '../../../../server/serverTiming';

const Body = z.object({ nickname: z.string() });

async function handlePost(req: Request) {
  const { uid } = await getSessionUser();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '요청을 확인하세요.' }, { status: 400 });
  const result = await changeNickname(uid, parsed.data.nickname, new Date().toISOString());
  if (result.status === 401) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  if (result.status === 400) return NextResponse.json({ ok: false, msg: result.msg ?? '요청을 확인하세요.' }, { status: 400 });
  return NextResponse.json({ ok: true, nickname: result.nickname });
}

export const POST = withServerTiming(handlePost);
