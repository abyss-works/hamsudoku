import { configDefaults, defineConfig } from 'vitest/config';

// 실제 Postgres 컨테이너에서 실행하는 테스트 설정. 컨테이너는 실행 전체에서 하나를 공유한다.
export default defineConfig({
  test: {
    include: ['**/*.db.test.ts'],
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
    globalSetup: ['./tools/dbTest/globalSetup.ts'],
    testTimeout: 60000,
    hookTimeout: 180000,
    maxWorkers: 4,
  },
});
