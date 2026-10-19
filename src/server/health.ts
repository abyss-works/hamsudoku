import * as Sentry from '@sentry/nextjs';
import { checkConnection } from './db/client';
import { describeDbError } from './db/errors';

/** 서버 함수에서 DB에 연결해 쿼리를 실행할 수 있는지 확인한다. 실패는 오류 로그로 남긴다. */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await checkConnection();
    return true;
  } catch (error) {
    Sentry.logger.error('Health check failed', { ...describeDbError(error) });
    return false;
  }
}
