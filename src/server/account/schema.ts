import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('User', {
  id: text('id').primaryKey(),
  email: text('email'),
  createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}).enableRLS();

export const profiles = pgTable('Profile', {
  userId: text('userId').primaryKey(),
  nickname: text('nickname'),
  createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  // 기본값이 없으므로 쓰기마다 명시한다.
  updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' }).notNull(),
}).enableRLS();
