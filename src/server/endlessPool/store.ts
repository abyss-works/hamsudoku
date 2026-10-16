import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import type { Executor } from '../db/client';
import { textArray, utcTimestamp } from '../db/sql';
import { endlessStages, endlessSupplyChunks, endlessSupplyJobs } from './schema';

const MAX_INT32 = 2147483647;
const MAX_BIGINT64 = '9223372036854775807';
const DEFAULT_SEED = 10000;
const ACTIVE_STATUSES = ['pending', 'running'];

// ---- 판 통계 ----

/** 판 통계를 한 문장으로 갱신한다. 값은 컬럼 범위의 최댓값에서 멈추고 평균은 정수로 내림한다. */
export async function recordStagePlay(
  executor: Executor,
  stageId: string,
  play: { cleared: true; elapsedMs: number } | { cleared: false },
): Promise<void> {
  if (!play.cleared) {
    await executor.execute(sql`
      update "EndlessStage" set "plays" = least("plays"::bigint + 1, ${MAX_INT32})::int where "id" = ${stageId}
    `);
    return;
  }
  await executor.execute(sql`
    update "EndlessStage" set
      "plays" = least("plays"::bigint + 1, ${MAX_INT32})::int,
      "clears" = least("clears"::bigint + 1, ${MAX_INT32})::int,
      "clearTotalMs" = least("clearTotalMs"::numeric + ${play.elapsedMs}, ${MAX_BIGINT64}::numeric)::bigint,
      "avgClearMs" = least(
        trunc(least("clearTotalMs"::numeric + ${play.elapsedMs}, ${MAX_BIGINT64}::numeric) / least("clears"::bigint + 1, ${MAX_INT32})),
        ${MAX_INT32}
      )::int
    where "id" = ${stageId}
  `);
}

export interface StageStatsTarget {
  plays: number;
  clears: number;
  clearTotalMs: bigint;
  avgClearMs: number;
}

/** 판 행을 잠근 뒤 목표 통계와 다를 때만 갱신한다. 갱신 여부를 반환한다. */
export async function replaceStageStats(tx: Executor, stageId: string, target: StageStatsTarget): Promise<boolean> {
  const result = await tx.execute(sql`
    update "EndlessStage" set
      "plays" = ${target.plays}, "clears" = ${target.clears},
      "clearTotalMs" = ${target.clearTotalMs.toString()}::bigint, "avgClearMs" = ${target.avgClearMs}
    where "id" = ${stageId}
      and ("plays", "clears", "clearTotalMs", "avgClearMs")
        is distinct from (${target.plays}::int, ${target.clears}::int, ${target.clearTotalMs.toString()}::bigint, ${target.avgClearMs}::int)
  `);
  return (result.rowCount ?? 0) > 0;
}

// ---- 공급 작업 ----

export interface SupplyPolicy {
  stockThreshold: number;
  cooldownMs: number;
  leaseDurationMs: number;
  batchCount: number;
}

export interface SupplyDecision {
  shouldEnqueue: boolean;
  action: 'enqueued' | 'merged' | 'cooldown' | 'sufficient_stock';
  jobId?: string;
  seedStart?: number;
  seedEnd?: number;
}

/** 미클리어 판이 기준 수 이상인지 기준 수까지만 세어 판정한다. */
async function hasSufficientStock(tx: Executor, threshold: number): Promise<boolean> {
  const stock = await tx.execute<{ count: number }>(sql`
    select count(*)::int as "count" from (select 1 from "EndlessStage" where "clears" = 0 limit ${threshold}) as stock
  `);
  return stock.rows[0].count >= threshold;
}

/**
 * 보충 필요 여부를 판정하고 필요하면 다음 시드 구간의 작업과 청크를 예약한다. 재고가 충분하면 공급 잠금 없이 끝내고,
 * 부족하면 공급 잠금 안에서 재고를 다시 확인한다.
 * 판정 순서: 재고 충분 → 만료 임대 정리 → 진행 작업 합류 → 최근 성공 쿨다운 → 예약.
 */
