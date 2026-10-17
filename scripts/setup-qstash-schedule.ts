#!/usr/bin/env node
/**
 * QStash 스케줄 등록/검증 CLI 스크립트.
 *
 * 사용법:
 *   pnpm tsx scripts/setup-qstash-schedule.ts           (기본값: dry-run)
 *   pnpm tsx scripts/setup-qstash-schedule.ts --dry-run (스케줄 구성 출력)
 *   pnpm tsx scripts/setup-qstash-schedule.ts --execute (실제 QStash에 등록)
 */
import { Client } from '@upstash/qstash';
import { qstashProtectionHeaders } from '../src/server/qstashHeaders';

interface ScheduleDefinition {
  name: string;
  description: string;
  /** APP_URL 뒤에 붙는 내부 작업 경로. */
  path: string;
  cron: string;
  cronExplanation: string;
  body: Record<string, unknown>;
}

export const SCHEDULE_DEFINITIONS: ScheduleDefinition[] = [
  {
    name: 'weekly-ranking-finalize',
    description: '주간 랭킹 자동 마감 및 확정',
    path: '/api/internal/ranking-finalize',
    cron: '5 15 * * 0',
    cronExplanation: '매주 일요일 15:05 UTC (= 한국 시각 월요일 00:05 KST, 주간 마감 5분 후)',
    body: { recover: true },
  },
  {
    name: 'daily-ranking-catchup',
    description: '일일 미확정 시즌 복구 및 점검',
    path: '/api/internal/ranking-finalize',
    cron: '0 19 * * *',
    cronExplanation: '매일 19:00 UTC (= 한국 시각 매일 04:00 KST, 일일 리셋 시점)',
    body: { recover: true },
  },
  {
    name: 'daily-play-audit',
    description: '무한모드 플레이 기록 일일 사후 감사',
    path: '/api/internal/play-audit',
    cron: '30 19 * * *',
    cronExplanation: '매일 19:30 UTC (= 한국 시각 매일 04:30 KST, 일일 랭킹 점검 30분 후)',
    body: {},
  },
];

export async function run(args: string[]) {
  const isExecute = args.includes('--execute');
  const rawAppUrl = process.env.APP_URL?.trim();
  if (!rawAppUrl) {
    throw new Error('APP_URL 환경변수가 설정되지 않아 실행할 수 없습니다.');
  }
  const appBase = rawAppUrl.replace(/\/+$/, '');
  const destinationOf = (def: ScheduleDefinition) => `${appBase}${def.path}`;

  console.log('=== QStash Internal Job Schedule Setup ===');
  console.log(`App URL: ${appBase}`);
  console.log(`Mode: ${isExecute ? 'EXECUTE (remote provisioning)' : 'DRY RUN (preview only)'}\n`);

  for (const def of SCHEDULE_DEFINITIONS) {
    console.log(`- Schedule: ${def.name}`);
    console.log(`  Description: ${def.description}`);
    console.log(`  Cron: "${def.cron}" (${def.cronExplanation})`);
    console.log(`  Destination: ${destinationOf(def)}`);
    console.log(`  Payload: ${JSON.stringify(def.body)}`);
  }

  if (!isExecute) {
    console.log('\n[Dry Run] 설정 확인 완료. 실제 등록 시 --execute 옵션을 사용하세요.');
    return;
  }

  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    console.error('\n[Error] QSTASH_TOKEN 환경변수가 설정되지 않아 실행할 수 없습니다.');
    process.exit(1);
  }

  const client = new Client({ token });
  console.log('\nQStash 원격 스케줄 등록 시작...');

  for (const def of SCHEDULE_DEFINITIONS) {
    try {
      const res = await client.schedules.create({
        destination: destinationOf(def),
        cron: def.cron,
        body: JSON.stringify(def.body),
        headers: {
          'Content-Type': 'application/json',
          ...qstashProtectionHeaders(),
        },
      });
      console.log(`✔ [성공] ${def.name} -> Schedule ID: ${res.scheduleId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✖ [실패] ${def.name}: ${msg}`);
      process.exit(1);
    }
  }

  console.log('\n모든 스케줄이 성공적으로 등록되었습니다.');
}

if (process.argv[1]?.endsWith('setup-qstash-schedule.ts')) {
  run(process.argv.slice(2)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
