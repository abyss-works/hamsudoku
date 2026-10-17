import { Client } from 'pg';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import type { TestProject } from 'vitest/node';
import { DB_TEST_IMAGE, TEMPLATE_DATABASE } from './config';
import { applyDrizzleMigrations } from './schemaPaths';

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
    // 배포 환경과 같은 마이그레이션 파일과 migrator로 스키마를 만든다. RLS 활성화는 마이그레이션에 포함된다.
    await applyDrizzleMigrations(template);
  } finally {
    await template.end();
  }
}

export default async function setup(project: TestProject) {
  const container: StartedTestContainer = await new GenericContainer(DB_TEST_IMAGE)
    .withEnvironment({ POSTGRES_PASSWORD: PASSWORD })
    .withExposedPorts(5432)
    // 이미지 자체 상태 검사는 시작 유예 없이 약 20초 안에 준비되지 않으면 실패로 판정한다.
    // 포트 개방만 기다리고 초기화 완료는 waitForDatabase가 역할 생성으로 판정한다.
    .withWaitStrategy(Wait.forListeningPorts())
    .withStartupTimeout(120_000)
    .start();

  const adminUrl = `postgresql://postgres:${PASSWORD}@${container.getHost()}:${container.getMappedPort(5432)}/postgres`;
  await waitForDatabase(adminUrl);
  await buildTemplate(adminUrl);
  project.provide('dbAdminUrl', adminUrl);

  return async () => {
    await container.stop();
  };
}
