import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from './testDatabase';

const APP_TABLES = [
  'Attempt',
  'ClearEvent',
  'ClearRecord',
  'EndlessEvent',
  'EndlessProgress',
  'EndlessStage',
  'EndlessStreak',
  'EndlessSupplyChunk',
  'EndlessSupplyJob',
  'Profile',
  'SeasonFinalization',
  'SeasonRankResult',
  'SeedLedger',
  'SeedWallet',
  'User',
];

async function query<T>(url: string, sql: string): Promise<T[]> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(sql)).rows as T[];
  } finally {
    await client.end();
  }
}

describe('테스트 데이터베이스', () => {
  let first: TestDatabase;
  let second: TestDatabase;

  beforeAll(async () => {
    first = await createTestDatabase();
    second = await createTestDatabase();
  });

  afterAll(async () => {
    await first?.drop();
    await second?.drop();
  });

  it('마이그레이션 적용 결과의 모든 애플리케이션 테이블이 RLS 활성 상태로 존재한다', async () => {
    const rows = await query<{ tablename: string; rowsecurity: boolean }>(
      first.url,
      "select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename",
    );
    expect(rows.map((r) => r.tablename)).toEqual(APP_TABLES);
    expect(rows.every((r) => r.rowsecurity)).toBe(true);
  });

  it('호스팅 환경과 같은 접속 역할과 세션 설정을 사용한다', async () => {
    const [row] = await query<{ user: string; super: boolean; bypass: boolean; timeout: string; tz: string; iso: string }>(
      first.url,
      `select current_user as user, r.rolsuper as super, r.rolbypassrls as bypass,
              current_setting('statement_timeout') as timeout, current_setting('TimeZone') as tz,
              current_setting('default_transaction_isolation') as iso
         from pg_roles r where r.rolname = current_user`,
    );
    expect(row).toEqual({ user: 'postgres', super: false, bypass: true, timeout: '2min', tz: 'UTC', iso: 'read committed' });
  });

  it('테스트 데이터베이스마다 데이터가 격리된다', async () => {
    await query(first.url, `insert into "User" (id, email) values ('isolation-user', null)`);
    const inFirst = await query<{ n: number }>(first.url, `select count(*)::int as n from "User"`);
    const inSecond = await query<{ n: number }>(second.url, `select count(*)::int as n from "User"`);
    expect(inFirst[0].n).toBe(1);
    expect(inSecond[0].n).toBe(0);
  });
});
