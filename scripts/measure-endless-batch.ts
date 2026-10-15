import { performance } from 'node:perf_hooks';
import { generateEndlessPool } from '../src/shared/sudoku/endlessPoolGenerator';

interface BatchMeasurement {
  seed: number;
  count: number;
  wallMs: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  heapUsedMb: number;
}

export function measureBatch(seed: number, target: number = 10): BatchMeasurement {
  const startMem = process.memoryUsage().heapUsed;
  const startCpu = process.cpuUsage();
  const startWall = performance.now();

  const results = generateEndlessPool(seed, target);

  const endWall = performance.now();
  const endCpu = process.cpuUsage(startCpu);
  const endMem = process.memoryUsage().heapUsed;

  if (results.length !== target) {
    throw new Error(`목표 미달: seed ${seed}, 결과 ${results.length}/${target}`);
  }

  return {
    seed,
    count: results.length,
    wallMs: Math.round(endWall - startWall),
    cpuUserMs: Math.round(endCpu.user / 1000),
    cpuSystemMs: Math.round(endCpu.system / 1000),
    heapUsedMb: Math.round(((endMem - startMem) / 1024 / 1024) * 100) / 100,
  };
}

export function runMeasurements(seeds: number[] = [10000, 20000, 30000]): BatchMeasurement[] {
  const measurements: BatchMeasurement[] = [];
  for (const seed of seeds) {
    const m = measureBatch(seed, 10);
    measurements.push(m);
  }
  return measurements;
}

if (process.argv[1]?.includes('measure-endless-batch')) {
  console.log('=== 무한모드 10개 배치 CLI 다수 seed 생성 시간 측정 ===');
  const seeds = [10000, 20000, 30000];
  const results = runMeasurements(seeds);
  for (const r of results) {
    console.log(
      `Seed ${r.seed}: 10개 생성 | Wall ${r.wallMs}ms | CPU User ${r.cpuUserMs}ms, Sys ${r.cpuSystemMs}ms | Heap delta ${r.heapUsedMb}MB`,
    );
  }
  const avgWall = Math.round(results.reduce((a, b) => a + b.wallMs, 0) / results.length);
  const maxWall = Math.max(...results.map((r) => r.wallMs));
  console.log(`평균 Wall: ${avgWall}ms | 최대 Wall: ${maxWall}ms | 배포 maxDuration(60s) 대비 여유: ${Math.round((60000 - maxWall) / 1000)}초`);
}
