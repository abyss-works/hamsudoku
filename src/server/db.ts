import { AsyncLocalStorage } from 'node:async_hooks';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../prisma/generated/prisma/client';
import { mergeClear, type ClearRecord } from '../shared/merge';
import { rankedSeasonId, rankingFrozen, seasonWindow } from '../shared/season';

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
    },
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
      stages.set(stage.id, stage);
    },
    async getStage(stageId) {
      return stages.get(stageId) ?? null;
    },
    async pickUnclearedStage(userId) {
      const open = [...stages.values()].filter((s) => !endlessProgress.get(progressKey(userId, s.id))?.cleared);
      if (open.length === 0) return null;
      return open[Math.floor(Math.random() * open.length)];
    },
    async countStages() {
      return stages.size;
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
      await client.endlessStage.create({ data: stage });
    },
    async getStage(stageId) {
      const s = await client.endlessStage.findUnique({ where: { id: stageId } });
      return s
        ? { id: s.id, size: s.size, regions: s.regions, solution: s.solution, tier: s.tier, seed: s.seed }
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
      return { id: s.id, size: s.size, regions: s.regions, solution: s.solution, tier: s.tier, seed: s.seed };
    },
    async countStages() {
      return client.endlessStage.count();
    },
    async commitEndlessClear(userId, stageId, input) {
      return client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('season:' || ${input.season}))`;
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

        const fin = await tx.seasonFinalization.findUnique({ where: { season: input.season } });
        const window = seasonWindow(input.season);
        const atDate = new Date(input.atIso);
        const atMs = atDate.getTime();
        const inWindow = atMs >= window.startAt.getTime() && atMs < window.endAt.getTime();
        const isFinalized = fin?.status === 'finalized';
        const isFrozen = rankingFrozen(atDate);
        const rankingEligible = !isFinalized && inWindow && !isFrozen;

        await tx.seedLedger.create({
          data: {
            userId,
            kind: 'earn',
            amount: input.earned,
            stageId,
            season: input.season,
            rankingEligible,
            createdAt: atDate,
          },
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
        const clearedCount = await tx.endlessProgress.count({ where: { userId, cleared: true } });
        return { balance: wallet.balance, clearedCount, streak: { current: streak.current, best: streak.best } };
      });
    },
    async commitEndlessFail(userId, stageId, atIso) {
      return client.$transaction(async (tx) => {
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
      const window = seasonWindow(season);
      const rows = await client.$queryRaw<{ userId: string; amount: number }[]>`
        SELECT "userId", SUM("amount")::int AS amount
        FROM "SeedLedger"
        WHERE "season" = ${season}
          AND "kind" = 'earn'
          AND "rankingEligible" = true
          AND "createdAt" >= ${window.startAt}
          AND "createdAt" < ${window.endAt}
        GROUP BY "userId"
      `;
      return rows.map((r) => ({ userId: r.userId, amount: Number(r.amount) }));
    },
    async aggregateSeasonLedger(season, window) {
      const rows = await client.$queryRaw<{ userId: string; score: number }[]>`
        SELECT "userId", SUM("amount")::int AS score
        FROM "SeedLedger"
        WHERE "season" = ${season}
          AND "kind" = 'earn'
          AND "rankingEligible" = true
          AND "createdAt" >= ${window.startAt}
          AND "createdAt" < ${window.endAt}
        GROUP BY "userId"
        ORDER BY score DESC, "userId" COLLATE "C" DESC
      `;
      return rows.map((r) => ({ userId: r.userId, score: Number(r.score) }));
    },
    async saveSeasonFinalization(header, results) {
      const runSave = async (tx: any) => {
        await tx.seasonFinalization.upsert({
          where: { season: header.season },
          create: {
            season: header.season,
            startAt: new Date(header.startAt),
            endAt: new Date(header.endAt),
            finalizedAt: new Date(header.finalizedAt),
            status: header.status,
          },
          update: {
            finalizedAt: new Date(header.finalizedAt),
            status: header.status,
          },
        });
        if (results.length > 0) {
          await tx.seasonRankResult.createMany({
            data: results.map((r) => ({
              season: r.season,
              userId: r.userId,
              score: r.score,
              rank: r.rank,
            })),
            skipDuplicates: true,
          });
        }
      };
      if (typeof (client as any).$transaction === 'function') {
        await (client as any).$transaction(runSave);
      } else {
        await runSave(client);
      }
    },
    async getSeasonFinalization(season) {
      const h = await client.seasonFinalization.findUnique({
        where: { season },
        include: {
          results: {
            orderBy: { rank: 'asc' },
          },
        },
      });
      if (!h || h.status !== 'finalized') return null;
      return {
        header: {
          season: h.season,
          startAt: h.startAt.toISOString(),
          endAt: h.endAt.toISOString(),
          finalizedAt: h.finalizedAt.toISOString(),
          status: h.status,
        },
        results: h.results.map((r) => ({
          season: r.season,
          userId: r.userId,
          score: r.score,
          rank: r.rank,
        })),
      };
    },
    async getFinalizedSeasonTop(season, limit) {
      const h = await client.seasonFinalization.findUnique({
        where: { season },
        include: {
          results: {
            orderBy: { rank: 'asc' },
            take: limit,
          },
        },
      });
      if (!h || h.status !== 'finalized') return null;
      return {
        header: {
          season: h.season,
          startAt: h.startAt.toISOString(),
          endAt: h.endAt.toISOString(),
          finalizedAt: h.finalizedAt.toISOString(),
          status: h.status,
        },
        results: h.results.map((r) => ({
          season: r.season,
          userId: r.userId,
          score: r.score,
          rank: r.rank,
        })),
      };
    },
    async getFinalizedUserRank(season, userId) {
      const r = await client.seasonRankResult.findUnique({
        where: { season_userId: { season, userId } },
      });
      if (!r) return { rank: null, score: 0 };
      return { rank: r.rank, score: r.score };
    },
    async isSeasonFinalized(season) {
      const h = await client.seasonFinalization.findUnique({ where: { season } });
      return h?.status === 'finalized';
    },
    async runWithSeasonLock<T>(season: string, op: (txDb: DbPort) => Promise<T>): Promise<T> {
      return client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('season:' || ${season}))`;
        const txDb = createPrismaDb(tx as unknown as PrismaClient);
        return op(txDb);
      });
    },
    async getUserSeasonRank(season, userId, window) {
      const rows = await client.$queryRaw<{ score: number | null; rank: number }[]>`
        WITH user_scores AS (
          SELECT "userId", SUM("amount")::int AS score
          FROM "SeedLedger"
          WHERE "season" = ${season}
            AND "kind" = 'earn'
            AND "rankingEligible" = true
            AND "createdAt" >= ${window.startAt}
            AND "createdAt" < ${window.endAt}
          GROUP BY "userId"
        )
        SELECT
          (SELECT score FROM user_scores WHERE "userId" = ${userId}) AS score,
          (
            SELECT COUNT(*)::int
            FROM user_scores
            WHERE score > (SELECT score FROM user_scores WHERE "userId" = ${userId})
               OR (score = (SELECT score FROM user_scores WHERE "userId" = ${userId}) AND "userId" COLLATE "C" > ${userId})
          ) + 1 AS rank
      `;
      if (rows.length === 0 || rows[0].score === null || rows[0].score <= 0) {
        return { rank: null, score: 0 };
      }
      return { rank: Number(rows[0].rank), score: Number(rows[0].score) };
    },
    async listUnfinalizedSeasons(now: Date) {
      const distinctSeasons = await client.seedLedger.findMany({
        select: { season: true },
        distinct: ['season'],
      });
      const candidateSeasons = new Set<string>(distinctSeasons.map((d) => d.season));
      candidateSeasons.add(rankedSeasonId(now));

      const unfinalized: string[] = [];
      for (const s of candidateSeasons) {
        const window = seasonWindow(s);
        if (now.getTime() >= window.endAt.getTime()) {
          const isFin = await this.isSeasonFinalized(s);
          if (!isFin) {
            unfinalized.push(s);
          }
        }
      }
      return unfinalized.sort();
    },
  };
}

