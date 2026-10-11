import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

describe('Prisma Schema and Migration Consistency (Defect 7)', () => {
  const rootDir = resolve(__dirname, '../..');
  const schemaPath = resolve(rootDir, 'prisma/schema.prisma');
  const migrationPath = resolve(rootDir, 'prisma/migrations/20261011150000_endless_supply/migration.sql');

  it('schema.prisma와 migration.sql이 enum drift 없이 String(TEXT) 일치를 유지한다', () => {
    const schema = readFileSync(schemaPath, 'utf-8');
    const migration = readFileSync(migrationPath, 'utf-8');

    // 1. schema.prisma에서 enum 정의 대신 String 타입을 사용하여 drift를 방지함
    expect(schema).not.toContain('enum SupplyJobStatus');
    expect(schema).not.toContain('enum SupplyChunkStatus');
    expect(schema).toContain('status         String               @default("pending")');

    // 2. migration.sql에서도 PostgreSQL TEXT 타입으로 컬럼이 선언되어 스키마와 완전히 일치함
    expect(migration).toContain('"status" TEXT NOT NULL DEFAULT \'pending\'');
    expect(migration).not.toContain('CREATE TYPE');
  });

  it(
    'DB 연결 없는 diff CLI(prisma migrate diff --from-empty --to-schema)로 일관된 DDL 생성을 검증한다',
    () => {
      const cmd = 'pnpm exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script';
      const output = execSync(cmd, {
        cwd: rootDir,
        env: {
          ...process.env,
          DIRECT_URL: 'postgresql://localhost:5432/placeholder',
        },
        encoding: 'utf-8',
      });

      expect(output).toContain('CREATE TABLE "EndlessSupplyJob"');
      expect(output).toContain('"status" TEXT NOT NULL DEFAULT \'pending\'');
      expect(output).toContain('CREATE TABLE "EndlessSupplyChunk"');
      expect(output).not.toContain('SupplyJobStatus');
    },
    30000,
  );
});
