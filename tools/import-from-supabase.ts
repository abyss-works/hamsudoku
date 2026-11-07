// 운영 Supabase Postgres의 데이터를 CNPG Postgres로 한 번에 옮기는 일회성 도구.
// 실행: SOURCE_URL=<소스> TARGET_URL=<대상> pnpm db:import-supabase [--dry-run]
// 소스는 읽기 전용 스냅샷으로 읽고, 대상은 단일 트랜잭션으로 쓴다. 로그에는 행 수만 남긴다.
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { ANONYMOUS_EMAIL_DOMAIN } from '../src/server/identity/rules';

/** 외래 키 순서를 지킨 public 표 목록. EndlessSupplyJob이 EndlessSupplyChunk보다, SeasonFinalization이 SeasonRankResult보다 앞선다. */
export const PUBLIC_TABLES = [
  'User',
  'Profile',
  'Attempt',
  'ClearEvent',
  'ClearRecord',
  'EndlessEvent',
  'EndlessPlayLog',
  'EndlessProgress',
  'EndlessStage',
  'EndlessStreak',
  'EndlessSupplyJob',
  'EndlessSupplyChunk',
  'SeasonFinalization',
  'SeasonRankResult',
  'SeedLedger',
  'SeedWallet',
] as const;

const AUTH_TABLES = ['auth.users', 'auth.accounts', 'auth.sessions', 'auth.verifications'] as const;

export interface ImportOptions {
  sourceUrl: string;
  /** dryRun이 아니면 필수다. */
  targetUrl?: string;
  dryRun?: boolean;
}

export interface TableCount {
  source: number;
  /** 대상에 쓴 뒤 세어 본 행 수. dry-run에는 없다. */
  target?: number;
}

export interface ImportResult {
  dryRun: boolean;
  tables: Record<string, TableCount>;
}

interface SourceUser {
  id: string;
  email: string | null;
  encrypted_password: string | null;
  confirmed: boolean;
  is_anonymous: boolean;
  created_at: string;
  updated_at: string;
}

interface MappedAuth {
  users: {
    id: string;
    email: string;
    email_verified: boolean;
    is_anonymous: boolean;
    created_at: string;
    updated_at: string;
  }[];
  accounts: {
    id: string;
    user_id: string;
    account_id: string;
    provider_id: string;
    password: string;
    created_at: string;
    updated_at: string;
  }[];
}

const quote = (table: string) => (table.includes('.') ? table : `"${table}"`);

