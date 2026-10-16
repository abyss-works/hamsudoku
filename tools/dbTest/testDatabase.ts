import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { inject } from 'vitest';
import { STATEMENT_TIMEOUT, TEMPLATE_DATABASE } from './config';

export interface TestDatabase {
  url: string;
  drop(): Promise<void>;
}

async function runAdmin(sql: string): Promise<void> {
  const admin = new Client({ connectionString: inject('dbAdminUrl') });
  await admin.connect();
  try {
    await admin.query(sql);
  } finally {
    await admin.end();
  }
}

/** 마이그레이션 직후 상태의 원본을 복제해 독립된 데이터베이스를 만든다. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `test_${randomUUID().replaceAll('-', '')}`;
  await runAdmin(`create database "${name}" template "${TEMPLATE_DATABASE}"`);
  // 데이터베이스 단위 설정은 복제되지 않으므로 생성 후 지정한다.
  await runAdmin(`alter database "${name}" set statement_timeout = '${STATEMENT_TIMEOUT}'`);

  const url = new URL(inject('dbAdminUrl'));
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    drop: () => runAdmin(`drop database if exists "${name}" with (force)`),
  };
}
