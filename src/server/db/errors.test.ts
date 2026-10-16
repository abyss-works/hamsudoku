import { describe, expect, it } from 'vitest';
import { redactQueryParams, scrubDatabaseErrorEvent } from './errors';

describe('redactQueryParams', () => {
  it('쿼리 빌더 오류 메시지의 인자 목록을 가린다', () => {
    expect(redactQueryParams('Failed query: select $1, $2\nparams: user-a,secret@example.com')).toBe(
      'Failed query: select $1, $2\nparams: [redacted]',
    );
  });

  it('인자 목록이 없는 메시지는 그대로 둔다', () => {
    expect(redactQueryParams('duplicate key value violates unique constraint "User_pkey"')).toBe(
      'duplicate key value violates unique constraint "User_pkey"',
    );
  });
});

describe('scrubDatabaseErrorEvent', () => {
  it('Sentry 이벤트의 예외 값과 메시지에서 쿼리 인자를 가린다', () => {
    const event = {
      message: 'Failed query: update "Profile" set nickname = $1\nparams: 햄스터',
      exception: {
        values: [
          { type: 'Error', value: 'Failed query: select $1\nparams: user-a' },
          { type: 'Error', value: 'plain' },
        ],
      },
    };

    const scrubbed = scrubDatabaseErrorEvent(event);

    expect(scrubbed.message).toBe('Failed query: update "Profile" set nickname = $1\nparams: [redacted]');
    expect(scrubbed.exception?.values?.map((v) => v.value)).toEqual(['Failed query: select $1\nparams: [redacted]', 'plain']);
  });
});