/** 소스 auth.users를 대상 users·accounts 행으로 바꾼다. 값은 오류 메시지에 싣지 않는다. */
export function mapAuthUsers(rows: SourceUser[]): MappedAuth {
  const mapped: MappedAuth = { users: [], accounts: [] };
  for (const row of rows) {
    const common = { id: row.id, is_anonymous: row.is_anonymous, created_at: row.created_at, updated_at: row.updated_at };
    if (row.is_anonymous) {
      mapped.users.push({ ...common, email: `${row.id}@${ANONYMOUS_EMAIL_DOMAIN}`, email_verified: false });
      continue;
    }
    if (!row.email) throw new Error(`이메일이 없는 비익명 사용자가 있습니다: id ${row.id}`);
    if (!row.encrypted_password) throw new Error(`비밀번호 해시가 없는 이메일 사용자가 있습니다: id ${row.id}`);
    mapped.users.push({ ...common, email: row.email.toLowerCase(), email_verified: row.confirmed });
    mapped.accounts.push({
      id: randomUUID(),
      user_id: row.id,
      account_id: row.id,
      provider_id: 'credential',
      password: row.encrypted_password,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  }
  return mapped;
}

async function countRows(client: Client, table: string): Promise<number> {
  const { rows } = await client.query<{ n: string }>(`select count(*) as n from ${quote(table)}`);
  return Number(rows[0].n);
}

async function readSource(source: Client) {
  const counts: Record<string, number> = {};
  const json: Record<string, string> = {};
  for (const table of PUBLIC_TABLES) {
    counts[table] = await countRows(source, table);
    const { rows } = await source.query<{ j: string }>(
      `select coalesce(json_agg(t), '[]'::json)::text as j from ${quote(table)} t`,
    );
    json[table] = rows[0].j;
  }
  const { rows } = await source.query<SourceUser>(
    `select id::text as id, email, encrypted_password, email_confirmed_at is not null as confirmed,
            is_anonymous, created_at::text as created_at, updated_at::text as updated_at
       from auth.users`,
  );
  return { counts, json, auth: mapAuthUsers(rows), authUserCount: rows.length };
}

async function assertTargetEmpty(target: Client) {
  const nonEmpty: string[] = [];
  for (const table of [...PUBLIC_TABLES, ...AUTH_TABLES]) {
    const { rows } = await target.query<{ found: boolean }>(`select exists (select 1 from ${quote(table)}) as found`);
    if (rows[0].found) nonEmpty.push(table);
  }
  if (nonEmpty.length > 0) throw new Error(`대상 표가 비어 있지 않습니다: ${nonEmpty.join(', ')}`);
}

async function writeTarget(target: Client, data: Awaited<ReturnType<typeof readSource>>) {
  for (const table of PUBLIC_TABLES) {
    await target.query(`insert into ${quote(table)} select * from json_populate_recordset(null::${quote(table)}, $1::json)`, [
      data.json[table],
    ]);
  }
  await target.query(
    `insert into auth.users (id, email, email_verified, is_anonymous, created_at, updated_at)
     select id, email, email_verified, is_anonymous, created_at, updated_at
       from json_to_recordset($1::json) as x(id text, email text, email_verified boolean, is_anonymous boolean, created_at timestamptz, updated_at timestamptz)`,
    [JSON.stringify(data.auth.users)],
  );
  await target.query(
    `insert into auth.accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
     select id, user_id, account_id, provider_id, password, created_at, updated_at
       from json_to_recordset($1::json) as x(id text, user_id text, account_id text, provider_id text, password text, created_at timestamptz, updated_at timestamptz)`,
    [JSON.stringify(data.auth.accounts)],
  );
}

export async function importFromSupabase(options: ImportOptions): Promise<ImportResult> {
  const dryRun = options.dryRun ?? false;
  if (!dryRun && !options.targetUrl) throw new Error('대상 주소가 필요합니다');

  const source = new Client({ connectionString: options.sourceUrl });
  await source.connect();
  let data: Awaited<ReturnType<typeof readSource>>;
  try {
    // 반복 가능 읽기 격리의 읽기 전용 트랜잭션이라 모든 표를 같은 스냅샷에서 읽는다.
    await source.query('begin isolation level repeatable read read only');
    data = await readSource(source);
    await source.query('commit');
  } finally {
    await source.end();
  }

  const expected: Record<string, number> = {
    ...data.counts,
    'auth.users': data.auth.users.length,
    'auth.accounts': data.auth.accounts.length,
  };
  if (data.authUserCount !== data.auth.users.length) throw new Error('auth.users 매핑 행 수가 소스와 다릅니다');

  if (dryRun) {
    return { dryRun, tables: Object.fromEntries(Object.entries(expected).map(([table, n]) => [table, { source: n }])) };
  }

  const target = new Client({ connectionString: options.targetUrl });
  await target.connect();
  try {
    await target.query('begin');
    try {
      await assertTargetEmpty(target);
      await writeTarget(target, data);

      const tables: Record<string, TableCount> = {};
      const mismatched: string[] = [];
      for (const [table, sourceCount] of Object.entries(expected)) {
        const targetCount = await countRows(target, table);
        tables[table] = { source: sourceCount, target: targetCount };
        if (targetCount !== sourceCount) mismatched.push(table);
      }
      if (mismatched.length > 0) throw new Error(`행 수가 소스와 다릅니다: ${mismatched.join(', ')}`);

      await target.query('commit');
      return { dryRun, tables };
    } catch (error) {
      await target.query('rollback');
      throw error;
    }
  } finally {
    await target.end();
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}이 필요합니다`);
  return value;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const result = await importFromSupabase({
    sourceUrl: requireEnv('SOURCE_URL'),
    targetUrl: dryRun ? undefined : requireEnv('TARGET_URL'),
    dryRun,
  });
  console.log(dryRun ? '[dry-run] 소스 행 수 (쓰지 않음)' : '이관 완료: 소스/대상 행 수');
  for (const [table, { source, target }] of Object.entries(result.tables)) {
    console.log(target === undefined ? `${table}: ${source}` : `${table}: ${source}/${target}`);
  }
}

if (process.argv[1]?.includes('import-from-supabase')) {
  main().catch((e) => {
    console.error('이관 실패:', e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
