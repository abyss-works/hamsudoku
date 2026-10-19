import { attachDatabasePool } from '@vercel/functions';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
import { describeDbError } from './errors';

/** store·queries 함수가 받는 실행 객체. 풀 기반 db와 트랜잭션 연결 모두 이 타입이다. */
export type Executor = NodePgDatabase;

export interface Database {
  db: Executor;
  pool: Pool;
  /** 연결 하나에서 BEGIN·COMMIT·ROLLBACK을 수행하고 어떤 실패에서도 연결을 풀에 반환한다. */
  withTransaction<T>(work: (tx: Executor) => Promise<T>): Promise<T>;
  /** 연결을 얻어 단순 쿼리를 실행한다. 연결이나 실행이 실패하면 오류를 전달한다. */
  checkConnection(): Promise<void>;
}

export function createDatabase(config: PoolConfig): Database {
  const pool = new Pool(config);
  // 유휴 연결의 오류는 풀이 연결을 폐기한다. 프로세스 종료를 막고 정제된 요약만 남긴다.
  pool.on('error', (error) => {
    console.warn('Database pool client error', describeDbError(error));
  });

  async function withTransaction<T>(work: (tx: Executor) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('begin');
    } catch (error) {
      // 상태를 알 수 없는 연결은 재사용하지 않고 폐기한다.
      client.release(error instanceof Error ? error : true);
      throw error;
    }
    try {
      const result = await work(drizzle({ client }));
      // 작업이 오류를 삼켜 트랜잭션이 중단된 상태면 COMMIT은 ROLLBACK으로 끝난다. 이를 성공으로 반환하지 않는다.
      const committed = await client.query('commit');
      if (committed.command === 'ROLLBACK') throw new Error('Transaction was rolled back instead of committed');
      client.release();
      return result;
    } catch (error) {
      try {
        await client.query('rollback');
        client.release();
      } catch (rollbackError) {
        client.release(rollbackError instanceof Error ? rollbackError : true);
      }
      throw error;
    }
  }

  async function checkConnection(): Promise<void> {
    await pool.query('select 1');
  }

  return { db: drizzle({ client: pool }), pool, withTransaction, checkConnection };
}

const globalForDatabase = globalThis as unknown as { hamsudokuDatabase?: Database };

function createAppDatabase(): Database {
  const database = createDatabase({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000,
  });
  // Vercel 함수가 유휴 연결을 정리한 뒤 일시 중지되도록 풀을 등록한다. Vercel 밖에서는 동작하지 않는다.
  attachDatabasePool(database.pool);
  return database;
}

const database = globalForDatabase.hamsudokuDatabase ?? createAppDatabase();
if (process.env.NODE_ENV !== 'production') globalForDatabase.hamsudokuDatabase = database;

export const db = database.db;
export const withTransaction = database.withTransaction;
export const checkConnection = database.checkConnection;