export async function reserveSupplyJob(tx: Executor, now: Date, policy: SupplyPolicy): Promise<SupplyDecision> {
  if (await hasSufficientStock(tx, policy.stockThreshold)) return { shouldEnqueue: false, action: 'sufficient_stock' };
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('endless_supply_lock'))`);
  if (await hasSufficientStock(tx, policy.stockThreshold)) return { shouldEnqueue: false, action: 'sufficient_stock' };

  await tx
    .update(endlessSupplyJobs)
    .set({ status: 'failed', updatedAt: now })
    .where(and(inArray(endlessSupplyJobs.status, ACTIVE_STATUSES), lte(endlessSupplyJobs.leaseExpiresAt, now)));

  const cooldownFrom = new Date(now.getTime() - policy.cooldownMs);
  const snapshot = await tx.execute<{ activeJobId: string | null; inCooldown: boolean; maxSeed: number }>(sql`
    select
      (select "id" from "EndlessSupplyJob"
        where "status" in ('pending', 'running') and ("leaseExpiresAt" is null or "leaseExpiresAt" > ${utcTimestamp(now)})
        order by "createdAt" desc limit 1) as "activeJobId",
      coalesce((select max("lastSuccessAt") from "EndlessSupplyJob") > ${utcTimestamp(cooldownFrom)}, false) as "inCooldown",
      greatest(
        coalesce((select max("seed") from "EndlessStage"), ${DEFAULT_SEED}),
        coalesce((select max("seedEnd") from "EndlessSupplyJob"), ${DEFAULT_SEED})
      )::int as "maxSeed"
  `);
  const { activeJobId, inCooldown, maxSeed } = snapshot.rows[0];
  if (activeJobId) return { shouldEnqueue: false, action: 'merged', jobId: activeJobId };
  if (inCooldown) return { shouldEnqueue: false, action: 'cooldown' };

  const seedStart = maxSeed;
  const seedEnd = seedStart + policy.batchCount;
  const jobId = `job-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  await tx.insert(endlessSupplyJobs).values({
    id: jobId,
    policyVersion: 'v1',
    seedStart,
    seedEnd,
    targetCount: policy.batchCount,
    status: 'pending',
    leaseExpiresAt: new Date(now.getTime() + policy.leaseDurationMs),
    updatedAt: now,
  });
  await tx.insert(endlessSupplyChunks).values({ id: `${jobId}:0`, jobId, chunkIndex: 0, status: 'pending' });
  return { shouldEnqueue: true, action: 'enqueued', jobId, seedStart, seedEnd };
}

/**
 * 큐 발행이 실패한 작업과 청크를 publish_failed로 기록해 임대 동안 막히지 않게 한다.
 * 청크 처리와 같은 작업 → 청크 순서로 행을 잠그도록 트랜잭션 안에서 두 문장으로 갱신한다.
 */
export async function markSupplyJobPublishFailed(tx: Executor, jobId: string, now: Date): Promise<void> {
  await tx
    .update(endlessSupplyJobs)
    .set({ status: 'publish_failed', leaseExpiresAt: null, updatedAt: now })
    .where(eq(endlessSupplyJobs.id, jobId));
  await tx.update(endlessSupplyChunks).set({ status: 'publish_failed' }).where(eq(endlessSupplyChunks.jobId, jobId));
}

// ---- 공급 청크 ----

interface LockedChunk {
  jobStatus: string;
  leaseExpiresAt: Date | null;
  seedStart: number;
  targetCount: number;
  chunkStatus: string;
  stageCount: number;
}

function chunkWhere(jobId: string, chunkIndex: number) {
  return and(eq(endlessSupplyChunks.jobId, jobId), eq(endlessSupplyChunks.chunkIndex, chunkIndex));
}

/**
 * 작업 행과 청크 행을 작업 → 청크 순서로 잠그고 상태를 읽는다. 둘 중 하나라도 없으면 null이다.
 * 공급 작업을 갱신하는 모든 트랜잭션이 같은 순서로 잠가 교착을 피한다.
 */
async function lockChunk(tx: Executor, jobId: string, chunkIndex: number): Promise<LockedChunk | null> {
  const [job] = await tx
    .select({
      jobStatus: endlessSupplyJobs.status,
      leaseExpiresAt: endlessSupplyJobs.leaseExpiresAt,
      seedStart: endlessSupplyJobs.seedStart,
      targetCount: endlessSupplyJobs.targetCount,
    })
    .from(endlessSupplyJobs)
    .where(eq(endlessSupplyJobs.id, jobId))
    .for('update');
  if (!job) return null;
  const [chunk] = await tx
    .select({ chunkStatus: endlessSupplyChunks.status, stageCount: endlessSupplyChunks.stageCount })
    .from(endlessSupplyChunks)
    .where(chunkWhere(jobId, chunkIndex))
    .for('update');
  return chunk ? { ...job, ...chunk } : null;
}

export type ClaimResult =
  | { claimed: true; alreadyCompleted: false; claimToken: string; stageCount: number; seedStart: number; targetCount: number }
  | { claimed: false; alreadyCompleted: true; stageCount: number }
  | { claimed: false; alreadyCompleted: false; reason: 'JOB_OR_CHUNK_NOT_FOUND' | 'CLAIM_BUSY' };

/** 청크를 점유하고 새 임대 만료 시각을 점유 토큰으로 반환한다. 유효한 임대로 실행 중이면 점유하지 않는다. */
export async function claimSupplyChunk(
  tx: Executor,
  input: { jobId: string; chunkIndex: number; now: Date; leaseDurationMs: number },
): Promise<ClaimResult> {
  const locked = await lockChunk(tx, input.jobId, input.chunkIndex);
  if (!locked) return { claimed: false, alreadyCompleted: false, reason: 'JOB_OR_CHUNK_NOT_FOUND' };
  if (locked.chunkStatus === 'completed') return { claimed: false, alreadyCompleted: true, stageCount: locked.stageCount };
  const leaseActive = locked.leaseExpiresAt !== null && locked.leaseExpiresAt.getTime() > input.now.getTime();
  if (locked.chunkStatus === 'running' && leaseActive) return { claimed: false, alreadyCompleted: false, reason: 'CLAIM_BUSY' };

  const lease = new Date(input.now.getTime() + input.leaseDurationMs);
  await tx.update(endlessSupplyChunks).set({ status: 'running' }).where(chunkWhere(input.jobId, input.chunkIndex));
  await tx
    .update(endlessSupplyJobs)
    .set({ status: 'running', leaseExpiresAt: lease, updatedAt: input.now })
    .where(eq(endlessSupplyJobs.id, input.jobId));
  return {
    claimed: true,
    alreadyCompleted: false,
    claimToken: lease.toISOString(),
    stageCount: locked.stageCount,
    seedStart: locked.seedStart,
    targetCount: locked.targetCount,
  };
}

