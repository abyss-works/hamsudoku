import { rankedSeasonId, seasonWindow } from '../../shared/season';
import { db, withTransaction } from '../db/client';
import {
  aggregateSeasonLedger,
  findFinalizedSeason,
  listUnfinalizedLedgerSeasons,
  type FinalizedSeason,
} from './queries';
import { lockSeasonForFinalization, saveSeasonFinalization } from './store';

/**
 * 시즌 확정을 멱등하게 실행한다. 시즌 배타 잠금 안에서 기존 확정 결과를 먼저 확인하고,
 * 끝난 시즌만 원장을 집계해 전체 참여자의 순위를 저장한다. 끝나지 않은 시즌은 오류를 던진다.
 */
export async function finalizeSeason(season: string, now: Date = new Date()): Promise<FinalizedSeason> {
  return withTransaction(async (tx) => {
    await lockSeasonForFinalization(tx, season);
    const existing = await findFinalizedSeason(tx, season);
    if (existing) return existing;

    const window = seasonWindow(season);
    if (now.getTime() < window.endAt.getTime()) {
      throw new Error(`Season ${season} has not ended yet (ends at ${window.endAt.toISOString()})`);
    }

    const aggregated = await aggregateSeasonLedger(tx, season, window);
    const results = aggregated.map((entry, index) => ({ season, userId: entry.userId, score: entry.score, rank: index + 1 }));
    const header = {
      season,
      startAt: window.startAt.toISOString(),
      endAt: window.endAt.toISOString(),
      finalizedAt: now.toISOString(),
      status: 'finalized',
    };
    await saveSeasonFinalization(tx, header, results);
    return { header, results };
  });
}

/** 원장에 적립이 있거나 현재 집계 대상인 시즌 중 끝났는데 확정되지 않은 시즌을 오름차순으로 확정한다. */
export async function recoverUnfinalizedSeasons(now: Date = new Date()): Promise<FinalizedSeason[]> {
  const candidates = new Set(await listUnfinalizedLedgerSeasons(db));
  const current = rankedSeasonId(now);
  if (!candidates.has(current) && !(await findFinalizedSeason(db, current))) candidates.add(current);

  const ended = [...candidates].filter((season) => now.getTime() >= seasonWindow(season).endAt.getTime()).sort();
  const results: FinalizedSeason[] = [];
  for (const season of ended) results.push(await finalizeSeason(season, now));
  return results;
}
