import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../../../prisma/generated/prisma/client';
import { mergeClear } from '../../shared/merge';
import { rankedSeasonId, rankingFrozen, seasonWindow } from '../../shared/season';
import { clampBigInt64, clampInt32 } from './numeric';
import type { DbPort } from './port';

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
        // 시즌 advisory lock으로 트랜잭션 내 직렬화 보장
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('season:' || ${input.season}))`;
        // 행 레벨 락으로 동시 클리어 시 가산 손실 방지
        if (typeof (tx as any).$queryRaw === 'function') {
          await tx.$queryRaw`SELECT id FROM "EndlessStage" WHERE id = ${stageId} FOR UPDATE`;
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

        const stageRow = tx.endlessStage ? await tx.endlessStage.findUnique({ where: { id: stageId } }) : null;
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
      const header = await client.seasonFinalization.findUnique({ where: { season } });
      if (header?.status !== 'finalized') return null;
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
        // 행 레벨 락으로 동시 claim 요청 직렬화
        if (typeof (tx as any).$queryRaw === 'function') {
          await tx.$queryRaw`SELECT id FROM "EndlessSupplyJob" WHERE id = ${jobId} FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM "EndlessSupplyChunk" WHERE "jobId" = ${jobId} AND "chunkIndex" = ${chunkIndex} FOR UPDATE`;
        }

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
        const claimToken = newLease.toISOString();
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
          claimToken,
          stageCount: chunk.stageCount,
          seedStart: job.seedStart,
          targetCount: job.targetCount,
        };
      });
    },
    async insertSupplyBatch(jobId, chunkIndex, stageRows, completedAtIso, claimToken) {
      return client.$transaction(async (tx) => {
        // 행 레벨 락 획득
        if (typeof (tx as any).$queryRaw === 'function') {
          await tx.$queryRaw`SELECT id FROM "EndlessSupplyJob" WHERE id = ${jobId} FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM "EndlessSupplyChunk" WHERE "jobId" = ${jobId} AND "chunkIndex" = ${chunkIndex} FOR UPDATE`;
        }

        const completedDate = new Date(completedAtIso);
        const job = await tx.endlessSupplyJob.findUnique({ where: { id: jobId } });
        const chunk = await tx.endlessSupplyChunk.findUnique({
          where: { jobId_chunkIndex: { jobId, chunkIndex } },
        });
        if (!job || !chunk) return false;

        // 완료된 청크는 중복 적재 불가
        if (chunk.status === 'completed') {
          return false;
        }

        // fencing token 및 lease 소유권 검증
        if (claimToken) {
          if (!job.leaseExpiresAt || new Date(job.leaseExpiresAt).getTime() !== new Date(claimToken).getTime()) {
            return false;
          }
          if (completedDate.getTime() > new Date(job.leaseExpiresAt).getTime()) {
            return false;
          }
        }

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
    async failSupplyChunk(jobId, chunkIndex, _reason, claimToken) {
      await client.$transaction(async (tx) => {
        if (typeof (tx as any).$queryRaw === 'function') {
          await tx.$queryRaw`SELECT id FROM "EndlessSupplyJob" WHERE id = ${jobId} FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM "EndlessSupplyChunk" WHERE "jobId" = ${jobId} AND "chunkIndex" = ${chunkIndex} FOR UPDATE`;
        }
        const chunk = await tx.endlessSupplyChunk.findUnique({
          where: { jobId_chunkIndex: { jobId, chunkIndex } },
        });
        const job = await tx.endlessSupplyJob.findUnique({ where: { id: jobId } });
        if (!chunk || !job) return;

        // 완료된 작업은 오래된 실패 호출이 failed로 바꾸지 못한다
        if (chunk.status === 'completed' || job.status === 'completed') {
          return;
        }

        // fencing token 검증: 이전 만료 실행자가 신규 실행자 상태를 덮어쓰지 못하도록 차단
        if (claimToken) {
          if (!job.leaseExpiresAt || new Date(job.leaseExpiresAt).getTime() !== new Date(claimToken).getTime()) {
            return;
          }
        }

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
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('endless_supply_lock'))`;

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

