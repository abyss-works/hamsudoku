import { rankedSeasonId, seasonWindow } from '../../shared/season';
import { db, withTransaction } from '../db/client';
import { describeDbError } from '../db/errors';
import { findFinalizedSeason, isSeasonFinalized, listUnfinalizedLedgerSeasons, type FinalizedSeason } from './queries';
import { insertSeasonResultsFromLedger, lockSeasonForFinalization, saveSeasonFinalizationHeader } from './store';

/** 아직 끝나지 않은 시즌의 확정 요청. 응답에 사유를 그대로 전달해도 되는 도메인 오류다. */
export class SeasonNotEndedError extends Error {
  constructor(season: string, endAt: Date) {
    super(`Season ${season} has not ended yet (ends at ${endAt.toISOString()})`);
    this.name = 'SeasonNotEndedError';
  }
}

/**
 * 확정 실패 응답 문구. 끝나지 않은 시즌은 사유를 그대로 쓰고, 그 외 오류는 메시지에 쿼리 인자가 담길 수 있어
 * 코드와 대상 이름만 기록하고 일반 문구를 쓴다.
 */
export function finalizationFailureMessage(error: unknown): string {
  if (error instanceof SeasonNotEndedError) return error.message;
  console.error('Ranking finalization failed', describeDbError(error));
  return '시즌 확정에 실패했어요.';
}

/**
 * 시즌 확정을 멱등하게 실행한다. 시즌 배타 잠금 안에서 기존 확정 결과를 먼저 확인하고,
 * 끝난 시즌만 원장 합계로 전체 참여자의 순위를 DB 안에서 매겨 저장한다. 끝나지 않은 시즌은 SeasonNotEndedError를 던진다.
 */
export async function finalizeSeason(season: string, now: Date = new Date()): Promise<FinalizedSeason> {
  return withTransaction(async (tx) => {
    await lockSeasonForFinalization(tx, season);
    const existing = await findFinalizedSeason(tx, season);
    if (existing) return existing;

    const window = seasonWindow(season);
    if (now.getTime() < window.endAt.getTime()) throw new SeasonNotEndedError(season, window.endAt);

    const header = {
      season,
      startAt: window.startAt.toISOString(),
      endAt: window.endAt.toISOString(),
      finalizedAt: now.toISOString(),
      status: 'finalized',
    };
    await saveSeasonFinalizationHeader(tx, header);
    const results = await insertSeasonResultsFromLedger(tx, season, window);
    return { header, results };
  });
}

/** 원장에 적립이 있거나 현재 집계 대상인 시즌 중 끝났는데 확정되지 않은 시즌을 오름차순으로 확정한다. */
export async function recoverUnfinalizedSeasons(now: Date = new Date()): Promise<FinalizedSeason[]> {
  const candidates = new Set(await listUnfinalizedLedgerSeasons(db));
  const current = rankedSeasonId(now);
  if (!candidates.has(current) && !(await isSeasonFinalized(db, current))) candidates.add(current);

  const ended = [...candidates].filter((season) => now.getTime() >= seasonWindow(season).endAt.getTime()).sort();
  const results: FinalizedSeason[] = [];
  for (const season of ended) results.push(await finalizeSeason(season, now));
  return results;
}
