import { seasonWindow } from '../shared/season';
import type { DbPort, SeasonFinalizationRow, SeasonRankResultRow } from './db';

export interface FinalizedSeasonResult {
  header: SeasonFinalizationRow;
  results: SeasonRankResultRow[];
}

/**
 * 시즌 확정을 멱등하게 실행하고 직렬화 경계를 적용한다.
 * 1. 이미 확정된 시즌이면 DB의 기존 확정 결과를 즉시 반환한다.
 * 2. 확정 대상 시각이 시즌 종료 시각 이전이면 아직 확정할 수 없다.
 * 3. 동일 시즌의 직렬화 잠금 안에서 미확정 원장 획득량을 집계한다.
 * 4. 동점은 점수 내림차순, userId 내림차순으로 정렬하여 1-based 순위를 매긴다.
 * 5. 전체 참여자 결과를 하나의 DB 트랜잭션으로 저장하고 완료한다.
 */
export async function finalizeSeason(
  db: DbPort,
  season: string,
  now: Date = new Date(),
): Promise<FinalizedSeasonResult> {
  return db.runWithSeasonLock(season, async (txDb) => {
    const targetDb = txDb ?? db;
    const existing = await targetDb.getSeasonFinalization(season);
    if (existing) {
      return existing;
    }

    const window = seasonWindow(season);
    if (now.getTime() < window.endAt.getTime()) {
      throw new Error(`Season ${season} has not ended yet (ends at ${window.endAt.toISOString()})`);
    }

    const aggregated = await targetDb.aggregateSeasonLedger(season, window);
    const results: SeasonRankResultRow[] = aggregated.map((entry, index) => ({
      season,
      userId: entry.userId,
      score: entry.score,
      rank: index + 1,
    }));

    const header: SeasonFinalizationRow = {
      season,
      startAt: window.startAt.toISOString(),
      endAt: window.endAt.toISOString(),
      finalizedAt: now.toISOString(),
      status: 'finalized',
    };

    await targetDb.saveSeasonFinalization(header, results);

    return { header, results };
  });
}

export async function getFinalizedSeasonRank(
  db: DbPort,
  season: string,
): Promise<FinalizedSeasonResult | null> {
  return db.getSeasonFinalization(season);
}

export async function getFinalizedSeasonTop(
  db: DbPort,
  season: string,
  limit: number = 50,
): Promise<FinalizedSeasonResult | null> {
  return db.getFinalizedSeasonTop(season, limit);
}

export async function getFinalizedUserRank(
  db: DbPort,
  season: string,
  userId: string,
): Promise<{ rank: number | null; score: number } | null> {
  return db.getFinalizedUserRank(season, userId);
}

export async function isSeasonFinalized(db: DbPort, season: string): Promise<boolean> {
  return db.isSeasonFinalized(season);
}

export async function listUnfinalizedSeasons(db: DbPort, now: Date = new Date()): Promise<string[]> {
  return db.listUnfinalizedSeasons(now);
}

export async function recoverUnfinalizedSeasons(
  db: DbPort,
  now: Date = new Date(),
): Promise<FinalizedSeasonResult[]> {
  const seasons = await db.listUnfinalizedSeasons(now);
  const results: FinalizedSeasonResult[] = [];
  for (const s of seasons) {
    const res = await finalizeSeason(db, s, now);
    results.push(res);
  }
  return results;
}

