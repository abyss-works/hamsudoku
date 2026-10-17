import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const attempts = pgTable(
  'Attempt',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: text('userId').notNull(),
    stageCode: text('stageCode').notNull(),
    issuedAt: timestamp('issuedAt', { precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    usedAt: timestamp('usedAt', { precision: 3, mode: 'date' }),
  },
  (table) => [index('Attempt_userId_idx').on(table.userId)],
).enableRLS();
