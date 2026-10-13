import { AsyncLocalStorage } from 'node:async_hooks';
import { mergeClear, type ClearRecord } from '../../shared/merge';
import { rankedSeasonId, rankingFrozen, seasonWindow } from '../../shared/season';
import { clampBigInt64, clampInt32 } from './numeric';
import {
  type Attempt,
  type DbPort,
  type EndlessStageRow,
  type EndlessSupplyChunkRow,
  type EndlessSupplyJobRow,
  type SeasonFinalizationRow,
  type SeasonRankResultRow,
  type StreakRow,
} from './port';

class SeasonSerialization {
  private queue = new Map<string, Promise<void>>();
  private storage = new AsyncLocalStorage<Set<string>>();

  async runExclusive<T>(season: string, op: () => Promise<T>): Promise<T> {
    const activeSeasons = this.storage.getStore();
    if (activeSeasons?.has(season)) {
      return op();
    }

    const prev = this.queue.get(season) ?? Promise.resolve();
    let release: () => void = () => {};
    const current = new Promise<void>((r) => {
      release = r;
    });
    this.queue.set(
      season,
      prev.then(
        () => current,
        () => current,
      ),
    );
    await prev;
    const nextSet = new Set(activeSeasons);
    nextSet.add(season);
    return this.storage.run(nextSet, async () => {
      try {
        return await op();
      } finally {
        release();
      }
    });
  }
}

let nextId = 0;

