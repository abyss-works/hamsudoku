import { sql } from 'drizzle-orm';
import { boolean, index, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const clearRecords = pgTable(
  'ClearRecord',
  {
    userId: text('userId').notNull(),
    stageCode: text('stageCode').notNull(),
    bestElapsedSec: integer('bestElapsedSec'),
    attempts: integer('attempts').default(0).notNull(),
    lastClearedAt: timestamp('lastClearedAt', { precision: 3, mode: 'date' }).notNull(),
    // 기본값이 없으므로 쓰기마다 명시한다.
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
  },
  (table) => [
    primaryKey({ name: 'ClearRecord_pkey', columns: [table.userId, table.stageCode] }),
    index('ClearRecord_userId_idx').on(table.userId),
  ],
).enableRLS();

export const clearEvents = pgTable(
  'ClearEvent',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: text('userId').notNull(),
    stageCode: text('stageCode').notNull(),
    elapsedSec: integer('elapsedSec').notNull(),
    verified: boolean('verified').default(true).notNull(),
    clearedAt: timestamp('clearedAt', { precision: 3, mode: 'date' }).notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => [index('ClearEvent_userId_stageCode_idx').on(table.userId, table.stageCode)],
).enableRLS();
