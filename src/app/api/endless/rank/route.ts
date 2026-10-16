import { after, NextResponse } from 'next/server';
import { rankResponseSchema } from '../../../../shared/endless';
import { getSessionUser } from '../../../../server/auth';
import { fetchSeasonRank } from '../../../../server/seasonRanking/standings';

export async function GET() {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const view = await fetchSeasonRank(uid, new Date(), after);
  return NextResponse.json(rankResponseSchema.parse(view));
}
