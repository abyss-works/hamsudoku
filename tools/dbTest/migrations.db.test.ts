import { Client } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { applyDrizzleMigrations } from './schemaPaths';
import { createEmptyDatabase, type TestDatabase } from './testDatabase';

const opened: { database: TestDatabase; client: Client }[] = [];

afterEach(async () => {
  for (const { database, client } of opened.splice(0)) {
    await client.end();
    await database.drop();
  }
});

async function emptyDatabase(): Promise<Client> {
  const database = await createEmptyDatabase();
  const client = new Client({ connectionString: database.url });
  await client.connect();
  opened.push({ database, client });
  return client;
}

describe('Drizzle 마이그레이션', () => {
  it('id를 지정하지 않은 행은 DB가 uuid를 채운다', async () => {
    const client = await emptyDatabase();
    await applyDrizzleMigrations(client);

    const inserted = await client.query<{ table: string; id: string }>(`
      with
        a as (insert into "Attempt" ("userId", "stageCode") values ('u', '1-1') returning 'Attempt' as t, id),
        c as (insert into "ClearEvent" ("userId", "stageCode", "elapsedSec", "clearedAt") values ('u', '1-1', 1, now()) returning 'ClearEvent' as t, id),
        l as (insert into "SeedLedger" ("userId", kind, amount, season) values ('u', 'earn', 1, '2026-W42') returning 'SeedLedger' as t, id),
        e as (insert into "EndlessEvent" ("userId", "stageId", "seedLeft", "elapsedMs", verified) values ('u', 'e-1-0', 1, 1, true) returning 'EndlessEvent' as t, id)
      select t as table, id from a union all select t, id from c union all select t, id from l union all select t, id from e
    `);

    expect(inserted.rows.map((r) => r.table).sort()).toEqual(['Attempt', 'ClearEvent', 'EndlessEvent', 'SeedLedger']);
    for (const row of inserted.rows) expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
