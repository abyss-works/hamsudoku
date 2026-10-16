import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createDatabase, type Database, type Executor } from '../../src/server/db/client';
import { createTestDatabase, type TestDatabase } from './testDatabase';

// store·queries 함수를 실제 데이터베이스로 검증하는 테스트 도구. 파일마다 독립 데이터베이스를 쓰고
// 각 테스트 전에 모든 테이블을 비운다.

export interface StoreDatabase {
  readonly db: Executor;
  withTransaction<T>(work: (tx: Executor) => Promise<T>): Promise<T>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export function useStoreDatabase(): StoreDatabase {
  let testDb: TestDatabase;
  let database: Database;

  beforeAll(async () => {
    testDb = await createTestDatabase();
    database = createDatabase({ connectionString: testDb.url, max: 4 });
  });

  afterAll(async () => {
    await database?.pool.end();
    await testDb?.drop();
  });

  beforeEach(async () => {
    const { rows } = await database.pool.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public'",
    );
    await database.pool.query(`truncate table ${rows.map((r) => `"${r.tablename}"`).join(', ')} cascade`);
  });

  return {
    get db() {
      return database.db;
    },
    withTransaction: (work) => database.withTransaction(work),
    async query<T>(sql: string, params: unknown[] = []) {
      return (await database.pool.query(sql, params)).rows as T[];
    },
  };
}
