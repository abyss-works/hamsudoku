import { asc, eq } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { clearRecords } from './schema';

export interface StageRecord {
  stageCode: string;
  bestElapsedSec: number | null;
  attempts: number;
  lastClearedAt: string;
}

export async function listStageRecords(executor: Executor, userId: string): Promise<StageRecord[]> {
  const rows = await executor
    .select({
      stageCode: clearRecords.stageCode,
      bestElapsedSec: clearRecords.bestElapsedSec,
      attempts: clearRecords.attempts,
      lastClearedAt: clearRecords.lastClearedAt,
    })
    .from(clearRecords)
    .where(eq(clearRecords.userId, userId))
    .orderBy(asc(clearRecords.stageCode));
  return rows.map((row) => ({ ...row, lastClearedAt: row.lastClearedAt.toISOString() }));
}
