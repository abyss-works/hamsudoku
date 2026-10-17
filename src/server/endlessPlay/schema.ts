import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const endlessProgress = pgTable(
  'EndlessProgress',
  {
    userId: text('userId').notNull(),
    stageId: text('stageId').notNull(),
    cleared: boolean('cleared').default(false).notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lastPlayedAt: timestamp('lastPlayedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (table) => [
    primaryKey({ name: 'EndlessProgress_pkey', columns: [table.userId, table.stageId] }),
    index('EndlessProgress_userId_cleared_idx').on(table.userId, table.cleared),
  ],
).enableRLS();

export const seedWallets = pgTable('SeedWallet', {
  userId: text('userId').primaryKey(),
  balance: integer('balance').default(0).notNull(),
}).enableRLS();

export const endlessStreaks = pgTable('EndlessStreak', {
  userId: text('userId').primaryKey(),
  current: integer('current').default(0).notNull(),
  best: integer('best').default(0).notNull(),
}).enableRLS();

export const endlessEvents = pgTable(
  'EndlessEvent',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: text('userId').notNull(),
    stageId: text('stageId').notNull(),
    seedLeft: integer('seedLeft').notNull(),
    elapsedMs: integer('elapsedMs').notNull(),
    verified: boolean('verified').notNull(),
    suspicious: boolean('suspicious').default(false).notNull(),
    reason: text('reason'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index('EndlessEvent_userId_stageId_idx').on(table.userId, table.stageId),
    index('EndlessEvent_userId_createdAt_idx').on(table.userId, table.createdAt),
  ],
).enableRLS();

/**
 * 클리어 제출·실패 보고의 플레이 기록과 사후 감사 결과. 소모한 입장 키마다 한 행이다.
 * events는 형식이 맞는 기록의 이벤트 원문이고, 저장하지 않은 사유는 logError에 둔다.
 */
export const endlessPlayLogs = pgTable(
  'EndlessPlayLog',
  {
    attemptId: text('attemptId').primaryKey(),
    userId: text('userId').notNull(),
    stageId: text('stageId').notNull(),
    outcome: text('outcome').notNull(),
    accepted: boolean('accepted').notNull(),
    reason: text('reason'),
    claimedSeedLeft: integer('claimedSeedLeft'),
    serverElapsedMs: integer('serverElapsedMs').notNull(),
    logVersion: integer('logVersion'),
    events: jsonb('events'),
    logError: text('logError'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    auditedAt: timestamp('auditedAt', { precision: 3, mode: 'date' }),
    audit: jsonb('audit'),
  },
  (table) => [index('EndlessPlayLog_unaudited_createdAt_idx').on(table.createdAt).where(sql`"auditedAt" is null`)],
).enableRLS();
