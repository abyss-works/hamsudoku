import { NextResponse } from 'next/server';
import { myRankResponseSchema } from '../../../../shared/endless';
import { getSessionUser } from '../../../../server/auth';
import { fetchMySeasonRank } from '../../../../server/seasonRanking/standings';
import { withServerTiming } from '../../../../server/serverTiming';

// 내 순위 별도 조회. 표시 캐시를 거치지 않고 DB 원장 및 확정 결과에서
// 직접 읽어 DB 실시간 값을 돌려준다.
async function handleGet() {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  return NextResponse.json(myRankResponseSchema.parse(await fetchMySeasonRank(uid, new Date())));
}

export const GET = withServerTiming(handleGet);
