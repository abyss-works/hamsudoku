import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import type { TestProject } from 'vitest/node';
import { DB_TEST_IMAGE, TEMPLATE_DATABASE } from './config';

declare module 'vitest' {
  export interface ProvidedContext {
    dbAdminUrl: string;
  }
}

const PASSWORD = 'test-only-password';

async function waitForDatabase(url: string): Promise<void> {
  const deadline = Date.now() + 120_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    const client = new Client({ connectionString: url });
    try {
      await client.connect();
      // 이미지 초기화 스크립트가 만드는 Supabase 역할이 보일 때 초기화가 끝난 것으로 본다.
      const { rowCount } = await client.query("select 1 from pg_roles where rolname = 'authenticated'");
      if (rowCount === 1) return;
    } catch (e) {
      lastError = e;
    } finally {
      await client.end().catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`테스트 데이터베이스가 준비되지 않았습니다: ${String(lastError)}`);
}

function migrationSql(): string[] {
  const root = join(process.cwd(), 'prisma', 'migrations');
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(join(root, name, 'migration.sql'), 'utf-8'));
}

async function buildTemplate(adminUrl: string): Promise<void> {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`create database "${TEMPLATE_DATABASE}"`);
  } finally {
    await admin.end();
  }

  const url = new URL(adminUrl);
  url.pathname = `/${TEMPLATE_DATABASE}`;
  const template = new Client({ connectionString: url.toString() });
  await template.connect();
  try {
    for (const sql of migrationSql()) await template.query(sql);
    // 호스팅 환경은 운영 절차로 모든 public 테이블의 RLS를 정책 없이 활성화한다.
    await template.query(`
      do $$
      declare t record;
      begin
        for t in select tablename from pg_tables where schemaname = 'public' loop
          execute format('alter table public.%I enable row level security', t.tablename);
        end loop;
      end $$;
    `);
  } finally {
    await template.end();
  }
}

export default async function setup(project: TestProject) {
  const container: StartedTestContainer = await new GenericContainer(DB_TEST_IMAGE)
    .withEnvironment({ POSTGRES_PASSWORD: PASSWORD })
    .withExposedPorts(5432)
    .start();

  const adminUrl = `postgresql://postgres:${PASSWORD}@${container.getHost()}:${container.getMappedPort(5432)}/postgres`;
  await waitForDatabase(adminUrl);
  await buildTemplate(adminUrl);
  project.provide('dbAdminUrl', adminUrl);

  return async () => {
    await container.stop();
  };
}
