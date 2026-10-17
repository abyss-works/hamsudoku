import { configDefaults, defineConfig } from 'vitest/config';

// 실제 Postgres 컨테이너에서 실행하는 테스트 설정. 컨테이너는 실행 전체에서 하나를 공유한다.
export default defineConfig({
  test: {
    include: ['**/*.db.test.ts'],
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
    globalSetup: ['./tools/dbTest/globalSetup.ts'],
    // 배포 환경의 함수와 같은 UTC 시간대로 실행한다. 시간대 없는 타임스탬프의 해석이 배포 환경과 같아진다.
    env: { TZ: 'UTC' },
    testTimeout: 60000,
    hookTimeout: 180000,
    maxWorkers: 4,
  },
});
