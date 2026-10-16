import fs from 'node:fs';
import { generateEndlessPool } from '../src/shared/sudoku/endlessPoolGenerator';

function loadEnvLocal() {
  const text = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

import { serializeRegions, serializeSolution, stageId } from '../src/shared/endlessStageFormat';

export { serializeRegions, serializeSolution, stageId };

function argValue(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main() {
  loadEnvLocal();
  const seed = Number(argValue(process.argv, '--seed') ?? '7');
  const count = Number(argValue(process.argv, '--count') ?? '200');
  console.error(`풀 생성 시작: 시드 ${seed}, 목표 ${count}`);
  const candidates = generateEndlessPool(seed, count);
  console.error(`생성 완료: ${candidates.length}개`);
  // 관리 스크립트이므로 직접 연결을 쓴다. 없으면 즉시 실패한다.
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) throw new Error('DIRECT_URL이 필요하다');
  const rows = candidates.map((c, i) => ({
    id: stageId(seed, i),
    size: c.islands.length,
    regions: serializeRegions(c.islands),
    solution: serializeSolution(c.solution),
    tier: c.tier,
    seed,
  }));
  const { createDatabase } = await import('../src/server/db/client');
  const { insertStages } = await import('../src/server/endlessPool/store');
  const database = createDatabase({ connectionString, max: 1 });
  try {
    const created = await insertStages(database.db, rows);
    const { rows: totals } = await database.pool.query<{ n: number }>('select count(*)::int as n from "EndlessStage"');
    console.log(`적재 ${created}개, 전체 ${totals[0].n}개`);
  } finally {
    await database.pool.end();
  }
}

if (process.argv[1]?.includes('load-pool')) {
  main().catch((e) => {
    console.error('적재 실패:', e.message);
    process.exit(1);
  });
}
