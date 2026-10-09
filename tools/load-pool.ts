import fs from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../prisma/generated/prisma/client';
import { generateEndlessPool } from './generate';

function loadEnvLocal() {
  const text = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
  }
}

export function serializeRegions(islands: number[][]): string {
  return islands.flat().join('');
}

export function serializeSolution(spots: [number, number][]): string {
  return spots.map(([r, c]) => `${r},${c}`).join(';');
}

export function stageId(seed: number, index: number): string {
  return `e-${seed}-${index}`;
}

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
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const rows = candidates.map((c, i) => ({
    id: stageId(seed, i),
    size: c.islands.length,
    regions: serializeRegions(c.islands),
    solution: serializeSolution(c.solution),
    tier: c.tier,
    seed,
  }));
  const created = await prisma.endlessStage.createMany({ data: rows, skipDuplicates: true });
  const total = await prisma.endlessStage.count();
  await prisma.$disconnect();
  console.log(`적재 ${created.count}개, 전체 ${total}개`);
}

if (process.argv[1]?.includes('load-pool')) {
  main().catch((e) => {
    console.error('적재 실패:', e.message);
    process.exit(1);
  });
}
