import { config } from 'dotenv';
// 로컬은 `.env.local`을 직접 읽는다. 없으면 실제 환경 변수를 쓴다(Vercel 빌드).
config({ path: '.env.local' });
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // CLI 전용 직접 연결. DDL은 풀러 경유 시 실패하므로 DIRECT_URL을 우선한다.
    url: env('DIRECT_URL'),
  },
});
