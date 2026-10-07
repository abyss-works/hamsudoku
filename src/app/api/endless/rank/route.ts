import { NextResponse } from 'next/server';
import { rankResponseSchema, type RankEntry } from '../../../../shared/endless';
import { seasonId } from '../../../../shared/season';
import { getSessionUser } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db';
import { rankStoreFromEnv } from '../../../../server/rank';

export async function GET() {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const season = seasonId(new Date());
  const store = rankStoreFromEnv();
  if (!store) {
    return NextResponse.json(
      rankResponseSchema.parse({ season, top: [], snapshotAt: new Date().toISOString(), me: { rank: null, score: 0 } }),
    );
  }
  const snapshot = await store.top(season, 50);
  const me = await store.rankOf(season, uid);
  const nicknames = await createPrismaDb().lookupNicknames(snapshot.entries.map((e) => e.userId));
  const top: RankEntry[] = snapshot.entries.map((e) => ({
    userId: e.userId,
    nickname: nicknames[e.userId] ?? null,
    score: e.score,
  }));
  return NextResponse.json(rankResponseSchema.parse({ season, top, snapshotAt: snapshot.at, me }));
}
