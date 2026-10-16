import { db } from '../db/client';
import { describeDbError } from '../db/errors';
import type { Defer } from '../defer';
import { upsertAccount } from './store';

/**
 * 세션이 성립한 사용자의 계정·프로필 행을 응답 뒤에 기록한다. 응답 계약은 이 기록에 의존하지 않으므로
 * 실패는 정제된 요약만 남기고 다음 세션 성립 시점에 다시 기록한다.
 */
export function rememberAccount(input: { uid: string; email: string | null }, defer: Defer): void {
  defer(async () => {
    try {
      await upsertAccount(db, { userId: input.uid, email: input.email, at: new Date() });
    } catch (error) {
      console.warn('Account record failed', describeDbError(error));
    }
  });
}
