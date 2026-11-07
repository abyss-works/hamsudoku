import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createAuth } from '../src/server/identity/createAuth';
import { createEmptyDatabase, createTestDatabase, type TestDatabase } from './dbTest/testDatabase';
import { importFromSupabase, PUBLIC_TABLES } from './import-from-supabase';

const PASSWORD = 'hamster-pass-1';
const MAIL_ID = '11111111-1111-4111-8111-111111111111';
const UNCONFIRMED_ID = '22222222-2222-4222-8222-222222222222';
const ANON_ID = '33333333-3333-4333-8333-333333333333';

let source: TestDatabase;
let target: TestDatabase;
let sourcePool: Pool;
let targetPool: Pool;

/** 소스 역할 DB의 public 스키마는 마이그레이션 0000~0005로 만든다. */
async function applyPublicMigrations(pool: Pool) {
  const journal = JSON.parse(readFileSync(join(process.cwd(), 'drizzle/meta/_journal.json'), 'utf8')) as {
    entries: { tag: string }[];
  };
  for (const { tag } of journal.entries.filter((e) => e.tag < '0006')) {
    const sql = readFileSync(join(process.cwd(), 'drizzle', `${tag}.sql`), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) await pool.query(statement);
  }
}

async function seedSource(pool: Pool) {
  await applyPublicMigrations(pool);
  // Supabase auth 스키마 중 이관이 읽는 열만 갖춘 최소 형태.
  await pool.query(`
    create schema auth;
    create table auth.users (
      id uuid primary key, email varchar(255), encrypted_password varchar(255), email_confirmed_at timestamptz,
      is_anonymous boolean not null default false, created_at timestamptz, updated_at timestamptz);
    create table auth.identities (id uuid primary key, user_id uuid not null, provider text not null)`);
  const hash = bcrypt.hashSync(PASSWORD, '$2a$10$abcdefghijklmnopqrstuu');
  await pool.query(
    `insert into auth.users values
      ($1, 'Legacy@Example.com', $4, '2026-01-02 03:04:05.123456+00', false, '2026-01-01 00:00:00.654321+00', '2026-01-03 00:00:00+00'),
      ($2, 'pending@example.com', $4, null, false, '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
      ($3, null, '', null, true, '2026-02-01 00:00:00+00', '2026-02-02 00:00:00+00')`,
    [MAIL_ID, UNCONFIRMED_ID, ANON_ID, hash],
  );
  await pool.query(`insert into auth.identities values (gen_random_uuid(), $1, 'email')`, [MAIL_ID]);
  await pool.query(`
    insert into "User" (id, email) values ('${MAIL_ID}', null), ('${ANON_ID}', null);
    insert into "Profile" ("userId", nickname, "updatedAt") values ('${MAIL_ID}', 'ham', now());
    insert into "SeedWallet" ("userId", balance) values ('${MAIL_ID}', 7);
    insert into "EndlessEvent" ("userId", "stageId", "seedLeft", "elapsedMs", verified) values ('${MAIL_ID}', 's1', 3, 100, true);
    insert into "EndlessPlayLog" ("attemptId", "userId", "stageId", outcome, accepted, "serverElapsedMs", events)
      values ('a1', '${MAIL_ID}', 's1', 'clear', true, 100, '[{"t":1}]'::jsonb);
    insert into "EndlessSupplyJob" (id, "policyVersion", "seedStart", "seedEnd", "updatedAt") values ('j1', 'v1', 0, 9, now());
    insert into "EndlessSupplyChunk" (id, "jobId", "chunkIndex") values ('c1', 'j1', 0);
    insert into "SeasonFinalization" (season, "startAt", "endAt") values ('2026-01', now(), now());
    insert into "SeasonRankResult" (season, "userId", score, rank) values ('2026-01', '${MAIL_ID}', 5, 1);
    insert into "EndlessStage" (id, size, regions, solution, tier, seed, "clearTotalMs") values ('s1', 4, 'r', 's', 1, 7, 9007199254740993)`);
}

beforeEach(async () => {
  source = await createEmptyDatabase();
  target = await createTestDatabase();
  sourcePool = new Pool({ connectionString: source.url, max: 2 });
  targetPool = new Pool({ connectionString: target.url, max: 2 });
  await seedSource(sourcePool);
});

afterEach(async () => {
  await sourcePool?.end();
  await targetPool?.end();
  await source?.drop();
  await target?.drop();
});

const run = (dryRun = false) => importFromSupabase({ sourceUrl: source.url, targetUrl: target.url, dryRun });

async function count(pool: Pool, table: string) {
  return Number((await pool.query(`select count(*) from ${table}`)).rows[0].count);
}

