import type { DbPort } from '../src/server/db';

export interface BackfillOptions {
  dryRun?: boolean;
}

export interface BackfillReport {
  ok: boolean;
  dryRun: boolean;
  totalStages: number;
  scannedStages: number;
  updatedStages: number;
  inconsistentStages: number;
  errors: string[];
}

export async function backfillEndlessStats(
  db: DbPort,
  options: BackfillOptions = { dryRun: true },
): Promise<BackfillReport> {
  const isDryRun = options.dryRun ?? true;
  const stages = await db.listAllStages();
  let updatedStages = 0;
  let inconsistentStages = 0;
  const errors: string[] = [];

  for (const stage of stages) {
    const agg = await db.getStageAggregation(stage.id);

    // 교차 검증: 진행 기록에 클리어한 사용자가 있는데 성공 이벤트가 0건인 경우
    // 데이터 손실 의심 상태이므로 임의 0 대입을 방지하고 보정을 차단·보고한다.
    if (agg.clearedUserCount > 0 && agg.verifiedClearCount === 0) {
      inconsistentStages += 1;
      errors.push(
        `Stage ${stage.id}: Inconsistent progress without verified clear events (cleared users: ${agg.clearedUserCount}, verified events: 0). Backfill aborted for this stage to prevent data loss.`,
      );
      continue;
    }

    const targetPlays = agg.totalAttempts;
    const targetClears = agg.verifiedClearCount;
    const targetClearTotalMs = agg.verifiedClearTotalMs;
    const targetAvgClearMs = targetClears > 0 ? Math.round(Number(targetClearTotalMs) / targetClears) : 0;

    const currentPlays = stage.plays ?? 0;
    const currentClears = stage.clears ?? 0;
    const currentTotalMs = stage.clearTotalMs ?? 0n;
    const currentAvgMs = stage.avgClearMs ?? 0;

    const needsUpdate =
      currentPlays !== targetPlays ||
      currentClears !== targetClears ||
      currentTotalMs !== targetClearTotalMs ||
      currentAvgMs !== targetAvgClearMs;

    if (needsUpdate) {
      updatedStages += 1;
      if (!isDryRun) {
        await db.updateStageStats(stage.id, {
          plays: targetPlays,
          clears: targetClears,
          clearTotalMs: targetClearTotalMs,
          avgClearMs: targetAvgClearMs,
        });
      }
    }
  }

  const ok = inconsistentStages === 0;
  return {
    ok,
    dryRun: isDryRun,
    totalStages: stages.length,
    scannedStages: stages.length,
    updatedStages,
    inconsistentStages,
    errors,
  };
}