export function createMemoryDb(): DbPort {
  const seasonSerializer = new SeasonSerialization();
  const finalizations = new Map<string, { header: SeasonFinalizationRow; results: SeasonRankResultRow[] }>();
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
  const seedLedger: { userId: string; amount: number; season: string; rankingEligible: boolean; createdAt: string }[] = [];
  const supplyJobs = new Map<string, EndlessSupplyJobRow>();
  const supplyChunks = new Map<string, EndlessSupplyChunkRow>();

  const progressKey = (userId: string, stageId: string) => `${userId}:${stageId}`;

  const streakOf = (userId: string): StreakRow => streaks.get(userId) ?? { current: 0, best: 0 };
  const balanceOf = (userId: string): number => wallets.get(userId) ?? 0;
  const clearedCountOf = (userId: string) =>
    [...endlessProgress.entries()].filter(([k, v]) => k.startsWith(`${userId}:`) && v.cleared).length;

  const memoryDb: DbPort & { getRawSeedLedger?: () => typeof seedLedger } = {
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
      return seasonSerializer.runExclusive(input.season, async () => {
        const key = progressKey(userId, stageId);
        const prev = endlessProgress.get(key) ?? { cleared: false, attempts: 0, lastPlayedAt: '' };
        endlessProgress.set(key, { cleared: true, attempts: prev.attempts + 1, lastPlayedAt: input.atIso });
        wallets.set(userId, balanceOf(userId) + input.earned);

        const fin = finalizations.get(input.season);
        const window = seasonWindow(input.season);
        const atDate = new Date(input.atIso);
        const atMs = atDate.getTime();
        const inWindow = atMs >= window.startAt.getTime() && atMs < window.endAt.getTime();
        const isFinalized = fin?.header.status === 'finalized';
        const isFrozen = rankingFrozen(atDate);
        const rankingEligible = !isFinalized && inWindow && !isFrozen;

        seedLedger.push({
          userId,
          amount: input.earned,
          season: input.season,
          rankingEligible,
          createdAt: input.atIso,
        });

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
      });
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
      const window = seasonWindow(season);
      const sums = new Map<string, number>();
      for (const e of seedLedger) {
        if (e.season !== season || e.rankingEligible === false) continue;
        const t = Date.parse(e.createdAt);
        if (t < window.startAt.getTime() || t >= window.endAt.getTime()) continue;
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
        claimToken: newLease,
        stageCount: chunk.stageCount,
        seedStart: job.seedStart,
        targetCount: job.targetCount,
      };
    },
    async insertSupplyBatch(jobId, chunkIndex, stageRows, completedAtIso, claimToken) {
      const job = supplyJobs.get(jobId);
      const chunk = supplyChunks.get(`${jobId}:${chunkIndex}`);
      if (!job || !chunk) return false;
      if (chunk.status === 'completed') return false;

      // fencing token 및 lease 소유권 검증
      if (claimToken) {
        if (!job.leaseExpiresAt || job.leaseExpiresAt !== claimToken) {
          return false;
        }
        if (Date.parse(completedAtIso) > Date.parse(job.leaseExpiresAt)) {
          return false;
        }
      }

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
    async failSupplyChunk(jobId, chunkIndex, _reason, claimToken) {
      const job = supplyJobs.get(jobId);
      const chunk = supplyChunks.get(`${jobId}:${chunkIndex}`);
      if (!chunk || !job) return;

      // 완료된 작업은 오래된 실패 호출이 failed로 바꾸지 못한다
      if (chunk.status === 'completed' || job.status === 'completed') {
        return;
      }

      // fencing token 검증: 이전 만료 실행자가 신규 실행자 상태를 덮어쓰지 못하도록 차단
      if (claimToken) {
        if (!job.leaseExpiresAt || job.leaseExpiresAt !== claimToken) {
          return;
        }
      }

      chunk.status = 'failed';
      job.status = 'failed';
      job.leaseExpiresAt = null;
      job.updatedAt = new Date().toISOString();
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
    async aggregateSeasonLedger(season, window) {
      const sums = new Map<string, number>();
      for (const e of seedLedger) {
        if (e.season !== season || e.rankingEligible === false) continue;
        const t = Date.parse(e.createdAt);
        if (t >= window.startAt.getTime() && t < window.endAt.getTime()) {
          sums.set(e.userId, (sums.get(e.userId) ?? 0) + e.amount);
        }
      }
      const entries = [...sums.entries()].map(([userId, score]) => ({ userId, score }));
      entries.sort((a, b) => b.score - a.score || (b.userId > a.userId ? 1 : b.userId < a.userId ? -1 : 0));
      return entries;
    },
    async saveSeasonFinalization(header, results) {
      finalizations.set(header.season, { header, results });
    },
    async getSeasonFinalization(season) {
      return finalizations.get(season) ?? null;
    },
    async getFinalizedSeasonTop(season, limit) {
      const f = finalizations.get(season);
      if (!f || f.header.status !== 'finalized') return null;
      return { header: f.header, results: f.results.slice(0, limit) };
    },
    async getFinalizedUserRank(season, userId) {
      const f = finalizations.get(season);
      if (!f || f.header.status !== 'finalized') return null;
      const found = f.results.find((r) => r.userId === userId);
      return found ? { rank: found.rank, score: found.score } : { rank: null, score: 0 };
    },
    async isSeasonFinalized(season) {
      const f = finalizations.get(season);
      return f?.header.status === 'finalized';
    },
    async runWithSeasonLock<T>(season: string, op: (txDb: DbPort) => Promise<T>): Promise<T> {
      return seasonSerializer.runExclusive(season, () => op(memoryDb));
    },
    async getUserSeasonRank(season, userId, window) {
      const aggregated = await this.aggregateSeasonLedger(season, window);
      const idx = aggregated.findIndex((e) => e.userId === userId);
      if (idx === -1 || aggregated[idx].score <= 0) {
        return { rank: null, score: 0 };
      }
      return { rank: idx + 1, score: aggregated[idx].score };
    },
    async listUnfinalizedSeasons(now: Date) {
      const candidateSeasons = new Set<string>();
      for (const e of seedLedger) {
        candidateSeasons.add(e.season);
      }
      candidateSeasons.add(rankedSeasonId(now));

      const unfinalized: string[] = [];
      for (const s of candidateSeasons) {
        const window = seasonWindow(s);
        if (now.getTime() >= window.endAt.getTime()) {
          const isFinalized = await this.isSeasonFinalized(s);
          if (!isFinalized) {
            unfinalized.push(s);
          }
        }
      }
      return unfinalized.sort();
    },
    getRawSeedLedger() {
      return [...seedLedger];
    },
  };

  return memoryDb;
}
