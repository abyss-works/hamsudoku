import { backfillStageStats, type BackfillReport } from '../src/server/endlessPool/statsBackfill';

/** 판 통계 복원 CLI. 기본은 dry-run이며 `--apply`일 때만 DB를 갱신한다. 종료 코드를 반환한다. */
export async function runBackfillCli(
  argv: string[] = process.argv.slice(2),
  backfill: (options: { dryRun: boolean }) => Promise<BackfillReport> = backfillStageStats,
): Promise<number> {
  const report = await backfill({ dryRun: !argv.includes('--apply') });

  if (report.ok) {
    console.log(`[backfill] status=OK dryRun=${report.dryRun} total=${report.totalStages} updated=${report.updatedStages}`);
    return 0;
  }

  console.error(`[backfill] status=FAILED inconsistent=${report.inconsistentStages} errors=${report.errors.length}`);
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
