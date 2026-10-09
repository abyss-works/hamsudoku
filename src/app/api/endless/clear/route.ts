import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { clearRequestSchema } from '../../../../shared/endless';
import { rankedSeasonId, rankingFrozen } from '../../../../shared/season';
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
    const now = new Date(nowIso);
    const frozen = rankingFrozen(now);
    const season = rankedSeasonId(now);
    Sentry.logger.info('Endless stage cleared', {
      stage_id: body.data.stageId,
      season,
      earned: result.body.earned,
      suspicious: result.body.suspicious,
    });
    const store = rankStoreFromEnv();
    // 마감 창에는 지갑 적립(위 submitEndlessClear)만 두고 랭킹 적립은 멈춘다.
    if (store && !frozen) {
      await store.increment(season, uid, result.body.earned).catch(() => {});
    }
  } else {
    Sentry.logger.warn('Endless submission rejected', { stage_id: body.data.stageId, reason: result.body.reason });
  }
  return NextResponse.json(result.body);
}
