import { sql } from 'drizzle-orm';
import { bigint, foreignKey, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const endlessStages = pgTable(
  'EndlessStage',
  {
    id: text('id').primaryKey(),
    size: integer('size').notNull(),
    regions: text('regions').notNull(),
    solution: text('solution').notNull(),
    tier: integer('tier').notNull(),
    seed: integer('seed').notNull(),
    plays: integer('plays').default(0).notNull(),
    clears: integer('clears').default(0).notNull(),
    avgClearMs: integer('avgClearMs').default(0).notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    clearTotalMs: bigint('clearTotalMs', { mode: 'bigint' }).default(sql`0`).notNull(),
  },
  (table) => [index('EndlessStage_clears_idx').on(table.clears)],
).enableRLS();

export const endlessSupplyJobs = pgTable(
  'EndlessSupplyJob',
  {
    id: text('id').primaryKey(),
    policyVersion: text('policyVersion').notNull(),
    seedStart: integer('seedStart').notNull(),
    seedEnd: integer('seedEnd').notNull(),
    targetCount: integer('targetCount').default(10).notNull(),
    status: text('status').default('pending').notNull(),
    leaseExpiresAt: timestamp('leaseExpiresAt', { precision: 3, mode: 'date' }),
    lastSuccessAt: timestamp('lastSuccessAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    // 기본값이 없으므로 쓰기마다 명시한다.
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (table) => [index('EndlessSupplyJob_status_leaseExpiresAt_idx').on(table.status, table.leaseExpiresAt)],
).enableRLS();

export const endlessSupplyChunks = pgTable(
  'EndlessSupplyChunk',
  {
    id: text('id').primaryKey(),
    jobId: text('jobId').notNull(),
    chunkIndex: integer('chunkIndex').notNull(),
    status: text('status').default('pending').notNull(),
    stageCount: integer('stageCount').default(0).notNull(),
    completedAt: timestamp('completedAt', { precision: 3, mode: 'date' }),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [
    index('EndlessSupplyChunk_jobId_idx').on(table.jobId),
    uniqueIndex('EndlessSupplyChunk_jobId_chunkIndex_key').on(table.jobId, table.chunkIndex),
    foreignKey({ name: 'EndlessSupplyChunk_jobId_fkey', columns: [table.jobId], foreignColumns: [endlessSupplyJobs.id] })
      .onDelete('cascade')
      .onUpdate('cascade'),
  ],
).enableRLS();
