import { createPrismaDb } from '../src/server/db/prisma';
import type { DbPort } from '../src/server/db/port';

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
  let inconsistentStages = 0;
  const errors: string[] = [];

  interface PendingUpdate {
    stageId: string;
    targetPlays: number;
    targetClears: number;
    targetClearTotalMs: bigint;
    targetAvgClearMs: number;
  }
  const pendingUpdates: PendingUpdate[] = [];

  // Phase 1: 전체 불일치 검사를 쓰기 전에 모두 완료하여 partial unsafe 보정을 방지
  for (const stage of stages) {
    const agg = await db.getStageAggregation(stage.id);

    // 교차 검증 1: 진행 기록에 클리어한 사용자가 있는데 성공 이벤트가 0건인 경우
    if (agg.clearedUserCount > 0 && agg.verifiedClearCount === 0) {
      inconsistentStages += 1;
      errors.push(
        `Stage ${stage.id}: Inconsistent progress without verified clear events (cleared users: ${agg.clearedUserCount}, verified events: 0). Backfill aborted to prevent data loss.`,
      );
      continue;
    }

    // 교차 검증 2: 클리어 유저 수량보다 검증된 이벤트 수가 적은 경우 (부분 이벤트 누락)
    if (agg.clearedUserCount > agg.verifiedClearCount) {
      inconsistentStages += 1;
      errors.push(
        `Stage ${stage.id}: Cleared user count (${agg.clearedUserCount}) exceeds verified clear events (${agg.verifiedClearCount}). Backfill aborted to prevent data loss.`,
      );
      continue;
    }

    // 교차 검증 3: 시도 횟수(attempts)가 클리어 수량보다 적은 경우
    if (agg.totalAttempts < agg.verifiedClearCount) {
      inconsistentStages += 1;
      errors.push(
        `Stage ${stage.id}: Total attempts (${agg.totalAttempts}) is less than verified clear count (${agg.verifiedClearCount}). Backfill aborted to prevent data loss.`,
      );
      continue;
    }

    const targetPlays = agg.totalAttempts;
    const targetClears = agg.verifiedClearCount;
    const targetClearTotalMs = agg.verifiedClearTotalMs;
    const targetAvgClearMs = targetClears > 0 ? Number(targetClearTotalMs / BigInt(targetClears)) : 0;

    const currentPlays = stage.plays ?? 0;
    const currentClears = stage.clears ?? 0;
    const currentTotalMs = stage.clearTotalMs ?? BigInt(0);
    const currentAvgMs = stage.avgClearMs ?? 0;

    const needsUpdate =
      currentPlays !== targetPlays ||
      currentClears !== targetClears ||
      currentTotalMs !== targetClearTotalMs ||
      currentAvgMs !== targetAvgClearMs;

    if (needsUpdate) {
      pendingUpdates.push({
        stageId: stage.id,
        targetPlays,
        targetClears,
        targetClearTotalMs,
        targetAvgClearMs,
      });
    }
  }

  // 전체 검사에서 하나라도 불일치가 발견되면 즉시 중단 (부분 갱신 차단)
  if (inconsistentStages > 0) {
    return {
      ok: false,
      dryRun: isDryRun,
      totalStages: stages.length,
      scannedStages: stages.length,
      updatedStages: 0,
      inconsistentStages,
      errors,
    };
  }

  // Phase 2: 불일치가 없는 경우에만 갱신 적용 (dry-run이 아닐 때)
  let updatedStages = pendingUpdates.length;

  if (!isDryRun) {
    let actuallyUpdated = 0;
    for (const pending of pendingUpdates) {
      if (db.atomicReaggregateStageStats) {
        const res = await db.atomicReaggregateStageStats(pending.stageId);
        if (!res.ok) {
          errors.push(res.error ?? `Failed to atomic update stage ${pending.stageId}`);
          break;
        } else if (res.updated) {
          actuallyUpdated += 1;
        }
      } else {
        await db.updateStageStats(pending.stageId, {
          plays: pending.targetPlays,
          clears: pending.targetClears,
          clearTotalMs: pending.targetClearTotalMs,
          avgClearMs: pending.targetAvgClearMs,
        });
        actuallyUpdated += 1;
      }
    }
    updatedStages = actuallyUpdated;
  }

  return {
    ok: errors.length === 0,
    dryRun: isDryRun,
    totalStages: stages.length,
    scannedStages: stages.length,
    updatedStages,
    inconsistentStages: 0,
    errors,
  };
}

export async function runBackfillCli(
  argv: string[] = process.argv.slice(2),
  injectedDb?: DbPort,
): Promise<number> {
  const isApply = argv.includes('--apply');
  const db = injectedDb ?? createPrismaDb();
  const report = await backfillEndlessStats(db, { dryRun: !isApply });

  if (report.ok) {
    console.log(
      `[backfill] status=OK dryRun=${report.dryRun} total=${report.totalStages} updated=${report.updatedStages}`,
    );
    return 0;
  }

  console.error(
    `[backfill] status=FAILED inconsistent=${report.inconsistentStages} errors=${report.errors.length}`,
  );
  for (const err of report.errors) {
    console.error(` - ${err}`);
  }
  return 1;
}

if (
  typeof process !== 'undefined' &&
  process.argv?.[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('scripts/backfill-endless-stats.ts')
) {
  runBackfillCli()
    .then((code) => {
      process.exit(code);
    })
    .catch((err) => {
      console.error('[backfill] Fatal execution error:', err);
      process.exit(1);
    });
}

