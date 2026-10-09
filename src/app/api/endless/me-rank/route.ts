import { NextResponse } from 'next/server';
import { myRankResponseSchema } from '../../../../shared/endless';
import { rankedSeasonId } from '../../../../shared/season';
import { getSessionUser } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db';
import { rankStoreFromEnv } from '../../../../server/rank';

// 내 순위 별도 조회. 상위 목록 스냅샷을 거치지 않고 순위표 원본에서
// 실시간으로 읽는다. 프론트는 이 값으로 내 행을 병합해 그린다.
export async function GET() {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const season = rankedSeasonId(new Date());
  const store = rankStoreFromEnv();
  if (!store) {
    return NextResponse.json(myRankResponseSchema.parse({ rank: null, score: 0, nickname: null }));
  }
  const me = await store.rankOf(season, uid);
  const nicknames = await createPrismaDb().lookupNicknames([uid]);
  return NextResponse.json(myRankResponseSchema.parse({ ...me, nickname: nicknames[uid] ?? null }));
}
