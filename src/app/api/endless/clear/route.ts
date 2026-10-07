import { NextResponse } from 'next/server';
import { clearRequestSchema } from '../../../../shared/endless';
import { seasonId } from '../../../../shared/season';
import { getSessionUser } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db';
import { submitEndlessClear } from '../../../../server/endless';
import { rankStoreFromEnv } from '../../../../server/rank';

export async function POST(req: Request) {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const body = clearRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, msg: '요청이 올바르지 않아요.' }, { status: 400 });
  const nowIso = new Date().toISOString();
  const result = await submitEndlessClear(createPrismaDb(), uid, body.data, nowIso);
  if (result.status === 401 || !result.body) {
    return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  }
  if (result.body.ok) {
    const store = rankStoreFromEnv();
    if (store) {
      await store.increment(seasonId(new Date(nowIso)), uid, result.body.earned).catch(() => {});
    }
  }
  return NextResponse.json(result.body);
}
