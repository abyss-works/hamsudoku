export interface Attempt {
  id: string;
  userId: string;
  stageCode: string;
  issuedAt: string;
  usedAt: string | null;
}

export interface EndlessStageRow {
  id: string;
  size: number;
  regions: string;
  solution: string;
  tier: number;
  seed: number;
  plays?: number;
  clears?: number;
  avgClearMs?: number;
  clearTotalMs?: bigint;
}

export interface StreakRow {
  current: number;
  best: number;
}

export interface EndlessSummary {
  balance: number;
  clearedCount: number;
  streak: StreakRow;
}

export interface EndlessEventRow {
  seedLeft: number;
  elapsedMs: number;
  verified: boolean;
  suspicious: boolean;
  reason?: string;
  createdAt: string;
}

export interface EndlessSupplyJobRow {
  id: string;
  policyVersion: string;
  seedStart: number;
  seedEnd: number;
  targetCount: number;
  status: string;
  leaseExpiresAt: string | null;
  lastSuccessAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EndlessSupplyChunkRow {
  id: string;
  jobId: string;
  chunkIndex: number;
  status: string;
  stageCount: number;
  completedAt: string | null;
  createdAt: string;
}

export interface SeasonFinalizationRow {
  season: string;
  startAt: string;
  endAt: string;
  finalizedAt: string;
  status: string;
}

export interface SeasonRankResultRow {
  season: string;
  userId: string;
  score: number;
  rank: number;
}

export interface AccountDbPort {
  ensureUser(userId: string, email: string | null): Promise<void>;
  listUsers(): Promise<{ userId: string; email: string | null; hasProfile: boolean }[]>;
  getNickname(userId: string): Promise<string | null>;
  setNickname(userId: string, nickname: string): Promise<void>;
  lookupNicknames(userIds: string[]): Promise<Record<string, string | null>>;
  issueAttempt(userId: string, stageCode: string): Promise<Attempt>;
  findAttempt(key: string): Promise<Attempt | null>;
  useAttempt(userId: string, key: string, stageCode: string, nowIso: string): Promise<Attempt | null>;
  /** 소모한 키의 후속 저장이 실패했을 때 소모를 되돌린다. 소유자가 다르면 무시한다. */
  releaseAttempt(userId: string, key: string): Promise<void>;
}

export interface StageRecordDbPort {
  recordVerified(userId: string, stageCode: string, elapsedSec: number, atIso: string): Promise<void>;
  recordUnverified(userId: string, stageCode: string, elapsedSec: number, atIso: string): Promise<void>;
  listRecords(userId: string): Promise<{
    clears: { stageCode: string; bestElapsedSec: number | null; attempts: number; lastClearedAt: string }[];
  }>;
  insertStage(stage: EndlessStageRow): Promise<void>;
  getStage(stageId: string): Promise<EndlessStageRow | null>;
  pickUnclearedStage(userId: string): Promise<EndlessStageRow | null>;
  countStages(): Promise<number>;
  countZeroClearStages(): Promise<number>;
  listAllStages(): Promise<EndlessStageRow[]>;
  getStageAggregation(stageId: string): Promise<{
    totalAttempts: number;
    clearedUserCount: number;
    verifiedClearCount: number;
    verifiedClearTotalMs: bigint;
  }>;
  updateStageStats(
    stageId: string,
    stats: { plays: number; clears: number; clearTotalMs: bigint; avgClearMs: number },
  ): Promise<void>;
  atomicReaggregateStageStats?(
    stageId: string,
  ): Promise<{ ok: boolean; updated: boolean; error?: string }>;
}

export interface EndlessDbPort {
  commitEndlessClear(
    userId: string,
    stageId: string,
    input: {
      earned: number;
      season: string;
      seedLeft: number;
      elapsedMs: number;
      suspicious: boolean;
      atIso: string;
      /** 직전 검증 클리어와의 최소 간격(ms). 직렬화 경계 안에서 검사하며 미달이면 아무것도 쓰지 않고 null을 돌려준다. */
      minGapMs?: number;
    },
  ): Promise<EndlessSummary | null>;
  commitEndlessFail(userId: string, stageId: string, atIso: string): Promise<{ streak: StreakRow }>;
  appendEndlessEvent(
    userId: string,
    stageId: string,
    input: { seedLeft: number; elapsedMs: number; verified: boolean; suspicious: boolean; reason?: string },
  ): Promise<void>;
  listRecentEndlessEvents(userId: string, limit: number): Promise<EndlessEventRow[]>;
  getEndlessSummary(userId: string): Promise<EndlessSummary>;
  findActiveSupplyJob(nowIso: string): Promise<EndlessSupplyJobRow | null>;
  getLatestSupplySuccessAt(): Promise<string | null>;
  createSupplyJob(data: {
    id: string;
    policyVersion: string;
    seedStart: number;
    seedEnd: number;
    targetCount: number;
    leaseExpiresAt: string | null;
  }): Promise<EndlessSupplyJobRow>;
  updateSupplyJob(
    jobId: string,
    data: { status?: string; leaseExpiresAt?: string | null; lastSuccessAt?: string | null },
  ): Promise<void>;
  findSupplyJob(jobId: string): Promise<EndlessSupplyJobRow | null>;
  createSupplyChunk(data: { id: string; jobId: string; chunkIndex: number; status: string }): Promise<void>;
  findSupplyChunk(jobId: string, chunkIndex: number): Promise<EndlessSupplyChunkRow | null>;
  updateSupplyChunk(
    jobId: string,
    chunkIndex: number,
    data: { status: string; stageCount?: number; completedAt?: string | null },
  ): Promise<void>;
  getHighestStageSeed(): Promise<number>;
  claimSupplyChunk(
    jobId: string,
    chunkIndex: number,
    nowIso: string,
    leaseDurationMs: number,
  ): Promise<{
    claimed: boolean;
    alreadyCompleted: boolean;
    claimToken?: string;
    stageCount?: number;
    seedStart?: number;
    targetCount?: number;
    reason?: string;
  }>;
  insertSupplyBatch(
    jobId: string,
    chunkIndex: number,
    stages: EndlessStageRow[],
    completedAtIso: string,
    claimToken?: string,
  ): Promise<boolean>;
  failSupplyChunk(jobId: string, chunkIndex: number, reason: string, claimToken?: string): Promise<void>;
  getHighestReservedSeed(): Promise<number>;
  atomicRequestSupply(
    nowIso: string,
    options?: { batchCount?: number; cooldownMs?: number; leaseDurationMs?: number; stockThreshold?: number },
  ): Promise<{
    shouldEnqueue: boolean;
    action: 'enqueued' | 'merged' | 'cooldown' | 'sufficient_stock';
    jobId?: string;
    seedStart?: number;
    seedEnd?: number;
  }>;
  markSupplyJobPublishFailed(jobId: string): Promise<void>;
}

export interface SeasonRankingDbPort {
  listSeasonEarnings(season: string): Promise<{ userId: string; amount: number }[]>;
  aggregateSeasonLedger(season: string, window: { startAt: Date; endAt: Date }): Promise<{ userId: string; score: number }[]>;
  saveSeasonFinalization(header: SeasonFinalizationRow, results: SeasonRankResultRow[]): Promise<void>;
  getSeasonFinalization(season: string): Promise<{ header: SeasonFinalizationRow; results: SeasonRankResultRow[] } | null>;
  getFinalizedSeasonTop(season: string, limit: number): Promise<{ header: SeasonFinalizationRow; results: SeasonRankResultRow[] } | null>;
  getFinalizedUserRank(season: string, userId: string): Promise<{ rank: number | null; score: number } | null>;
  isSeasonFinalized(season: string): Promise<boolean>;
  runWithSeasonLock<T>(season: string, op: (txDb: DbPort) => Promise<T>): Promise<T>;
  getUserSeasonRank(season: string, userId: string, window: { startAt: Date; endAt: Date }): Promise<{ rank: number | null; score: number }>;
  listUnfinalizedSeasons(now: Date): Promise<string[]>;
}

export interface DbPort extends AccountDbPort, StageRecordDbPort, EndlessDbPort, SeasonRankingDbPort {}
