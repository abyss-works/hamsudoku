import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

// 테스트 DB의 스키마는 Drizzle 마이그레이션으로 만든다.

const DRIZZLE_MIGRATIONS = join(process.cwd(), 'drizzle');

/** Drizzle migrator로 마이그레이션을 적용한다. 기록 테이블의 마지막 시각 이후 항목만 적용된다. */
export async function applyDrizzleMigrations(client: Client): Promise<void> {
  await migrate(drizzle({ client }), { migrationsFolder: DRIZZLE_MIGRATIONS });
}
