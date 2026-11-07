import { boolean, index, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

// 인증 라이브러리가 관리하는 표. 애플리케이션의 User 표와 구분하려고 auth 스키마에 둔다.
// 속성 이름은 라이브러리의 필드 이름이고 열 이름은 snake_case다. id는 text이며 기존 사용자 id(UUID 문자열)를 그대로 담는다.
const authSchema = pgSchema('auth');

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
};

export const authUsers = authSchema
  .table('users', {
    id: text('id').primaryKey(),
    name: text('name').default('').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    isAnonymous: boolean('is_anonymous').default(false).notNull(),
    ...timestamps,
  })
  .enableRLS();

export const authSessions = authSchema
  .table(
    'sessions',
    {
      id: text('id').primaryKey(),
      userId: text('user_id')
        .notNull()
        .references(() => authUsers.id, { onDelete: 'cascade' }),
      token: text('token').notNull().unique(),
      expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
      ipAddress: text('ip_address'),
      userAgent: text('user_agent'),
      ...timestamps,
    },
    (table) => [index('sessions_user_id_idx').on(table.userId)],
  )
  .enableRLS();

export const authAccounts = authSchema
  .table(
    'accounts',
    {
      id: text('id').primaryKey(),
      userId: text('user_id')
        .notNull()
        .references(() => authUsers.id, { onDelete: 'cascade' }),
      accountId: text('account_id').notNull(),
      providerId: text('provider_id').notNull(),
      accessToken: text('access_token'),
      refreshToken: text('refresh_token'),
      idToken: text('id_token'),
      accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true, mode: 'date' }),
      refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true, mode: 'date' }),
      scope: text('scope'),
      password: text('password'),
      ...timestamps,
    },
    (table) => [index('accounts_user_id_idx').on(table.userId)],
  )
  .enableRLS();

export const authVerifications = authSchema
  .table(
    'verifications',
    {
      id: text('id').primaryKey(),
      identifier: text('identifier').notNull(),
      value: text('value').notNull(),
      expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
      ...timestamps,
    },
    (table) => [index('verifications_identifier_idx').on(table.identifier)],
  )
  .enableRLS();

/** 인증 라이브러리의 Drizzle 어댑터가 모델 이름(user·session·account·verification)으로 찾는 표 모음. */
export const authSchemaTables = {
  user: authUsers,
  session: authSessions,
  account: authAccounts,
  verification: authVerifications,
};
