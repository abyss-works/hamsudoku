import { PrismaClient } from '@prisma/client';
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
    input: { earned: number; season: string; seedLeft: number; elapsedMs: number; suspicious: boolean },
  ): Promise<EndlessSummary>;
  commitEndlessFail(userId: string, stageId: string): Promise<{ streak: StreakRow }>;
  appendEndlessEvent(
    userId: string,
    stageId: string,
    input: { seedLeft: number; elapsedMs: number; verified: boolean; suspicious: boolean; reason?: string },
  ): Promise<void>;
  getEndlessSummary(userId: string): Promise<EndlessSummary>;
}

let nextId = 0;

export function createMemoryDb(): DbPort {
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
      const key = progressKey(userId, stageId);
      const prev = endlessProgress.get(key) ?? { cleared: false, attempts: 0, lastPlayedAt: '' };
      endlessProgress.set(key, { cleared: true, attempts: prev.attempts + 1, lastPlayedAt: new Date().toISOString() });
      wallets.set(userId, balanceOf(userId) + input.earned);
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
        createdAt: new Date().toISOString(),
      });
      return { balance: balanceOf(userId), clearedCount: clearedCountOf(userId), streak: next };
    },
    async commitEndlessFail(userId, stageId) {
      const key = progressKey(userId, stageId);
      const prev = endlessProgress.get(key) ?? { cleared: false, attempts: 0, lastPlayedAt: '' };
      endlessProgress.set(key, { ...prev, attempts: prev.attempts + 1, lastPlayedAt: new Date().toISOString() });
      const s = streakOf(userId);
      const next = { current: 0, best: s.best };
      streaks.set(userId, next);
      return { streak: next };
    },
    async appendEndlessEvent(userId, stageId, input) {
      endlessEvents.push({ userId, stageId, ...input, createdAt: new Date().toISOString() });
    },
    async getEndlessSummary(userId) {
      return { balance: balanceOf(userId), clearedCount: clearedCountOf(userId), streak: streakOf(userId) };
    },
  };
}

const prisma = new PrismaClient();

