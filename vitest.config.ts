import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 작업용 워크트리(.worktrees/)의 테스트는 이 저장소 실행에서 제외한다.
    exclude: [...configDefaults.exclude, '**/.worktrees/**'],
  },
});