describe('importFromSupabase', () => {
  it('public 표와 auth 사용자를 옮기고 표별 행 수가 소스와 같다', async () => {
    const result = await run();

    for (const table of PUBLIC_TABLES) {
      expect(await count(targetPool, `"${table}"`)).toBe(await count(sourcePool, `"${table}"`));
    }
    expect(await count(targetPool, 'auth.users')).toBe(3);
    expect(await count(targetPool, 'auth.accounts')).toBe(2);
    expect(result.tables['auth.users']).toEqual({ source: 3, target: 3 });
    expect(result.tables['auth.accounts']).toEqual({ source: 2, target: 2 });
    expect(result.tables.Profile).toEqual({ source: 1, target: 1 });
  });

  it('값과 정밀도를 보존한다', async () => {
    await run();

    const stage = await targetPool.query(`select "clearTotalMs"::text as ms from "EndlessStage"`);
    expect(stage.rows[0].ms).toBe('9007199254740993');
    const log = await targetPool.query(`select events from "EndlessPlayLog"`);
    expect(log.rows[0].events).toEqual([{ t: 1 }]);
    const user = await targetPool.query(
      `select email, email_verified, is_anonymous, to_char(created_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') as created, updated_at
         from auth.users where id = $1`,
      [MAIL_ID],
    );
    expect(user.rows[0]).toMatchObject({
      email: 'legacy@example.com',
      email_verified: true,
      is_anonymous: false,
      created: '2026-01-01 00:00:00.654321',
    });
    expect(user.rows[0].updated_at.toISOString()).toBe('2026-01-03T00:00:00.000Z');
  });

  it('이메일 계정은 credential 계정을 만들고 미확인 이메일은 email_verified가 false다', async () => {
    await run();

    const accounts = await targetPool.query(
      `select user_id, account_id, provider_id from auth.accounts order by user_id`,
    );
    expect(accounts.rows).toEqual([
      { user_id: MAIL_ID, account_id: MAIL_ID, provider_id: 'credential' },
      { user_id: UNCONFIRMED_ID, account_id: UNCONFIRMED_ID, provider_id: 'credential' },
    ]);
    const pending = await targetPool.query(`select email_verified from auth.users where id = $1`, [UNCONFIRMED_ID]);
    expect(pending.rows[0].email_verified).toBe(false);
  });

  it('익명 계정은 자리표시 이메일의 익명 사용자이고 계정이 없다', async () => {
    await run();

    const anon = await targetPool.query(`select email, is_anonymous, email_verified from auth.users where id = $1`, [ANON_ID]);
    expect(anon.rows[0]).toEqual({ email: `${ANON_ID}@anonymous.invalid`, is_anonymous: true, email_verified: false });
    expect(await count(targetPool, `auth.accounts where user_id = '${ANON_ID}'`)).toBe(0);
  });

  it('이관한 bcrypt 비밀번호로 Better Auth 로그인에 성공한다', async () => {
    await run();
    const auth = createAuth({
      executor: drizzle({ client: targetPool }),
      secret: 'test-secret-test-secret-test-secret',
      baseURL: 'http://app.test',
      mail: { async sendPasswordReset() {} },
    });

    const { response } = await auth.api.signInEmail({
      headers: new Headers(),
      body: { email: 'legacy@example.com', password: PASSWORD },
      returnHeaders: true,
    });
    expect(response.user.id).toBe(MAIL_ID);
    await expect(
      auth.api.signInEmail({ headers: new Headers(), body: { email: 'legacy@example.com', password: 'wrong-pass-1' } }),
    ).rejects.toMatchObject({ body: { code: 'INVALID_EMAIL_OR_PASSWORD' } });
  });

  it('--dry-run은 대상에 쓰지 않고 소스 행 수와 매핑 결과 수를 돌려준다', async () => {
    const result = await run(true);

    expect(result.dryRun).toBe(true);
    expect(result.tables['auth.users']).toEqual({ source: 3 });
    expect(result.tables['auth.accounts']).toEqual({ source: 2 });
    expect(result.tables.Profile).toEqual({ source: 1 });
    expect(await count(targetPool, 'auth.users')).toBe(0);
    expect(await count(targetPool, '"Profile"')).toBe(0);
  });

  it('대상 public 표가 비어 있지 않으면 아무것도 쓰지 않고 실패한다', async () => {
    await targetPool.query(`insert into "SeedWallet" ("userId", balance) values ('x', 1)`);

    await expect(run()).rejects.toThrow(/비어 있지 않/);
    expect(await count(targetPool, '"Profile"')).toBe(0);
    expect(await count(targetPool, 'auth.users')).toBe(0);
    expect(await count(targetPool, '"SeedWallet"')).toBe(1);
  });

  it('대상 auth 표가 비어 있지 않으면 실패한다', async () => {
    await targetPool.query(
      `insert into auth.users (id, email) values ('${randomUUID()}', 'existing@example.com')`,
    );

    await expect(run()).rejects.toThrow(/비어 있지 않/);
    expect(await count(targetPool, '"Profile"')).toBe(0);
  });

  it('두 번째 실행은 첫 실행 뒤 대상이 비어 있지 않아 실패한다', async () => {
    await run();
    await expect(run()).rejects.toThrow(/비어 있지 않/);
  });

  it('행 수가 소스와 다르면 롤백하고 실패한다', async () => {
    // 삽입된 행을 조용히 버리는 트리거로 쓰기 손실을 재현한다.
    await targetPool.query(`
      create function drop_row() returns trigger language plpgsql as $$ begin return null; end $$;
      create trigger lose_rows before insert on "Profile" for each row execute function drop_row()`);

    await expect(run()).rejects.toThrow(/행 수/);
    expect(await count(targetPool, 'auth.users')).toBe(0);
    expect(await count(targetPool, '"SeedWallet"')).toBe(0);
  });

  it('소스에 이메일이 없는 비익명 사용자가 있으면 실패하고 쓰지 않는다', async () => {
    await sourcePool.query(
      `insert into auth.users values ('${randomUUID()}', null, '', null, false, now(), now())`,
    );

    await expect(run()).rejects.toThrow();
    expect(await count(targetPool, 'auth.users')).toBe(0);
  });
});
