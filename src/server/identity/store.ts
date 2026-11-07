import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Executor } from '../db/client';
import { authSchemaTables } from './schema';

/** 인증 라이브러리가 사용자·세션·계정·검증 표를 읽고 쓰는 Drizzle 어댑터. */
export function authAdapter(executor: Executor) {
  return drizzleAdapter(executor, { provider: 'pg', schema: authSchemaTables });
}
