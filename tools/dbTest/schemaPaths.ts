import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Client } from 'pg';

// 스키마를 만드는 두 경로와 비교 도구.
// 운영 DB는 Prisma 마이그레이션으로 만들어졌고, 이후에는 Drizzle 마이그레이션이 정본이다.

export const DRIZZLE_MIGRATIONS = join(process.cwd(), 'drizzle');
const PRISMA_MIGRATIONS = join(process.cwd(), 'prisma', 'migrations');

interface JournalEntry {
  tag: string;
  when: number;
}

export function drizzleJournal(): JournalEntry[] {
  const journal = JSON.parse(readFileSync(join(DRIZZLE_MIGRATIONS, 'meta', '_journal.json'), 'utf-8')) as {
    entries: JournalEntry[];
  };
  return journal.entries;
}

/** 운영 DB의 기존 상태: Prisma 마이그레이션 SQL과 운영 절차로 적용한 RLS 활성화. */
export async function applyPrismaMigrations(client: Client): Promise<void> {
  const names = readdirSync(PRISMA_MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of names) await client.query(readFileSync(join(PRISMA_MIGRATIONS, name, 'migration.sql'), 'utf-8'));
  await client.query(`
    do $$
    declare t record;
    begin
      for t in select tablename from pg_tables where schemaname = 'public' loop
        execute format('alter table public.%I enable row level security', t.tablename);
      end loop;
    end $$;
  `);
}

/** Drizzle migrator로 마이그레이션을 적용한다. 기록 테이블의 마지막 시각 이후 항목만 적용된다. */
export async function applyDrizzleMigrations(client: Client): Promise<void> {
  await migrate(drizzle({ client }), { migrationsFolder: DRIZZLE_MIGRATIONS });
}

/** 기준선 SQL만 실행한다. 기록 테이블은 만들지 않는다. */
export async function applyDrizzleBaselineSql(client: Client): Promise<void> {
  const [baseline] = drizzleJournal();
  const text = readFileSync(join(DRIZZLE_MIGRATIONS, `${baseline.tag}.sql`), 'utf-8');
  for (const statement of text.split('--> statement-breakpoint')) {
    if (statement.trim()) await client.query(statement);
  }
}

/**
 * Prisma로 만든 DB에 기준선을 적용된 것으로 기록한다. migrator는 기록의 마지막 시각보다 뒤의 항목만 적용하므로
 * 기준선 항목의 시각과 파일 해시를 기록하면 이후 migrate는 가산 마이그레이션만 실행한다.
 */
export async function recordDrizzleBaseline(client: Client): Promise<void> {
  const { createHash } = await import('node:crypto');
  const [baseline] = drizzleJournal();
  const text = readFileSync(join(DRIZZLE_MIGRATIONS, `${baseline.tag}.sql`), 'utf-8');
  await client.query('create schema if not exists drizzle');
  await client.query(
    'create table if not exists drizzle.__drizzle_migrations (id serial primary key, hash text not null, created_at bigint)',
  );
  await client.query('insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)', [
    createHash('sha256').update(text).digest('hex'),
    baseline.when,
  ]);
}

/** public 스키마의 테이블·컬럼·제약·인덱스·RLS 상태. 마이그레이션 기록 테이블은 제외한다. */
export async function catalogSnapshot(client: Client): Promise<unknown> {
  const { rows } = await client.query(`
    select json_build_object(
      'tables', (
        select json_agg(json_build_object('name', c.relname, 'rls', c.relrowsecurity, 'forceRls', c.relforcerowsecurity) order by c.relname)
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname <> '_prisma_migrations'
      ),
      'columns', (
        select json_agg(json_build_object(
          'table', table_name, 'column', column_name, 'position', ordinal_position, 'type', data_type,
          'precision', datetime_precision, 'nullable', is_nullable, 'default', column_default
        ) order by table_name, ordinal_position)
        from information_schema.columns
        where table_schema = 'public' and table_name <> '_prisma_migrations'
      ),
      'constraints', (
        select json_agg(json_build_object('table', conrelid::regclass::text, 'name', conname, 'definition', pg_get_constraintdef(oid))
          order by conrelid::regclass::text, conname)
        from pg_constraint
        where connamespace = 'public'::regnamespace and conrelid::regclass::text <> '"_prisma_migrations"'
      ),
      'indexes', (
        select json_agg(json_build_object('table', tablename, 'name', indexname, 'definition', indexdef) order by tablename, indexname)
        from pg_indexes
        where schemaname = 'public' and tablename <> '_prisma_migrations'
      ),
      'policies', (select count(*)::int from pg_policies where schemaname = 'public')
    ) as snapshot
  `);
  return rows[0].snapshot;
}
