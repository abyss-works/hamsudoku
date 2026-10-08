import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdmin } from '../../../../server/admin';
import { getSessionUser } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db';
import { rankStoreFromEnv } from '../../../../server/rank';
import { seasonId } from '../../../../shared/season';

const deleteBodySchema = z.object({
  userIds: z.array(z.string().min(1)).min(1).max(200),
});

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, msg: '권한이 없어요.' }, { status: 403 });
  const store = rankStoreFromEnv();
  if (!store) return NextResponse.json({ ok: false, msg: '랭킹 스토어 미설정.' }, { status: 503 });
  const season = seasonId(new Date());
  const snapshot = await store.topAll(season, 200);
  const db = createPrismaDb();
  const nicknames = await db.lookupNicknames(snapshot.entries.map((e) => e.userId));
  // 닉네임이 없는 엔트리 = 게스트. 관리 화면은 이걸 기본으로 보여준다.
  const entries = snapshot.entries.map((e) => ({
    userId: e.userId,
    nickname: nicknames[e.userId] ?? null,
    score: e.score,
  }));
  return NextResponse.json({ ok: true, season, entries });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, msg: '권한이 없어요.' }, { status: 403 });
  const store = rankStoreFromEnv();
  if (!store) return NextResponse.json({ ok: false, msg: '랭킹 스토어 미설정.' }, { status: 503 });
  const mine = (await getSessionUser()).uid;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, msg: '잘못된 요청.' }, { status: 400 });
  }
  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, msg: '잘못된 요청.' }, { status: 400 });
  const season = seasonId(new Date());
  let removed = 0;
  for (const uid of parsed.data.userIds) {
    if (uid === mine) continue;
    removed += await store.remove(season, uid);
  }
  return NextResponse.json({ ok: true, removed });
}
