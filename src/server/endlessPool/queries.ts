import { eq, sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { endlessStages } from './schema';

export interface EndlessStageRow {
  id: string;
  size: number;
  regions: string;
  solution: string;
  tier: number;
  seed: number;
  plays: number;
  clears: number;
  avgClearMs: number;
  clearTotalMs: bigint;
}

export async function findStage(executor: Executor, stageId: string): Promise<EndlessStageRow | null> {
  const [row] = await executor
    .select({
      id: endlessStages.id,
      size: endlessStages.size,
      regions: endlessStages.regions,
      solution: endlessStages.solution,
      tier: endlessStages.tier,
      seed: endlessStages.seed,
      plays: endlessStages.plays,
      clears: endlessStages.clears,
      avgClearMs: endlessStages.avgClearMs,
      clearTotalMs: endlessStages.clearTotalMs,
    })
    .from(endlessStages)
    .where(eq(endlessStages.id, stageId));
  return row ?? null;
}

export interface StageStatsAggregate {
  stageId: string;
  plays: number;
  clears: number;
  clearTotalMs: bigint;
  avgClearMs: number;
  totalAttempts: number;
  clearedUserCount: number;
  verifiedClearCount: number;
  verifiedClearTotalMs: bigint;
}

/** 판의 현재 통계와 진행 기록·검증 이벤트 집계를 한 문장으로 조회한다. stageId를 주면 그 판만 조회한다. */
export async function listStageStatsAggregates(executor: Executor, stageId?: string): Promise<StageStatsAggregate[]> {
  const result = await executor.execute<{
    stageId: string;
    plays: number;
    clears: number;
    clearTotalMs: string;
    avgClearMs: number;
    totalAttempts: number;
    clearedUserCount: number;
    verifiedClearCount: number;
    verifiedClearTotalMs: string;
  }>(sql`
    select s."id" as "stageId", s."plays", s."clears", s."clearTotalMs"::text as "clearTotalMs", s."avgClearMs",
      coalesce(p."totalAttempts", 0)::int as "totalAttempts",
      coalesce(p."clearedUserCount", 0)::int as "clearedUserCount",
      coalesce(e."verifiedClearCount", 0)::int as "verifiedClearCount",
      coalesce(e."verifiedClearTotalMs", 0)::text as "verifiedClearTotalMs"
    from "EndlessStage" s
    left join (
      select "stageId", sum("attempts") as "totalAttempts", count(*) filter (where "cleared") as "clearedUserCount"
      from "EndlessProgress" group by "stageId"
    ) p on p."stageId" = s."id"
    left join (
      select "stageId", count(*) as "verifiedClearCount", sum("elapsedMs") as "verifiedClearTotalMs"
      from "EndlessEvent" where "verified" group by "stageId"
    ) e on e."stageId" = s."id"
    ${stageId === undefined ? sql`` : sql`where s."id" = ${stageId}`}
    order by s."id"
  `);
  return result.rows.map((row) => ({
    ...row,
    clearTotalMs: BigInt(row.clearTotalMs),
    verifiedClearTotalMs: BigInt(row.verifiedClearTotalMs),
  }));
}
