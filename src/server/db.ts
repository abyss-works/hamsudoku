import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../prisma/generated/prisma/client';
import { mergeClear, type ClearRecord } from '../shared/merge';

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

export const MAX_INT32 = 2_147_483_647;
export const MAX_BIGINT64 = BigInt('9223372036854775807');

export function clampInt32(val: number): number {
  if (val > MAX_INT32) return MAX_INT32;
  if (val < 0) return 0;
  return Math.round(val);
}

export function clampBigInt64(val: bigint): bigint {
  if (val > MAX_BIGINT64) return MAX_BIGINT64;
  if (val < BigInt(0)) return BigInt(0);
  return val;
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

export interface DbPort {
  ensureUser(userId: string, email: string | null): Promise<void>;
  listUsers(): Promise<{ userId: string; email: string | null; hasProfile: boolean }[]>;
  getNickname(userId: string): Promise<string | null>;
  setNickname(userId: string, nickname: string): Promise<void>;
  lookupNicknames(userIds: string[]): Promise<Record<string, string | null>>;
  issueAttempt(userId: string, stageCode: string): Promise<Attempt>;
  findAttempt(key: string): Promise<Attempt | null>;
  useAttempt(userId: string, key: string, stageCode: string, nowIso: string): Promise<Attempt | null>;
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
  injectInconsistentProgress?(
    userId: string,
    stageId: string,
    input: { cleared: boolean; attempts: number },
  ): Promise<void>;
  commitEndlessClear(
    userId: string,
    stageId: string,
    input: { earned: number; season: string; seedLeft: number; elapsedMs: number; suspicious: boolean; atIso: string },
  ): Promise<EndlessSummary>;
  commitEndlessFail(userId: string, stageId: string, atIso: string): Promise<{ streak: StreakRow }>;
  appendEndlessEvent(
    userId: string,
    stageId: string,
    input: { seedLeft: number; elapsedMs: number; verified: boolean; suspicious: boolean; reason?: string },
  ): Promise<void>;
  listRecentEndlessEvents(userId: string, limit: number): Promise<EndlessEventRow[]>;
  getEndlessSummary(userId: string): Promise<EndlessSummary>;
  listSeasonEarnings(season: string): Promise<{ userId: string; amount: number }[]>;
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
  ): Promise<boolean>;
  failSupplyChunk(jobId: string, chunkIndex: number, reason: string): Promise<void>;
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

let nextId = 0;

export function createMemoryDb(): DbPort {
  const users = new Map<string, { email: string | null; hasProfile: boolean }>();
  const nicknames = new Map<string, string>();
  const attempts = new Map<string, Attempt>();
  const records = new Map<string, ClearRecord & { updatedAt: string }>();
  const events: { userId: string; stageCode: string; elapsedSec: number; verified: boolean; clearedAt: string }[] = [];
  const stages = new Map<string, EndlessStageRow>();
  const stageJobMap = new Map<string, string>();
  const endlessProgress = new Map<string, { cleared: boolean; attempts: number; lastPlayedAt: string }>();
  const wallets = new Map<string, number>();
  const streaks = new Map<string, StreakRow>();
  const endlessEvents: {
    userId: string;
    stageId: string;
    seedLeft: number;
    elapsedMs: number;
    verified: boolean;
    suspicious: boolean;
    reason?: string;
    createdAt: string;
  }[] = [];
  const seedLedger: { userId: string; amount: number; season: string }[] = [];
  const supplyJobs = new Map<string, EndlessSupplyJobRow>();
  const supplyChunks = new Map<string, EndlessSupplyChunkRow>();

  const progressKey = (userId: string, stageId: string) => `${userId}:${stageId}`;
  const streakOf = (userId: string): StreakRow => streaks.get(userId) ?? { current: 0, best: 0 };
  const balanceOf = (userId: string): number => wallets.get(userId) ?? 0;
  const clearedCountOf = (userId: string) =>
    [...endlessProgress.entries()].filter(([k, v]) => k.startsWith(`${userId}:`) && v.cleared).length;

  return {
    async ensureUser(userId: string, email: string | null) {
      const prev = users.get(userId);
      users.set(userId, { email: email ?? prev?.email ?? null, hasProfile: true });
    },
    async listUsers() {
      return [...users.entries()].map(([userId, u]) => ({ userId, email: u.email, hasProfile: u.hasProfile }));
    },
    async getNickname(userId: string) {
      return nicknames.get(userId) ?? null;
    },
    async setNickname(userId: string, nickname: string) {
      nicknames.set(userId, nickname);
    },
    async lookupNicknames(userIds: string[]) {
      return Object.fromEntries(userIds.map((id) => [id, nicknames.get(id) ?? null]));
    },
    async issueAttempt(userId: string, stageCode: string) {
      const a: Attempt = {
        id: `att-${Date.now()}-${(nextId += 1)}`,
        userId,
        stageCode,
        issuedAt: new Date().toISOString(),
        usedAt: null,
      };
      attempts.set(a.id, a);
      return a;
    },
    async useAttempt(userId: string, key: string, stageCode: string, nowIso: string) {
      const a = attempts.get(key);
      if (!a || a.userId !== userId || a.stageCode !== stageCode || a.usedAt !== null) return null;
      a.usedAt = nowIso;
      return a;
    },
    async findAttempt(key: string) {
      return attempts.get(key) ?? null;
    },
    async recordVerified(userId: string, stageCode: string, elapsedSec: number, atIso: string) {
      const key = `${userId}:${stageCode}`;
      const prev = records.get(key) ?? null;
      const merged = mergeClear(
        prev ? { bestElapsedSec: prev.bestElapsedSec, attempts: prev.attempts, lastClearedAt: prev.lastClearedAt } : null,
        elapsedSec,
        atIso,
      );
      records.set(key, { ...merged, updatedAt: atIso });
      events.push({ userId, stageCode, elapsedSec, verified: true, clearedAt: atIso });
    },
    async recordUnverified(userId: string, stageCode: string, elapsedSec: number, atIso: string) {
      events.push({ userId, stageCode, elapsedSec, verified: false, clearedAt: atIso });
    },
    async listRecords(userId: string) {
      const clears: { stageCode: string; bestElapsedSec: number | null; attempts: number; lastClearedAt: string }[] = [];
      for (const [key, r] of records) {
        const [uid, ...rest] = key.split(':');
        if (uid === userId) {
          clears.push({ stageCode: rest.join(':'), bestElapsedSec: r.bestElapsedSec, attempts: r.attempts, lastClearedAt: r.lastClearedAt });
        }
      }
      return { clears };
    },
    async insertStage(stage) {
      stages.set(stage.id, {
        plays: 0,
        clears: 0,
        avgClearMs: 0,
        clearTotalMs: BigInt(0),
        ...stage,
      });
    },
    async getStage(stageId) {
      const s = stages.get(stageId);
      if (!s) return null;
      return {
        id: s.id,
        size: s.size,
        regions: s.regions,
        solution: s.solution,
        tier: s.tier,
        seed: s.seed,
        plays: s.plays ?? 0,
        clears: s.clears ?? 0,
        avgClearMs: s.avgClearMs ?? 0,
        clearTotalMs: s.clearTotalMs ?? BigInt(0),
      };
    },
    async pickUnclearedStage(userId) {
      const open = [...stages.values()].filter((s) => !endlessProgress.get(progressKey(userId, s.id))?.cleared);
      if (open.length === 0) return null;
      return open[Math.floor(Math.random() * open.length)];
    },
    async countStages() {
      return stages.size;
    },
    async countZeroClearStages() {
      return [...stages.values()].filter((s) => (s.clears ?? 0) === 0).length;
    },
    async listAllStages() {
      return [...stages.values()].map((s) => ({
        id: s.id,
        size: s.size,
        regions: s.regions,
        solution: s.solution,
        tier: s.tier,
        seed: s.seed,
        plays: s.plays ?? 0,
        clears: s.clears ?? 0,
        avgClearMs: s.avgClearMs ?? 0,
        clearTotalMs: s.clearTotalMs ?? BigInt(0),
      }));
    },
    async getStageAggregation(stageId: string) {
      let totalAttempts = 0;
      let clearedUserCount = 0;
      for (const [key, p] of endlessProgress.entries()) {
        const [, sid] = key.split(':');
        if (sid === stageId) {
          totalAttempts += p.attempts;
          if (p.cleared) clearedUserCount += 1;
        }
      }
      const verifiedEvents = endlessEvents.filter((e) => e.stageId === stageId && e.verified);
      const verifiedClearCount = verifiedEvents.length;
      const verifiedClearTotalMs = verifiedEvents.reduce((acc, e) => acc + BigInt(e.elapsedMs), BigInt(0));
      return { totalAttempts, clearedUserCount, verifiedClearCount, verifiedClearTotalMs };
    },
    async updateStageStats(stageId: string, stats: { plays: number; clears: number; clearTotalMs: bigint; avgClearMs: number }) {
      const s = stages.get(stageId);
      if (s) {
        s.plays = clampInt32(stats.plays);
        s.clears = clampInt32(stats.clears);
        s.clearTotalMs = clampBigInt64(stats.clearTotalMs);
        s.avgClearMs = clampInt32(stats.avgClearMs);
      }
    },
    async atomicReaggregateStageStats(stageId: string) {
      const s = stages.get(stageId);
      if (!s) return { ok: false, updated: false, error: `Stage ${stageId} not found` };
      const agg = await this.getStageAggregation(stageId);
      if (
        (agg.clearedUserCount > 0 && agg.verifiedClearCount === 0) ||
        agg.clearedUserCount > agg.verifiedClearCount ||
        agg.totalAttempts < agg.verifiedClearCount
      ) {
        return { ok: false, updated: false, error: `Inconsistent stage ${stageId}` };
      }
      const targetPlays = clampInt32(agg.totalAttempts);
      const targetClears = clampInt32(agg.verifiedClearCount);
      const targetTotalMs = clampBigInt64(agg.verifiedClearTotalMs);
      const targetAvgMs = targetClears > 0 ? clampInt32(Math.round(Number(targetTotalMs / BigInt(targetClears)))) : 0;

      const currentPlays = s.plays ?? 0;
      const currentClears = s.clears ?? 0;
      const currentTotalMs = s.clearTotalMs ?? BigInt(0);
      const currentAvgMs = s.avgClearMs ?? 0;

      const needsUpdate =
        currentPlays !== targetPlays ||
        currentClears !== targetClears ||
        currentTotalMs !== targetTotalMs ||
        currentAvgMs !== targetAvgMs;

      if (needsUpdate) {
        s.plays = targetPlays;
        s.clears = targetClears;
        s.clearTotalMs = targetTotalMs;
        s.avgClearMs = targetAvgMs;
        return { ok: true, updated: true };
      }
      return { ok: true, updated: false };
    },
    async injectInconsistentProgress(userId: string, stageId: string, input: { cleared: boolean; attempts: number }) {
      endlessProgress.set(progressKey(userId, stageId), {
        cleared: input.cleared,
        attempts: input.attempts,
        lastPlayedAt: new Date().toISOString(),
      });
    },
    async commitEndlessClear(userId, stageId, input) {
      const key = progressKey(userId, stageId);
      const prev = endlessProgress.get(key) ?? { cleared: false, attempts: 0, lastPlayedAt: '' };

      // 이미 클리어한 스테이지에 대한 중복 제출 처리 (보상 및 통계 멱등성 보장)
      if (prev.cleared) {
        return { balance: balanceOf(userId), clearedCount: clearedCountOf(userId), streak: streakOf(userId) };
      }

      endlessProgress.set(key, { cleared: true, attempts: prev.attempts + 1, lastPlayedAt: input.atIso });
      wallets.set(userId, balanceOf(userId) + input.earned);
      seedLedger.push({ userId, amount: input.earned, season: input.season });
      const s = streakOf(userId);
      const next =
        input.seedLeft === 3
          ? { current: s.current + 1, best: Math.max(s.best, s.current + 1) }
          : { current: 0, best: s.best };
      streaks.set(userId, next);
      endlessEvents.push({
        userId,
        stageId,
        seedLeft: input.seedLeft,
        elapsedMs: input.elapsedMs,
        verified: true,
        suspicious: input.suspicious,
        createdAt: input.atIso,
      });

      const st = stages.get(stageId);
      if (st) {
        const nextPlays = clampInt32((st.plays ?? 0) + 1);
        const nextClears = clampInt32((st.clears ?? 0) + 1);
        const nextTotalMs = clampBigInt64((st.clearTotalMs ?? BigInt(0)) + BigInt(input.elapsedMs));
        const rawAvgMs = nextClears > 0 ? Number(nextTotalMs / BigInt(nextClears)) : 0;
        const nextAvgMs = clampInt32(rawAvgMs);
        st.plays = nextPlays;
        st.clears = nextClears;
        st.clearTotalMs = nextTotalMs;
        st.avgClearMs = nextAvgMs;
      }

      return { balance: balanceOf(userId), clearedCount: clearedCountOf(userId), streak: next };
    },
    async commitEndlessFail(userId, stageId, atIso) {
      const key = progressKey(userId, stageId);
      const prev = endlessProgress.get(key) ?? { cleared: false, attempts: 0, lastPlayedAt: '' };
      endlessProgress.set(key, { ...prev, attempts: prev.attempts + 1, lastPlayedAt: atIso });
      const s = streakOf(userId);
      const next = { current: 0, best: s.best };
      streaks.set(userId, next);

      const st = stages.get(stageId);
      if (st) {
        st.plays = clampInt32((st.plays ?? 0) + 1);
      }

      return { streak: next };
    },
    async appendEndlessEvent(userId, stageId, input) {
      endlessEvents.push({ userId, stageId, ...input, createdAt: new Date().toISOString() });
    },
    async listRecentEndlessEvents(userId, limit) {
      return endlessEvents
        .filter((e) => e.userId === userId)
        .slice(-limit)
        .reverse()
        .map((e) => ({
          seedLeft: e.seedLeft,
          elapsedMs: e.elapsedMs,
          verified: e.verified,
          suspicious: e.suspicious,
          reason: e.reason,
          createdAt: e.createdAt,
        }));
    },
    async getEndlessSummary(userId) {
      return { balance: balanceOf(userId), clearedCount: clearedCountOf(userId), streak: streakOf(userId) };
    },
    async listSeasonEarnings(season) {
      const sums = new Map<string, number>();
      for (const e of seedLedger) {
        if (e.season !== season) continue;
        sums.set(e.userId, (sums.get(e.userId) ?? 0) + e.amount);
      }
      return [...sums.entries()].map(([userId, amount]) => ({ userId, amount }));
    },
    async findActiveSupplyJob(nowIso) {
      const now = Date.parse(nowIso);
      const active = [...supplyJobs.values()].find((j) => {
        if (j.status !== 'pending' && j.status !== 'running') return false;
        if (j.leaseExpiresAt && Date.parse(j.leaseExpiresAt) <= now) return false;
        return true;
      });
      return active ?? null;
    },
    async getLatestSupplySuccessAt() {
      let latest: string | null = null;
      for (const j of supplyJobs.values()) {
        if (j.lastSuccessAt) {
          if (!latest || Date.parse(j.lastSuccessAt) > Date.parse(latest)) {
            latest = j.lastSuccessAt;
          }
        }
      }
      return latest;
    },
    async createSupplyJob(data) {
      const row: EndlessSupplyJobRow = {
        ...data,
        status: 'pending',
        lastSuccessAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      supplyJobs.set(row.id, row);
      return row;
    },
    async updateSupplyJob(jobId, data) {
      const j = supplyJobs.get(jobId);
      if (j) {
        if (data.status !== undefined) j.status = data.status;
        if (data.leaseExpiresAt !== undefined) j.leaseExpiresAt = data.leaseExpiresAt;
        if (data.lastSuccessAt !== undefined) j.lastSuccessAt = data.lastSuccessAt;
        j.updatedAt = new Date().toISOString();
      }
    },
    async findSupplyJob(jobId) {
      return supplyJobs.get(jobId) ?? null;
    },
    async createSupplyChunk(data) {
      const chunk: EndlessSupplyChunkRow = {
        ...data,
        stageCount: 0,
        completedAt: null,
        createdAt: new Date().toISOString(),
      };
      supplyChunks.set(`${data.jobId}:${data.chunkIndex}`, chunk);
    },
    async findSupplyChunk(jobId, chunkIndex) {
      return supplyChunks.get(`${jobId}:${chunkIndex}`) ?? null;
    },
    async updateSupplyChunk(jobId, chunkIndex, data) {
      const c = supplyChunks.get(`${jobId}:${chunkIndex}`);
      if (c) {
        c.status = data.status;
        if (data.stageCount !== undefined) c.stageCount = data.stageCount;
        if (data.completedAt !== undefined) c.completedAt = data.completedAt;
      }
    },
    async getHighestStageSeed() {
      let maxSeed = 10000;
      for (const s of stages.values()) {
        if (s.seed > maxSeed) maxSeed = s.seed;
      }
      return maxSeed;
    },
    async claimSupplyChunk(jobId, chunkIndex, nowIso, leaseDurationMs) {
      const job = supplyJobs.get(jobId);
      const chunk = supplyChunks.get(`${jobId}:${chunkIndex}`);
      if (!job || !chunk) {
        return { claimed: false, alreadyCompleted: false, reason: 'JOB_OR_CHUNK_NOT_FOUND' };
      }
      if (chunk.status === 'completed') {
        return { claimed: false, alreadyCompleted: true, stageCount: chunk.stageCount };
      }
      const now = Date.parse(nowIso);
      const isLeaseActive = job.leaseExpiresAt && Date.parse(job.leaseExpiresAt) > now;
      if (chunk.status === 'running' && isLeaseActive) {
        return { claimed: false, alreadyCompleted: false, reason: 'CLAIM_BUSY' };
      }
      const newLease = new Date(now + leaseDurationMs).toISOString();
      chunk.status = 'running';
      job.status = 'running';
      job.leaseExpiresAt = newLease;
      job.updatedAt = new Date().toISOString();
      return {
        claimed: true,
        alreadyCompleted: false,
        stageCount: chunk.stageCount,
        seedStart: job.seedStart,
        targetCount: job.targetCount,
      };
    },
    async insertSupplyBatch(jobId, chunkIndex, stageRows, completedAtIso) {
      const job = supplyJobs.get(jobId);
      const chunk = supplyChunks.get(`${jobId}:${chunkIndex}`);
      if (!job || !chunk) return false;

      // 콘텐츠 해시 및 기존 stage 중복 검사
      const existingSignatures = new Map<string, string>();
      for (const s of stages.values()) {
        existingSignatures.set(`${s.regions}:${s.solution}`, s.id);
      }

      for (const st of stageRows) {
        const sig = `${st.regions}:${st.solution}`;
        const existingId = existingSignatures.get(sig);
        const existingJobId = stageJobMap.get(st.id);

        if (existingId && existingId !== st.id) {
          // 다른 ID의 스테이지와 콘텐츠가 동일함 -> 중복!
          return false;
        }
        if (existingJobId && existingJobId !== jobId) {
          // 다른 작업에서 이미 생성된 ID/스테이지 -> 중복!
          return false;
        }
      }

      for (const st of stageRows) {
        stages.set(st.id, { ...st });
        stageJobMap.set(st.id, jobId);
      }

      chunk.status = 'completed';
      chunk.stageCount = stageRows.length;
      chunk.completedAt = completedAtIso;

      job.status = 'completed';
      job.lastSuccessAt = completedAtIso;
      job.leaseExpiresAt = null;
      job.updatedAt = new Date().toISOString();

      return true;
    },
    async failSupplyChunk(jobId, chunkIndex, _reason) {
      const job = supplyJobs.get(jobId);
      const chunk = supplyChunks.get(`${jobId}:${chunkIndex}`);
      if (chunk) {
        chunk.status = 'failed';
      }
      if (job) {
        job.status = 'failed';
        job.leaseExpiresAt = null;
        job.updatedAt = new Date().toISOString();
      }
    },
    async getHighestReservedSeed() {
      let maxSeed = 10000;
      for (const s of stages.values()) {
        if (s.seed > maxSeed) maxSeed = s.seed;
      }
      for (const j of supplyJobs.values()) {
        if (j.seedEnd > maxSeed) maxSeed = j.seedEnd;
      }
      return maxSeed;
    },
    async atomicRequestSupply(nowIso, options = {}) {
      // 공급 scope lock (인메모리 순차 직렬화)
      const stockThreshold = options.stockThreshold ?? 20;
      const cooldownMs = options.cooldownMs ?? 60_000;
      const leaseDurationMs = options.leaseDurationMs ?? 120_000;
      const batchCount = options.batchCount ?? 10;

      // 1. 재고 검사 (clears === 0)
      const stockCount = [...stages.values()].filter((s) => (s.clears ?? 0) === 0).length;
      if (stockCount >= stockThreshold) {
        return { shouldEnqueue: false, action: 'sufficient_stock' };
      }

      // 2. 만료된 작업 정리 및 활성 작업 검사
      const now = Date.parse(nowIso);
      for (const j of supplyJobs.values()) {
        if (
          (j.status === 'pending' || j.status === 'running') &&
          j.leaseExpiresAt &&
          Date.parse(j.leaseExpiresAt) <= now
        ) {
          j.status = 'failed';
          j.updatedAt = new Date().toISOString();
        }
      }

      const activeJob = [...supplyJobs.values()].find((j) => {
        if (j.status !== 'pending' && j.status !== 'running') return false;
        if (j.leaseExpiresAt && Date.parse(j.leaseExpiresAt) <= now) return false;
        return true;
      });
      if (activeJob) {
        return { shouldEnqueue: false, action: 'merged', jobId: activeJob.id };
      }

      // 3. 쿨다운 검사
      let latestSuccess: string | null = null;
      for (const j of supplyJobs.values()) {
        if (j.lastSuccessAt && (!latestSuccess || Date.parse(j.lastSuccessAt) > Date.parse(latestSuccess))) {
          latestSuccess = j.lastSuccessAt;
        }
      }
      if (latestSuccess) {
        const elapsed = now - Date.parse(latestSuccess);
        if (elapsed < cooldownMs) {
          return { shouldEnqueue: false, action: 'cooldown' };
        }
      }

      // 4. 시드 예약 (기존 stage + 예약 job)
      let maxSeed = 10000;
      for (const s of stages.values()) {
        if (s.seed > maxSeed) maxSeed = s.seed;
      }
      for (const j of supplyJobs.values()) {
        if (j.seedEnd > maxSeed) maxSeed = j.seedEnd;
      }

      const seedStart = maxSeed;
      const seedEnd = seedStart + batchCount;
      const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const leaseExpiresAt = new Date(now + leaseDurationMs).toISOString();

      const jobRow: EndlessSupplyJobRow = {
        id: jobId,
        policyVersion: 'v1',
        seedStart,
        seedEnd,
        targetCount: batchCount,
        status: 'pending',
        leaseExpiresAt,
        lastSuccessAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      supplyJobs.set(jobId, jobRow);

      supplyChunks.set(`${jobId}:0`, {
        id: `${jobId}:0`,
        jobId,
        chunkIndex: 0,
        status: 'pending',
        stageCount: 0,
        completedAt: null,
        createdAt: new Date().toISOString(),
      });

      return {
        shouldEnqueue: true,
        action: 'enqueued',
        jobId,
        seedStart,
        seedEnd,
      };
    },
    async markSupplyJobPublishFailed(jobId) {
      const j = supplyJobs.get(jobId);
      if (j) {
        j.status = 'publish_failed';
        j.leaseExpiresAt = null;
        j.updatedAt = new Date().toISOString();
      }
      const c = supplyChunks.get(`${jobId}:0`);
      if (c) {
        c.status = 'publish_failed';
      }
    },
  };
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

// 서버리스 인스턴스당 커넥션 1개로 제한한다. 웜 컨테이너는 풀을 재사용한다.
const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 5000,
  });

const adapter = new PrismaPg(pool);

const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

// P2002는 코드 속성으로 판정한다. PrismaClientKnownRequestError의
// instanceof 대신 code를 보는 이유는 복사본이 다른 클라이언트에서도
// 동일하게 동작하고 테스트 스텁으로 재현할 수 있기 때문이다.
function isUniqueConflict(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: unknown }).code === 'P2002';
}

