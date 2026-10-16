import { db, withTransaction } from '../db/client';
import { listStageStatsAggregates } from './queries';
import { sameStageStats, stageStatsTarget } from './rules';
import { lockStage, replaceStageStats } from './store';

export interface BackfillReport {
  ok: boolean;
  dryRun: boolean;
  totalStages: number;
  scannedStages: number;
  updatedStages: number;
  inconsistentStages: number;
  errors: string[];
}

/**
 * 진행 기록과 검증 이벤트로 판 통계를 복원한다. 쓰기 전에 모든 판의 일관성을 검사하고 하나라도 어긋나면 쓰지 않는다.
 * 적용 단계는 판마다 행을 잠그고 다시 집계해 목표 값과 다를 때만 갱신하며, 재집계가 어긋나면 그 뒤의 판은 쓰지 않는다.
 */
export async function backfillStageStats(options: { dryRun?: boolean } = {}): Promise<BackfillReport> {
  const dryRun = options.dryRun ?? true;
  const aggregates = await listStageStatsAggregates(db);
  const errors: string[] = [];
  const pending: string[] = [];

  for (const aggregate of aggregates) {
    const result = stageStatsTarget(aggregate);
    if (!result.ok) {
      errors.push(result.error);
      continue;
    }
    if (!sameStageStats(aggregate, result.target)) pending.push(aggregate.stageId);
  }

  const report = { dryRun, totalStages: aggregates.length, scannedStages: aggregates.length };
  if (errors.length > 0) {
    return { ok: false, ...report, updatedStages: 0, inconsistentStages: errors.length, errors };
  }
  if (dryRun) return { ok: true, ...report, updatedStages: pending.length, inconsistentStages: 0, errors };

  let updatedStages = 0;
  for (const stageId of pending) {
    const outcome = await withTransaction(async (tx) => {
      if (!(await lockStage(tx, stageId))) return { ok: false as const, error: `Stage ${stageId} not found` };
      const [aggregate] = await listStageStatsAggregates(tx, stageId);
      const result = stageStatsTarget(aggregate);
      if (!result.ok) return result;
      return { ok: true as const, updated: await replaceStageStats(tx, stageId, result.target) };
    });
    if (!outcome.ok) {
      errors.push(outcome.error);
      break;
    }
    if (outcome.updated) updatedStages += 1;
  }
  return { ok: errors.length === 0, ...report, updatedStages, inconsistentStages: 0, errors };
}
