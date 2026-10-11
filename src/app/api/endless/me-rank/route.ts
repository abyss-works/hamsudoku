import { NextResponse } from 'next/server';
import { myRankResponseSchema } from '../../../../shared/endless';
import { rankedSeasonId, seasonWindow } from '../../../../shared/season';
import { getSessionUser } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db';
import { getFinalizedSeasonRank } from '../../../../server/seasonFinalization';

// 내 순위 별도 조회. Redis 스냅샷을 거치지 않고 DB 원장 및 확정 결과에서
// 직접 읽는다. Redis 장애 여부와 무관하게 DB 실시간 값을 돌려준다.
export async function GET() {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const now = new Date();
  const season = rankedSeasonId(now);
  const db = createPrismaDb();

  const finalized = await getFinalizedSeasonRank(db, season);
  let me: { rank: number | null; score: number };
  if (finalized) {
    const res = finalized.results.find((r) => r.userId === uid);
    me = { rank: res?.rank ?? null, score: res?.score ?? 0 };
  } else {
    me = await db.getUserSeasonRank(season, uid, seasonWindow(season));
  }

  const nicknames = await db.lookupNicknames([uid]);
  return NextResponse.json(myRankResponseSchema.parse({ ...me, nickname: nicknames[uid] ?? null }));
}

