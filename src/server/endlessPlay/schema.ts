import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

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
