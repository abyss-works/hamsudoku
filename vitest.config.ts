import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 작업용 워크트리(.worktrees/)의 테스트는 이 저장소 실행에서 제외한다.
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
    testTimeout: 30000,
    // 파일마다 워커를 띄우면 CPU 수 이상으로 경합이 생겨 DOM 렌더 대기가 간헐 실패한다.
    maxWorkers: 4,
    setupFiles: ['./vitest.setup.ts'],
  },
});
