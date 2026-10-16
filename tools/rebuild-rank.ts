import fs from 'node:fs';
import { rankStoreFromEnv } from '../src/server/rank';
import { seasonId } from '../src/shared/season';

function loadEnvLocal() {
  const text = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main() {
  loadEnvLocal();
  const season = argValue(process.argv, '--season') ?? seasonId(new Date());
  const store = rankStoreFromEnv();
  if (!store) {
    console.error('UPSTASH env가 없어 재구축할 수 없습니다.');
    process.exit(1);
  }
  // DB 연결은 모듈을 불러올 때 DATABASE_URL을 읽으므로 env를 읽은 뒤에 불러온다.
  const { rebuildRankCache } = await import('../src/server/seasonRanking/rankCache');
  const count = await rebuildRankCache(store, season);
  console.log(`재구축 ${count}명, 시즌 ${season}`);
  process.exit(0);
}

if (process.argv[1]?.includes('rebuild-rank')) {
  main().catch((e) => {
    console.error('재구축 실패:', e.message);
    process.exit(1);
  });
}
