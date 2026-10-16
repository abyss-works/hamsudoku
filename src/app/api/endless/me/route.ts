import { NextResponse } from 'next/server';
import { meResponseSchema } from '../../../../shared/endless';
import { seasonId } from '../../../../shared/season';
import { getSessionUser } from '../../../../server/auth';
import { fetchEndlessSummary } from '../../../../server/endlessPlay/play';

export async function GET() {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const summary = await fetchEndlessSummary(uid);
  return NextResponse.json(
    meResponseSchema.parse({
      wallet: { balance: summary.balance },
      clearedCount: summary.clearedCount,
      streak: summary.streak,
      season: seasonId(new Date()),
    }),
  );
}
