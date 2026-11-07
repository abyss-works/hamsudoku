import { Client } from 'pg';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import type { TestProject } from 'vitest/node';
import { APP_PASSWORD, APP_ROLE, DB_TEST_IMAGE, TEMPLATE_DATABASE } from './config';
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
      await client.query('select 1');
      return;
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
    await admin.query(`create role "${APP_ROLE}" login password '${APP_PASSWORD}'`);
    await admin.query(`create database "${TEMPLATE_DATABASE}" owner "${APP_ROLE}"`);
  } finally {
    await admin.end();
  }

  const url = new URL(adminUrl);
  url.pathname = `/${TEMPLATE_DATABASE}`;
  url.username = APP_ROLE;
  url.password = APP_PASSWORD;
  const template = new Client({ connectionString: url.toString() });
  await template.connect();
  try {
    // 배포 환경과 같은 마이그레이션 파일과 migrator로 애플리케이션 역할이 스키마를 만든다. RLS 활성화는 마이그레이션에 포함된다.
    await applyDrizzleMigrations(template);
  } finally {
    await template.end();
  }
}

export default async function setup(project: TestProject) {
  const container: StartedTestContainer = await new GenericContainer(DB_TEST_IMAGE)
    .withEnvironment({ POSTGRES_PASSWORD: PASSWORD })
    .withExposedPorts(5432)
    .withCommand(['postgres', '-c', 'timezone=UTC'])
    // 이미지는 초기화용 임시 서버를 한 번 띄운 뒤 재시작한다. 준비 메시지가 두 번 나와야 초기화가 끝난 것이다.
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
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