export function createPrismaDb(client: PrismaClient = prisma): DbPort {
  return {
    async ensureUser(userId: string, email: string | null) {
      try {
        await client.user.upsert({
          where: { id: userId },
          create: { id: userId, email },
          update: email ? { email } : {},
        });
      } catch (e) {
        // 동시 첫 로그인 경합으로 행이 이미 있으면 update로 조정한다.
        if (!isUniqueConflict(e)) throw e;
        if (email) await client.user.update({ where: { id: userId }, data: { email } });
      }
      try {
        await client.profile.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });
      } catch (e) {
        if (!isUniqueConflict(e)) throw e;
      }
    },
    async listUsers() {
      const [all, profiles] = await Promise.all([client.user.findMany(), client.profile.findMany()]);
      const withProfile = new Set(profiles.map((p) => p.userId));
      return all.map((r) => ({ userId: r.id, email: r.email, hasProfile: withProfile.has(r.id) }));
    },
    async getNickname(userId: string) {
      const p = await client.profile.findUnique({ where: { userId } });
      return p?.nickname ?? null;
    },
    async setNickname(userId: string, nickname: string) {
      await client.profile.upsert({
        where: { userId },
        create: { userId, nickname },
        update: { nickname },
      });
    },
    async lookupNicknames(userIds: string[]) {
      const rows = await client.profile.findMany({ where: { userId: { in: userIds } } });
      const found = new Map(rows.map((r) => [r.userId, r.nickname] as const));
      return Object.fromEntries(userIds.map((id) => [id, found.get(id) ?? null]));
    },
    async issueAttempt(userId: string, stageCode: string) {
      const a = await client.attempt.create({ data: { userId, stageCode } });
      return {
        id: a.id,
        userId: a.userId,
        stageCode: a.stageCode,
        issuedAt: a.issuedAt.toISOString(),
        usedAt: a.usedAt ? a.usedAt.toISOString() : null,
      };
    },
    async findAttempt(key: string) {
      const a = await client.attempt.findUnique({ where: { id: key } });
      if (!a) return null;
      return {
        id: a.id,
        userId: a.userId,
        stageCode: a.stageCode,
        issuedAt: a.issuedAt.toISOString(),
        usedAt: a.usedAt ? a.usedAt.toISOString() : null,
      };
    },
    async useAttempt(userId: string, key: string, stageCode: string, nowIso: string) {
      const updated = await client.attempt.updateMany({
        where: { id: key, userId, stageCode, usedAt: null },
        data: { usedAt: new Date(nowIso) },
      });
      if (updated.count === 0) return null;
      const a = await client.attempt.findUniqueOrThrow({ where: { id: key } });
      return {
        id: a.id,
        userId: a.userId,
        stageCode: a.stageCode,
        issuedAt: a.issuedAt.toISOString(),
        usedAt: a.usedAt ? a.usedAt.toISOString() : null,
      };
    },
    async recordVerified(userId: string, stageCode: string, elapsedSec: number, atIso: string) {
      const prev = await client.clearRecord.findUnique({
        where: { userId_stageCode: { userId, stageCode } },
      });
      const merged = mergeClear(
        prev ? { bestElapsedSec: prev.bestElapsedSec, attempts: prev.attempts, lastClearedAt: prev.lastClearedAt.toISOString() } : null,
        elapsedSec,
        atIso,
      );
      await client.clearRecord.upsert({
        where: { userId_stageCode: { userId, stageCode } },
        create: { userId, stageCode, bestElapsedSec: merged.bestElapsedSec, attempts: merged.attempts, lastClearedAt: new Date(merged.lastClearedAt) },
        update: { bestElapsedSec: merged.bestElapsedSec, attempts: merged.attempts, lastClearedAt: new Date(merged.lastClearedAt) },
      });
      await client.clearEvent.create({
        data: { userId, stageCode, elapsedSec, verified: true, clearedAt: new Date(atIso) },
      });
    },
    async recordUnverified(userId: string, stageCode: string, elapsedSec: number, atIso: string) {
      await client.clearEvent.create({
        data: { userId, stageCode, elapsedSec, verified: false, clearedAt: new Date(atIso) },
      });
    },
    async listRecords(userId: string) {
      const rows = await client.clearRecord.findMany({ where: { userId } });
      return {
        clears: rows.map((r) => ({
          stageCode: r.stageCode,
          bestElapsedSec: r.bestElapsedSec,
          attempts: r.attempts,
          lastClearedAt: r.lastClearedAt.toISOString(),
        })),
      };
    },
    async insertStage(stage) {
      await client.endlessStage.create({
        data: {
          id: stage.id,
          size: stage.size,
          regions: stage.regions,
          solution: stage.solution,
          tier: stage.tier,
          seed: stage.seed,
          plays: stage.plays ?? 0,
          clears: stage.clears ?? 0,
          avgClearMs: stage.avgClearMs ?? 0,
          clearTotalMs: stage.clearTotalMs ?? BigInt(0),
        },
      });
    },
    async getStage(stageId) {
      const s = await client.endlessStage.findUnique({ where: { id: stageId } });
      return s
        ? {
            id: s.id,
            size: s.size,
            regions: s.regions,
            solution: s.solution,
            tier: s.tier,
            seed: s.seed,
            plays: s.plays,
            clears: s.clears,
            avgClearMs: s.avgClearMs,
            clearTotalMs: s.clearTotalMs,
          }
        : null;
    },
    async pickUnclearedStage(userId) {
      const rows = await client.$queryRaw<{ id: string }[]>`
        SELECT s.id FROM "EndlessStage" s
        WHERE NOT EXISTS (
          SELECT 1 FROM "EndlessProgress" p
          WHERE p."userId" = ${userId} AND p."stageId" = s.id AND p.cleared = true
        )
        ORDER BY random() LIMIT 1`;
      if (rows.length === 0) return null;
      const s = await client.endlessStage.findUniqueOrThrow({ where: { id: rows[0].id } });
      return {
        id: s.id,
        size: s.size,
        regions: s.regions,
        solution: s.solution,
        tier: s.tier,
        seed: s.seed,
        plays: s.plays,
        clears: s.clears,
        avgClearMs: s.avgClearMs,
        clearTotalMs: s.clearTotalMs,
      };
    },
    async countStages() {
      return client.endlessStage.count();
    },
    async countZeroClearStages() {
      return client.endlessStage.count({ where: { clears: 0 } });
    },
    async listAllStages() {
      const rows = await client.endlessStage.findMany();
      return rows.map((s) => ({
        id: s.id,
        size: s.size,
        regions: s.regions,
        solution: s.solution,
        tier: s.tier,
        seed: s.seed,
        plays: s.plays,
        clears: s.clears,
        avgClearMs: s.avgClearMs,
        clearTotalMs: s.clearTotalMs,
      }));
    },
    async getStageAggregation(stageId: string) {
      const [progressAgg, clearedUserCount, eventAgg] = await Promise.all([
        client.endlessProgress.aggregate({
          where: { stageId },
          _sum: { attempts: true },
        }),
        client.endlessProgress.count({
          where: { stageId, cleared: true },
        }),
        client.endlessEvent.aggregate({
          where: { stageId, verified: true },
          _count: { _all: true },
          _sum: { elapsedMs: true },
        }),
      ]);
      return {
        totalAttempts: progressAgg._sum.attempts ?? 0,
        clearedUserCount,
        verifiedClearCount: eventAgg._count._all,
        verifiedClearTotalMs: BigInt(eventAgg._sum.elapsedMs ?? 0),
      };
    },
    async updateStageStats(stageId: string, stats: { plays: number; clears: number; clearTotalMs: bigint; avgClearMs: number }) {
      await client.endlessStage.update({
        where: { id: stageId },
        data: {
          plays: clampInt32(stats.plays),
          clears: clampInt32(stats.clears),
          clearTotalMs: clampBigInt64(stats.clearTotalMs),
          avgClearMs: clampInt32(stats.avgClearMs),
        },
      });
    },
    async atomicReaggregateStageStats(stageId: string) {
      return client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "EndlessStage" WHERE id = ${stageId} FOR UPDATE`;
        const s = await tx.endlessStage.findUnique({ where: { id: stageId } });
        if (!s) return { ok: false, updated: false, error: `Stage ${stageId} not found` };

        const [progressAgg, clearedUserCount, eventAgg] = await Promise.all([
          tx.endlessProgress.aggregate({ where: { stageId }, _sum: { attempts: true } }),
          tx.endlessProgress.count({ where: { stageId, cleared: true } }),
          tx.endlessEvent.aggregate({ where: { stageId, verified: true }, _count: { _all: true }, _sum: { elapsedMs: true } }),
        ]);

        const totalAttempts = progressAgg._sum.attempts ?? 0;
        const verifiedClearCount = eventAgg._count._all;
        const verifiedClearTotalMs = BigInt(eventAgg._sum.elapsedMs ?? 0);

        if (
          (clearedUserCount > 0 && verifiedClearCount === 0) ||
          clearedUserCount > verifiedClearCount ||
          totalAttempts < verifiedClearCount
        ) {
          return { ok: false, updated: false, error: `Inconsistent stage ${stageId}` };
        }

        const targetPlays = clampInt32(totalAttempts);
        const targetClears = clampInt32(verifiedClearCount);
        const targetTotalMs = clampBigInt64(verifiedClearTotalMs);
        const targetAvgMs = targetClears > 0 ? clampInt32(Math.round(Number(targetTotalMs / BigInt(targetClears)))) : 0;

        const needsUpdate =
          s.plays !== targetPlays ||
          s.clears !== targetClears ||
          s.clearTotalMs !== targetTotalMs ||
          s.avgClearMs !== targetAvgMs;

        if (needsUpdate) {
          await tx.endlessStage.update({
            where: { id: stageId },
            data: {
              plays: targetPlays,
              clears: targetClears,
              clearTotalMs: targetTotalMs,
              avgClearMs: targetAvgMs,
            },
          });
          return { ok: true, updated: true };
        }
        return { ok: true, updated: false };
      });
    },
    async commitEndlessClear(userId, stageId, input) {
      return client.$transaction(async (tx) => {
        // 행 레벨 락으로 동시 클리어 시 가산 손실 방지
        await tx.$queryRaw`SELECT id FROM "EndlessStage" WHERE id = ${stageId} FOR UPDATE`;

        const prevProgress = await tx.endlessProgress.findUnique({
          where: { userId_stageId: { userId, stageId } },
        });

        // 이미 클리어된 스테이지에 대한 중복 제출 처리 (보상 및 통계 멱등성 보장)
        if (prevProgress?.cleared) {
          const wallet = await tx.seedWallet.findUnique({ where: { userId } });
          const streak = await tx.endlessStreak.findUnique({ where: { userId } });
          const clearedCount = await tx.endlessProgress.count({ where: { userId, cleared: true } });
          return {
            balance: wallet?.balance ?? 0,
            clearedCount,
            streak: { current: streak?.current ?? 0, best: streak?.best ?? 0 },
          };
        }

        await tx.endlessProgress.upsert({
          where: { userId_stageId: { userId, stageId } },
          create: { userId, stageId, cleared: true, attempts: 1, lastPlayedAt: new Date(input.atIso) },
          update: { cleared: true, attempts: { increment: 1 }, lastPlayedAt: new Date(input.atIso) },
        });
        const wallet = await tx.seedWallet.upsert({
          where: { userId },
          create: { userId, balance: input.earned },
          update: { balance: { increment: input.earned } },
        });
        await tx.seedLedger.create({
          data: { userId, kind: 'earn', amount: input.earned, stageId, season: input.season },
        });
        const prev = await tx.endlessStreak.findUnique({ where: { userId } });
        const current = input.seedLeft === 3 ? (prev?.current ?? 0) + 1 : 0;
        const best = Math.max(prev?.best ?? 0, current);
        const streak = await tx.endlessStreak.upsert({
          where: { userId },
          create: { userId, current, best },
          update: { current, best },
        });
        await tx.endlessEvent.create({
          data: { userId, stageId, seedLeft: input.seedLeft, elapsedMs: input.elapsedMs, verified: true, suspicious: input.suspicious },
        });

        const stageRow = await tx.endlessStage.findUnique({ where: { id: stageId } });
        if (stageRow) {
          const nextPlays = clampInt32(stageRow.plays + 1);
          const nextClears = clampInt32(stageRow.clears + 1);
          const nextClearTotalMs = clampBigInt64(stageRow.clearTotalMs + BigInt(input.elapsedMs));
          const rawAvgMs = nextClears > 0 ? Number(nextClearTotalMs / BigInt(nextClears)) : 0;
          const nextAvgClearMs = clampInt32(rawAvgMs);
          await tx.endlessStage.update({
            where: { id: stageId },
            data: {
              plays: nextPlays,
              clears: nextClears,
              clearTotalMs: nextClearTotalMs,
              avgClearMs: nextAvgClearMs,
            },
          });
        }

        const clearedCount = await tx.endlessProgress.count({ where: { userId, cleared: true } });
        return { balance: wallet.balance, clearedCount, streak: { current: streak.current, best: streak.best } };
      });
    },
    async commitEndlessFail(userId, stageId, atIso) {
      return client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "EndlessStage" WHERE id = ${stageId} FOR UPDATE`;
        await tx.endlessProgress.upsert({
          where: { userId_stageId: { userId, stageId } },
          create: { userId, stageId, cleared: false, attempts: 1, lastPlayedAt: new Date(atIso) },
          update: { attempts: { increment: 1 }, lastPlayedAt: new Date(atIso) },
        });
        const prev = await tx.endlessStreak.findUnique({ where: { userId } });
        const streak = await tx.endlessStreak.upsert({
          where: { userId },
          create: { userId, current: 0, best: prev?.best ?? 0 },
          update: { current: 0 },
        });

        const stageRow = await tx.endlessStage.findUnique({ where: { id: stageId } });
        if (stageRow) {
          const nextPlays = clampInt32(stageRow.plays + 1);
          await tx.endlessStage.update({
            where: { id: stageId },
            data: { plays: nextPlays },
          });
        }

        return { streak: { current: streak.current, best: streak.best } };
      });
    },
    async appendEndlessEvent(userId, stageId, input) {
      await client.endlessEvent.create({ data: { userId, stageId, ...input } });
    },
    async listRecentEndlessEvents(userId, limit) {
      const rows = await client.endlessEvent.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return rows.map((r) => ({
        seedLeft: r.seedLeft,
        elapsedMs: r.elapsedMs,
        verified: r.verified,
        suspicious: r.suspicious,
        reason: r.reason ?? undefined,
        createdAt: r.createdAt.toISOString(),
      }));
    },
    async getEndlessSummary(userId) {
      const [wallet, clearedCount, streak] = await Promise.all([
        client.seedWallet.findUnique({ where: { userId } }),
        client.endlessProgress.count({ where: { userId, cleared: true } }),
        client.endlessStreak.findUnique({ where: { userId } }),
      ]);
      return {
        balance: wallet?.balance ?? 0,
        clearedCount,
        streak: { current: streak?.current ?? 0, best: streak?.best ?? 0 },
      };
    },
    async listSeasonEarnings(season) {
      const rows = await client.seedLedger.groupBy({
        by: ['userId'],
        where: { season, kind: 'earn' },
        _sum: { amount: true },
      });
      return rows.map((r) => ({ userId: r.userId, amount: r._sum.amount ?? 0 }));
    },
    async findActiveSupplyJob(nowIso) {
      const row = await client.endlessSupplyJob.findFirst({
        where: {
          status: { in: ['pending', 'running'] },
          OR: [
            { leaseExpiresAt: null },
            { leaseExpiresAt: { gt: new Date(nowIso) } },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!row) return null;
      return {
        id: row.id,
        policyVersion: row.policyVersion,
        seedStart: row.seedStart,
        seedEnd: row.seedEnd,
        targetCount: row.targetCount,
        status: row.status,
        leaseExpiresAt: row.leaseExpiresAt ? row.leaseExpiresAt.toISOString() : null,
        lastSuccessAt: row.lastSuccessAt ? row.lastSuccessAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },
    async getLatestSupplySuccessAt() {
      const row = await client.endlessSupplyJob.findFirst({
        where: { lastSuccessAt: { not: null } },
        orderBy: { lastSuccessAt: 'desc' },
      });
      return row?.lastSuccessAt ? row.lastSuccessAt.toISOString() : null;
    },
    async createSupplyJob(data) {
      const row = await client.endlessSupplyJob.create({
        data: {
          id: data.id,
          policyVersion: data.policyVersion,
          seedStart: data.seedStart,
          seedEnd: data.seedEnd,
          targetCount: data.targetCount,
          leaseExpiresAt: data.leaseExpiresAt ? new Date(data.leaseExpiresAt) : null,
        },
      });
      return {
        id: row.id,
        policyVersion: row.policyVersion,
        seedStart: row.seedStart,
        seedEnd: row.seedEnd,
        targetCount: row.targetCount,
        status: row.status,
        leaseExpiresAt: row.leaseExpiresAt ? row.leaseExpiresAt.toISOString() : null,
        lastSuccessAt: row.lastSuccessAt ? row.lastSuccessAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },
    async updateSupplyJob(jobId, data) {
      await client.endlessSupplyJob.update({
        where: { id: jobId },
        data: {
          ...(data.status !== undefined && { status: data.status }),
          ...(data.leaseExpiresAt !== undefined && {
            leaseExpiresAt: data.leaseExpiresAt ? new Date(data.leaseExpiresAt) : null,
          }),
          ...(data.lastSuccessAt !== undefined && {
            lastSuccessAt: data.lastSuccessAt ? new Date(data.lastSuccessAt) : null,
          }),
        },
      });
    },
    async findSupplyJob(jobId) {
      const row = await client.endlessSupplyJob.findUnique({ where: { id: jobId } });
      if (!row) return null;
      return {
        id: row.id,
        policyVersion: row.policyVersion,
        seedStart: row.seedStart,
        seedEnd: row.seedEnd,
        targetCount: row.targetCount,
        status: row.status,
        leaseExpiresAt: row.leaseExpiresAt ? row.leaseExpiresAt.toISOString() : null,
        lastSuccessAt: row.lastSuccessAt ? row.lastSuccessAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },
    async createSupplyChunk(data) {
      await client.endlessSupplyChunk.create({
        data: {
          id: data.id,
          jobId: data.jobId,
          chunkIndex: data.chunkIndex,
          status: data.status,
        },
      });
    },
    async findSupplyChunk(jobId, chunkIndex) {
      const row = await client.endlessSupplyChunk.findUnique({
        where: { jobId_chunkIndex: { jobId, chunkIndex } },
      });
      if (!row) return null;
      return {
        id: row.id,
        jobId: row.jobId,
        chunkIndex: row.chunkIndex,
        status: row.status,
        stageCount: row.stageCount,
        completedAt: row.completedAt ? row.completedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
      };
    },
    async updateSupplyChunk(jobId, chunkIndex, data) {
      await client.endlessSupplyChunk.update({
        where: { jobId_chunkIndex: { jobId, chunkIndex } },
        data: {
          status: data.status,
          ...(data.stageCount !== undefined && { stageCount: data.stageCount }),
          ...(data.completedAt !== undefined && {
            completedAt: data.completedAt ? new Date(data.completedAt) : null,
          }),
        },
      });
    },
    async getHighestStageSeed() {
      const row = await client.endlessStage.findFirst({ orderBy: { seed: 'desc' } });
      return row?.seed ?? 10000;
    },
    async claimSupplyChunk(jobId, chunkIndex, nowIso, leaseDurationMs) {
      return client.$transaction(async (tx) => {
        const job = await tx.endlessSupplyJob.findUnique({ where: { id: jobId } });
        const chunk = await tx.endlessSupplyChunk.findUnique({
          where: { jobId_chunkIndex: { jobId, chunkIndex } },
        });
        if (!job || !chunk) {
          return { claimed: false, alreadyCompleted: false, reason: 'JOB_OR_CHUNK_NOT_FOUND' };
        }
        if (chunk.status === 'completed') {
          return { claimed: false, alreadyCompleted: true, stageCount: chunk.stageCount };
        }
        const now = new Date(nowIso).getTime();
        const isLeaseActive = job.leaseExpiresAt && job.leaseExpiresAt.getTime() > now;
        if (chunk.status === 'running' && isLeaseActive) {
          return { claimed: false, alreadyCompleted: false, reason: 'CLAIM_BUSY' };
        }
        const newLease = new Date(now + leaseDurationMs);
        await tx.endlessSupplyChunk.update({
          where: { jobId_chunkIndex: { jobId, chunkIndex } },
          data: { status: 'running' },
        });
        await tx.endlessSupplyJob.update({
          where: { id: jobId },
          data: { status: 'running', leaseExpiresAt: newLease },
        });
        return {
          claimed: true,
          alreadyCompleted: false,
          stageCount: chunk.stageCount,
          seedStart: job.seedStart,
          targetCount: job.targetCount,
        };
      });
    },
    async insertSupplyBatch(jobId, chunkIndex, stageRows, completedAtIso) {
      return client.$transaction(async (tx) => {
        const completedDate = new Date(completedAtIso);
        const job = await tx.endlessSupplyJob.findUnique({ where: { id: jobId } });
        if (!job) return false;

        // 콘텐츠 중복 검사: regions + solution 중복 확인
        const duplicate = await tx.endlessStage.findFirst({
          where: {
            OR: stageRows.map((s) => ({
              regions: s.regions,
              solution: s.solution,
              id: { not: s.id },
            })),
          },
        });
        if (duplicate) {
          return false;
        }

        // 다른 작업에서 이미 생성된 동일 id 검사
        const existingOlder = await tx.endlessStage.findFirst({
          where: {
            id: { in: stageRows.map((s) => s.id) },
            createdAt: { lt: job.createdAt },
          },
        });
        if (existingOlder) {
          return false;
        }

        // 10개 행 적재
        for (const s of stageRows) {
          await tx.endlessStage.upsert({
            where: { id: s.id },
            create: {
              id: s.id,
              size: s.size,
              regions: s.regions,
              solution: s.solution,
              tier: s.tier,
              seed: s.seed,
              plays: 0,
              clears: 0,
              avgClearMs: 0,
              clearTotalMs: BigInt(0),
            },
            update: {},
          });
        }

        await tx.endlessSupplyChunk.update({
          where: { jobId_chunkIndex: { jobId, chunkIndex } },
          data: { status: 'completed', stageCount: stageRows.length, completedAt: completedDate },
        });

        await tx.endlessSupplyJob.update({
          where: { id: jobId },
          data: { status: 'completed', lastSuccessAt: completedDate, leaseExpiresAt: null },
        });

        return true;
      });
    },
    async failSupplyChunk(jobId, chunkIndex, _reason) {
      await client.$transaction(async (tx) => {
        await tx.endlessSupplyChunk.update({
          where: { jobId_chunkIndex: { jobId, chunkIndex } },
          data: { status: 'failed' },
        });
        await tx.endlessSupplyJob.update({
          where: { id: jobId },
          data: { status: 'failed', leaseExpiresAt: null },
        });
      });
    },
    async getHighestReservedSeed() {
      const [maxStage, maxJob] = await Promise.all([
        client.endlessStage.findFirst({ orderBy: { seed: 'desc' } }),
        client.endlessSupplyJob.findFirst({ orderBy: { seedEnd: 'desc' } }),
      ]);
      const stageSeed = maxStage?.seed ?? 10000;
      const jobSeed = maxJob?.seedEnd ?? 10000;
      return Math.max(stageSeed, jobSeed);
    },
    async atomicRequestSupply(nowIso, options = {}) {
      return client.$transaction(async (tx) => {
        // 공급 scope advisory lock 획득
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('endless_supply_lock'))`;

        const stockThreshold = options.stockThreshold ?? 20;
        const cooldownMs = options.cooldownMs ?? 60_000;
        const leaseDurationMs = options.leaseDurationMs ?? 120_000;
        const batchCount = options.batchCount ?? 10;

        // 1. 재고 확인
        const stockCount = await tx.endlessStage.count({ where: { clears: 0 } });
        if (stockCount >= stockThreshold) {
          return { shouldEnqueue: false, action: 'sufficient_stock' };
        }

        // 2. 만료 lease 회복 및 활성 작업 확인
        const nowDate = new Date(nowIso);
        await tx.endlessSupplyJob.updateMany({
          where: {
            status: { in: ['pending', 'running'] },
            leaseExpiresAt: { lte: nowDate },
          },
          data: { status: 'failed' },
        });

        const activeJob = await tx.endlessSupplyJob.findFirst({
          where: {
            status: { in: ['pending', 'running'] },
            OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { gt: nowDate } }],
          },
          orderBy: { createdAt: 'desc' },
        });
        if (activeJob) {
          return { shouldEnqueue: false, action: 'merged', jobId: activeJob.id };
        }

        // 3. 쿨다운 확인
        const latestSuccessJob = await tx.endlessSupplyJob.findFirst({
          where: { lastSuccessAt: { not: null } },
          orderBy: { lastSuccessAt: 'desc' },
        });
        if (latestSuccessJob?.lastSuccessAt) {
          const elapsed = nowDate.getTime() - latestSuccessJob.lastSuccessAt.getTime();
          if (elapsed < cooldownMs) {
            return { shouldEnqueue: false, action: 'cooldown' };
          }
        }

        // 4. 시드 충돌 방지 예약 (기존 stage + 예약 job)
        const [maxStage, maxJob] = await Promise.all([
          tx.endlessStage.findFirst({ orderBy: { seed: 'desc' } }),
          tx.endlessSupplyJob.findFirst({ orderBy: { seedEnd: 'desc' } }),
        ]);
        const stageSeed = maxStage?.seed ?? 10000;
        const jobSeed = maxJob?.seedEnd ?? 10000;
        const maxSeed = Math.max(stageSeed, jobSeed);

        const seedStart = maxSeed;
        const seedEnd = seedStart + batchCount;
        const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const leaseExpiresAt = new Date(nowDate.getTime() + leaseDurationMs);

        await tx.endlessSupplyJob.create({
          data: {
            id: jobId,
            policyVersion: 'v1',
            seedStart,
            seedEnd,
            targetCount: batchCount,
            status: 'pending',
            leaseExpiresAt,
          },
        });

        await tx.endlessSupplyChunk.create({
          data: {
            id: `${jobId}:0`,
            jobId,
            chunkIndex: 0,
            status: 'pending',
          },
        });

        return {
          shouldEnqueue: true,
          action: 'enqueued',
          jobId,
          seedStart,
          seedEnd,
        };
      });
    },
    async markSupplyJobPublishFailed(jobId) {
      await client.endlessSupplyJob.update({
        where: { id: jobId },
        data: { status: 'publish_failed', leaseExpiresAt: null },
      });
      await client.endlessSupplyChunk.updateMany({
        where: { jobId },
        data: { status: 'publish_failed' },
      });
    },
  };
}
