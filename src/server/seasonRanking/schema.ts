import { sql } from 'drizzle-orm';
import { boolean, foreignKey, index, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const seasonFinalizations = pgTable(
  'SeasonFinalization',
  {
    season: text('season').primaryKey(),
    startAt: timestamp('startAt', { precision: 3, mode: 'date' }).notNull(),
    endAt: timestamp('endAt', { precision: 3, mode: 'date' }).notNull(),
    finalizedAt: timestamp('finalizedAt', { precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    status: text('status').default('finalized').notNull(),
  },
  (table) => [index('SeasonFinalization_status_idx').on(table.status)],
).enableRLS();

export const seasonRankResults = pgTable(
  'SeasonRankResult',
  {
    season: text('season').notNull(),
    userId: text('userId').notNull(),
    score: integer('score').notNull(),
    rank: integer('rank').notNull(),
  },
  (table) => [
    primaryKey({ name: 'SeasonRankResult_pkey', columns: [table.season, table.userId] }),
    index('SeasonRankResult_season_rank_idx').on(table.season, table.rank),
    index('SeasonRankResult_userId_idx').on(table.userId),
    foreignKey({ name: 'SeasonRankResult_season_fkey', columns: [table.season], foreignColumns: [seasonFinalizations.season] })
      .onDelete('cascade')
      .onUpdate('cascade'),
  ],
).enableRLS();

export const seedLedger = pgTable(
  'SeedLedger',
  {
    id: text('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: text('userId').notNull(),
    kind: text('kind').notNull(),
    amount: integer('amount').notNull(),
    stageId: text('stageId'),
    season: text('season').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    rankingEligible: boolean('rankingEligible').default(true).notNull(),
  },
  (table) => [
    index('SeedLedger_season_kind_idx').on(table.season, table.kind),
    index('SeedLedger_userId_season_idx').on(table.userId, table.season),
    index('SeedLedger_season_rankingEligible_idx').on(table.season, table.rankingEligible),
  ],
).enableRLS();
