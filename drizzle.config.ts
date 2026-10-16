import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// 로컬은 `.env.local`을 직접 읽는다. 없으면 실제 환경 변수를 쓴다.
config({ path: '.env.local' });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/*/schema.ts',
  out: './drizzle',
  // 마이그레이션은 풀러를 거치지 않는 직접 연결로 적용한다. generate는 접속하지 않는다.
  dbCredentials: { url: process.env.DIRECT_URL ?? '' },
  strict: true,
  verbose: true,
});