export function createPrismaDb(): DbPort {
  return {
    async ensureUser(userId: string, email: string | null) {
      await prisma.user.upsert({
        where: { id: userId },
        create: { id: userId, email },
        update: email ? { email } : {},
      });
      await prisma.profile.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
    },
    async listUsers() {
      const [all, profiles] = await Promise.all([prisma.user.findMany(), prisma.profile.findMany()]);
      const withProfile = new Set(profiles.map((p) => p.userId));
      return all.map((r) => ({ userId: r.id, email: r.email, hasProfile: withProfile.has(r.id) }));
    },
    async getNickname(userId: string) {
      const p = await prisma.profile.findUnique({ where: { userId } });
      return p?.nickname ?? null;
    },
    async setNickname(userId: string, nickname: string) {
      await prisma.profile.upsert({
        where: { userId },
        create: { userId, nickname },
        update: { nickname },
      });
    },
    async lookupNicknames(userIds: string[]) {
      const rows = await prisma.profile.findMany({ where: { userId: { in: userIds } } });
      const found = new Map(rows.map((r) => [r.userId, r.nickname] as const));
      return Object.fromEntries(userIds.map((id) => [id, found.get(id) ?? null]));
    },
    async issueAttempt(userId: string, stageCode: string) {
      const a = await prisma.attempt.create({ data: { userId, stageCode } });
      return {
        id: a.id,
        userId: a.userId,
        stageCode: a.stageCode,
        issuedAt: a.issuedAt.toISOString(),
        usedAt: a.usedAt ? a.usedAt.toISOString() : null,
      };
    },
    async findAttempt(key: string) {
      const a = await prisma.attempt.findUnique({ where: { id: key } });
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
      const updated = await prisma.attempt.updateMany({
        where: { id: key, userId, stageCode, usedAt: null },
        data: { usedAt: new Date(nowIso) },
      });
      if (updated.count === 0) return null;
      const a = await prisma.attempt.findUniqueOrThrow({ where: { id: key } });
      return {
        id: a.id,
        userId: a.userId,
        stageCode: a.stageCode,
        issuedAt: a.issuedAt.toISOString(),
        usedAt: a.usedAt ? a.usedAt.toISOString() : null,
      };
    },
    async recordVerified(userId: string, stageCode: string, elapsedSec: number, atIso: string) {
      const prev = await prisma.clearRecord.findUnique({
        where: { userId_stageCode: { userId, stageCode } },
      });
      const merged = mergeClear(
        prev ? { bestElapsedSec: prev.bestElapsedSec, attempts: prev.attempts, lastClearedAt: prev.lastClearedAt.toISOString() } : null,
        elapsedSec,
        atIso,
      );
      await prisma.clearRecord.upsert({
        where: { userId_stageCode: { userId, stageCode } },
        create: { userId, stageCode, bestElapsedSec: merged.bestElapsedSec, attempts: merged.attempts, lastClearedAt: new Date(merged.lastClearedAt) },
        update: { bestElapsedSec: merged.bestElapsedSec, attempts: merged.attempts, lastClearedAt: new Date(merged.lastClearedAt) },
      });
      await prisma.clearEvent.create({
        data: { userId, stageCode, elapsedSec, verified: true, clearedAt: new Date(atIso) },
      });
    },
    async recordUnverified(userId: string, stageCode: string, elapsedSec: number, atIso: string) {
      await prisma.clearEvent.create({
        data: { userId, stageCode, elapsedSec, verified: false, clearedAt: new Date(atIso) },
      });
    },
    async listRecords(userId: string) {
      const rows = await prisma.clearRecord.findMany({ where: { userId } });
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
      await prisma.endlessStage.create({ data: stage });
    },
    async getStage(stageId) {
      const s = await prisma.endlessStage.findUnique({ where: { id: stageId } });
      return s
        ? { id: s.id, size: s.size, regions: s.regions, solution: s.solution, tier: s.tier, seed: s.seed }
        : null;
    },
    async pickUnclearedStage(userId) {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT s.id FROM "EndlessStage" s
        WHERE NOT EXISTS (
          SELECT 1 FROM "EndlessProgress" p
          WHERE p."userId" = ${userId} AND p."stageId" = s.id AND p.cleared = true
        )
        ORDER BY random() LIMIT 1`;
      if (rows.length === 0) return null;
      const s = await prisma.endlessStage.findUniqueOrThrow({ where: { id: rows[0].id } });
      return { id: s.id, size: s.size, regions: s.regions, solution: s.solution, tier: s.tier, seed: s.seed };
    },
    async countStages() {
      return prisma.endlessStage.count();
    },
    async commitEndlessClear(userId, stageId, input) {
      return prisma.$transaction(async (tx) => {
        await tx.endlessProgress.upsert({
          where: { userId_stageId: { userId, stageId } },
          create: { userId, stageId, cleared: true, attempts: 1, lastPlayedAt: new Date() },
          update: { cleared: true, attempts: { increment: 1 }, lastPlayedAt: new Date() },
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
        const clearedCount = await tx.endlessProgress.count({ where: { userId, cleared: true } });
        return { balance: wallet.balance, clearedCount, streak: { current: streak.current, best: streak.best } };
      });
    },
    async commitEndlessFail(userId, stageId) {
      return prisma.$transaction(async (tx) => {
        await tx.endlessProgress.upsert({
          where: { userId_stageId: { userId, stageId } },
          create: { userId, stageId, cleared: false, attempts: 1, lastPlayedAt: new Date() },
          update: { attempts: { increment: 1 }, lastPlayedAt: new Date() },
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
      await prisma.endlessEvent.create({ data: { userId, stageId, ...input } });
    },
    async getEndlessSummary(userId) {
      const [wallet, clearedCount, streak] = await Promise.all([
        prisma.seedWallet.findUnique({ where: { userId } }),
        prisma.endlessProgress.count({ where: { userId, cleared: true } }),
        prisma.endlessStreak.findUnique({ where: { userId } }),
      ]);
      return {
        balance: wallet?.balance ?? 0,
        clearedCount,
        streak: { current: streak?.current ?? 0, best: streak?.best ?? 0 },
      };
    },
  };
}
