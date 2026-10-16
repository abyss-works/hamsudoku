import { NextResponse } from 'next/server';
import { myRankResponseSchema } from '../../../../shared/endless';
import { getSessionUser } from '../../../../server/auth';
import { fetchMySeasonRank } from '../../../../server/seasonRanking/standings';

// 내 순위 별도 조회. Redis 스냅샷을 거치지 않고 DB 원장 및 확정 결과에서
// 직접 읽는다. Redis 장애 여부와 무관하게 DB 실시간 값을 돌려준다.
export async function GET() {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  return NextResponse.json(myRankResponseSchema.parse(await fetchMySeasonRank(uid, new Date())));
}
