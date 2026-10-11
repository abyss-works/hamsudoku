import { NextResponse } from 'next/server';
import { rankResponseSchema, type RankEntry } from '../../../../shared/endless';
import { rankedSeasonId, rankingFrozen, seasonWindow } from '../../../../shared/season';
import { getSessionUser } from '../../../../server/auth';
import { createPrismaDb } from '../../../../server/db';
import { rankStoreFromEnv } from '../../../../server/rank';
import { getFinalizedSeasonRank } from '../../../../server/seasonFinalization';

export async function GET() {
  const { uid } = await getSessionUser();
  if (!uid) return NextResponse.json({ ok: false, msg: '로그인이 필요해요.' }, { status: 401 });
  const now = new Date();
  const frozen = rankingFrozen(now);
  const season = rankedSeasonId(now);
  const db = createPrismaDb();

  // 1. 이미 확정된 시즌이면 DB의 확정 결과를 우선 반환한다.
  const finalized = await getFinalizedSeasonRank(db, season);
  if (finalized) {
    const top50 = finalized.results.slice(0, 50);
    const nicknames = await db.lookupNicknames(top50.map((r) => r.userId));
    const top: RankEntry[] = top50.map((r) => ({
      userId: r.userId,
      nickname: nicknames[r.userId] ?? null,
      score: r.score,
    }));
    const meRes = finalized.results.find((r) => r.userId === uid);
    const me = { rank: meRes?.rank ?? null, score: meRes?.score ?? 0 };
    return NextResponse.json(
      rankResponseSchema.parse({
        season,
        top,
        snapshotAt: finalized.header.finalizedAt,
        me,
        frozen,
      }),
    );
  }

  // 내 실시간 점수 및 순위는 DB에서 계산한다.
  const meData = await db.getUserSeasonRank(season, uid, seasonWindow(season));
  const me = { rank: meData.rank, score: meData.score };

  // 2. 마감 창이지만 아직 미확정 상태인 경우: 오래된 표시 캐시를 확정으로 보여주지 않는다.
  if (frozen) {
    return NextResponse.json(
      rankResponseSchema.parse({
        season,
        top: [],
        snapshotAt: now.toISOString(),
        me,
        frozen: true,
      }),
    );
  }

  // 3. 진행 중인 활성 시즌: Redis 60초 표시 캐시 사용
  const store = rankStoreFromEnv();
  if (!store) {
    return NextResponse.json(
      rankResponseSchema.parse({ season, top: [], snapshotAt: now.toISOString(), me, frozen: false }),
    );
  }

  let entries: { userId: string; score: number }[] = [];
  let snapshotAt = now.toISOString();
  try {
    const snapshot = await store.top(season, 50);
    entries = snapshot.entries;
    snapshotAt = snapshot.at;
  } catch {
    // Redis 오류 시 빈 목록으로 폴백하되 내 DB 점수는 보존한다.
  }

  const nicknames = await db.lookupNicknames(entries.map((e) => e.userId));
  const top: RankEntry[] = entries.map((e) => ({
    userId: e.userId,
    nickname: nicknames[e.userId] ?? null,
    score: e.score,
  }));
  return NextResponse.json(rankResponseSchema.parse({ season, top, snapshotAt, me, frozen: false }));
}

