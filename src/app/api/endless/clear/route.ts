import { after, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { clearRequestSchema } from '../../../../shared/endless';
import { rankedSeasonId } from '../../../../shared/season';
import { getSessionUser } from '../../../../server/auth';
import { submitEndlessClear } from '../../../../server/endlessPlay/play';

export async function POST(req: Request) {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const body = clearRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, msg: '요청이 올바르지 않아요.' }, { status: 400 });
  const nowIso = new Date().toISOString();
  const result = await submitEndlessClear(uid, body.data, nowIso, after);
  if (result.status === 401 || !result.body) {
    return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  }
  if (result.body.ok) {
    Sentry.logger.info('Endless stage cleared', {
      stage_id: body.data.stageId,
      season: rankedSeasonId(new Date(nowIso)),
      earned: result.body.earned,
      suspicious: result.body.suspicious,
    });
  } else {
    Sentry.logger.warn('Endless submission rejected', { stage_id: body.data.stageId, reason: result.body.reason });
  }
  return NextResponse.json(result.body);
}
