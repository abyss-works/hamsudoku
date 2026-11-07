import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { inject } from 'vitest';
import { APP_PASSWORD, APP_ROLE, STATEMENT_TIMEOUT, TEMPLATE_DATABASE } from './config';

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

/** 애플리케이션 역할로 접속하는 데이터베이스 주소. */
function appUrl(database: string): string {
  const url = new URL(inject('dbAdminUrl'));
  url.pathname = `/${database}`;
  url.username = APP_ROLE;
  url.password = APP_PASSWORD;
  return url.toString();
}

/** 마이그레이션 직후 상태의 원본을 복제해 독립된 데이터베이스를 만든다. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `test_${randomUUID().replaceAll('-', '')}`;
  await runAdmin(`create database "${name}" template "${TEMPLATE_DATABASE}" owner "${APP_ROLE}"`);
  // 데이터베이스 단위 설정은 복제되지 않으므로 생성 후 지정한다.
  await runAdmin(`alter database "${name}" set statement_timeout = '${STATEMENT_TIMEOUT}'`);

  return {
    url: appUrl(name),
    drop: () => runAdmin(`drop database if exists "${name}" with (force)`),
  };
}

/** 아무 마이그레이션도 적용하지 않은 빈 데이터베이스. 스키마 생성 경로를 비교할 때 쓴다. */
export async function createEmptyDatabase(): Promise<TestDatabase> {
  const name = `empty_${randomUUID().replaceAll('-', '')}`;
  await runAdmin(`create database "${name}" owner "${APP_ROLE}"`);
  await runAdmin(`alter database "${name}" set statement_timeout = '${STATEMENT_TIMEOUT}'`);

  return {
    url: appUrl(name),
    drop: () => runAdmin(`drop database if exists "${name}" with (force)`),
  };
}