/** 점유 토큰이 현재 임대와 같아야 쓰기를 허용한다. 토큰이 없으면 검사하지 않는다. */
function ownsLease(locked: LockedChunk, claimToken: string | undefined): boolean {
  if (!claimToken) return true;
  return locked.leaseExpiresAt !== null && locked.leaseExpiresAt.getTime() === new Date(claimToken).getTime();
}

export interface SupplyStageRow {
  id: string;
  size: number;
  regions: string;
  solution: string;
  tier: number;
  seed: number;
}

/**
 * 점유한 청크의 판을 적재하고 청크와 작업을 완료한다. 완료된 청크, 다른 실행자의 토큰, 임대 만료 뒤의 완료,
 * 기존 판과 같은 영역·해답, 이전 작업이 만든 같은 id가 있으면 아무것도 쓰지 않고 false를 반환한다.
 */
export async function insertSupplyBatch(
  tx: Executor,
  input: { jobId: string; chunkIndex: number; rows: SupplyStageRow[]; completedAt: Date; claimToken?: string },
): Promise<boolean> {
  const locked = await lockChunk(tx, input.jobId, input.chunkIndex);
  if (!locked || locked.chunkStatus === 'completed') return false;
  if (!ownsLease(locked, input.claimToken)) return false;
  if (input.claimToken && locked.leaseExpiresAt && input.completedAt.getTime() > locked.leaseExpiresAt.getTime()) return false;

  const ids = input.rows.map((row) => row.id);
  const conflicts = await tx.execute<{ conflict: boolean }>(sql`
    select
      exists (
        select 1 from "EndlessStage" s
        join unnest(${textArray(ids)}, ${textArray(input.rows.map((row) => row.regions))}, ${textArray(input.rows.map((row) => row.solution))})
          as v("id", "regions", "solution")
          on s."regions" = v."regions" and s."solution" = v."solution" and s."id" <> v."id"
      )
      or exists (
        select 1 from "EndlessStage"
        where "id" = any(${textArray(ids)})
          and "createdAt" < (select "createdAt" from "EndlessSupplyJob" where "id" = ${input.jobId})
      ) as "conflict"
  `);
  if (conflicts.rows[0].conflict) return false;

  await tx.insert(endlessStages).values(input.rows).onConflictDoNothing({ target: endlessStages.id });
  await tx
    .update(endlessSupplyChunks)
    .set({ status: 'completed', stageCount: input.rows.length, completedAt: input.completedAt })
    .where(chunkWhere(input.jobId, input.chunkIndex));
  await tx
    .update(endlessSupplyJobs)
    .set({ status: 'completed', lastSuccessAt: input.completedAt, leaseExpiresAt: null, updatedAt: input.completedAt })
    .where(eq(endlessSupplyJobs.id, input.jobId));
  return true;
}

/** 실행 실패를 기록한다. 완료된 작업이나 다른 실행자의 토큰으로는 상태를 바꾸지 않는다. */
export async function failSupplyChunk(
  tx: Executor,
  input: { jobId: string; chunkIndex: number; now: Date; claimToken?: string },
): Promise<void> {
  const locked = await lockChunk(tx, input.jobId, input.chunkIndex);
  if (!locked || locked.chunkStatus === 'completed' || locked.jobStatus === 'completed') return;
  if (!ownsLease(locked, input.claimToken)) return;
  await tx.update(endlessSupplyChunks).set({ status: 'failed' }).where(chunkWhere(input.jobId, input.chunkIndex));
  await tx
    .update(endlessSupplyJobs)
    .set({ status: 'failed', leaseExpiresAt: null, updatedAt: input.now })
    .where(eq(endlessSupplyJobs.id, input.jobId));
}

/** 판 통계를 다시 계산하는 동안 같은 판의 클리어·실패 반영을 기다리게 한다. */
export async function lockStage(tx: Executor, stageId: string): Promise<boolean> {
  const result = await tx.execute(sql`select 1 from "EndlessStage" where "id" = ${stageId} for update`);
  return result.rows.length > 0;
}

/** 운영 도구의 판 일괄 적재. 이미 있는 id는 건너뛰고 새로 적재한 수를 반환한다. */
export async function insertStages(executor: Executor, rows: SupplyStageRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = await executor
    .insert(endlessStages)
    .values(rows)
    .onConflictDoNothing({ target: endlessStages.id })
    .returning({ id: endlessStages.id });
  return inserted.length;
}
