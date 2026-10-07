import fs from 'node:fs';
import { createPrismaDb } from '../src/server/db';
import { createRankStore, rebuildFromLedger } from '../src/server/rank';
import { seasonId, seasonStartUtc } from '../src/shared/season';

const DAY_MS = 24 * 60 * 60 * 1000;

function loadEnvLocal() {
  const text = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

async function redis<T>(url: string, token: string, command: (string | number)[]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`redis ${res.status}`);
  return ((await res.json()) as { result: T }).result;
}

async function main() {
  loadEnvLocal();
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.error('UPSTASH env가 없어 점검할 수 없습니다.');
    process.exit(1);
  }
  const store = createRankStore({ url, token });

  const now = new Date();
  const current = seasonId(now);
  const next = seasonId(new Date(now.getTime() + 7 * DAY_MS));
  const currentStart = seasonStartUtc(current);
  const nextStart = seasonStartUtc(next);
  console.log(`현재 시즌 ${current} (시작 ${currentStart.toISOString()})`);
  console.log(`다음 시즌 ${next} (시작 ${nextStart.toISOString()})`);
  if (nextStart.getTime() - currentStart.getTime() !== 7 * DAY_MS) {
    throw new Error('시즌 경계가 7일이 아닙니다.');
  }

  const scratchSeason = '2000-W01';
  const scratchUser = 'probe-rollover';
  await store.increment(scratchSeason, scratchUser, 1);
  const ttl = await redis<number>(url, token, ['ttl', `rank:${scratchSeason}`]);
  console.log(`스크래치 키 TTL ${ttl}초`);
  const scratchRank = await store.rankOf(scratchSeason, scratchUser);
  console.log(`스크래치 순위 ${scratchRank.rank}위 ${scratchRank.score}점`);
  await redis<number>(url, token, ['del', `rank:${scratchSeason}`]);
  const ttlAfter = await redis<number>(url, token, ['ttl', `rank:${scratchSeason}`]);
  console.log(`정리 후 TTL ${ttlAfter}`);

  const db = createPrismaDb();
  const rows = await db.listSeasonEarnings(current);
  const count = await rebuildFromLedger(db, store, current);
  const ttlCurrent = await redis<number>(url, token, ['ttl', `rank:${current}`]);
  console.log(`원장 재구축 ${count}명, 현재 시즌 키 TTL ${ttlCurrent}초`);
  for (const row of rows) {
    const r = await store.rankOf(current, row.userId);
    console.log(`검증 ${row.userId} 원장 ${row.amount} zset ${r.score} ${r.score === row.amount ? '일치' : '불일치'}`);
  }
  process.exit(0);
}

if (process.argv[1]?.includes('rank-rollover-check')) {
  main().catch((e) => {
    console.error('점검 실패:', e.message);
    process.exit(1);
  });
}
