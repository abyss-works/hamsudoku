import { APIError } from 'better-auth/api';
import { describe, expect, it } from 'vitest';
import {
  ANONYMOUS_EMAIL_DOMAIN,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  authFailure,
  bcryptPassword,
} from './rules';

const apiError = (status: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'UNPROCESSABLE_ENTITY', code: string) =>
  new APIError(status, { code, message: `message of ${code}` });

describe('authFailure', () => {
  it.each([
    ['USER_ALREADY_EXISTS', 'user_already_exists', '이미 가입된 이메일이에요.'],
    ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'user_already_exists', '이미 가입된 이메일이에요.'],
    ['PASSWORD_TOO_SHORT', 'weak_password', '비밀번호가 너무 짧아요 (6자 이상).'],
    ['PASSWORD_TOO_LONG', 'password_too_long', '비밀번호가 너무 길어요 (128자 이하).'],
    ['INVALID_EMAIL_OR_PASSWORD', 'invalid_credentials', '이메일 또는 비밀번호가 틀렸어요.'],
    ['INVALID_TOKEN', 'invalid_token', '재설정 링크가 만료됐어요. 다시 요청해 주세요.'],
    ['USER_IS_NOT_ANONYMOUS', 'not_anonymous', '이미 가입된 계정이에요.'],
  ])('%s를 기존 응답 코드 %s와 메시지로 바꾼다', (betterAuthCode, code, msg) => {
    expect(authFailure(apiError('BAD_REQUEST', betterAuthCode))).toEqual({ ok: false, code, msg });
  });

  it('세션 없는 요청은 no_session으로 바꾼다', () => {
    expect(authFailure(apiError('UNAUTHORIZED', 'UNAUTHORIZED'))).toMatchObject({ ok: false, code: 'no_session' });
  });

  it('알 수 없는 인증 오류는 원 메시지와 소문자 코드를 그대로 싣는다', () => {
    expect(authFailure(apiError('BAD_REQUEST', 'SOMETHING_NEW'))).toEqual({
      ok: false,
      code: 'something_new',
      msg: 'message of SOMETHING_NEW',
    });
  });

  it('인증 오류가 아닌 예외는 삼키지 않고 다시 던진다', () => {
    const failure = new Error('connection refused');
    expect(() => authFailure(failure)).toThrow(failure);
    expect(() => authFailure(null)).toThrow();
  });
});

describe('비밀번호 규칙', () => {
  it('최소 6자 최대 128자다', () => {
    expect([MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH]).toEqual([6, 128]);
  });

  it('익명 계정 자리표시 이메일 도메인은 예약된 최상위 도메인이다', () => {
    expect(ANONYMOUS_EMAIL_DOMAIN).toBe('anonymous.invalid');
  });

  it('새 해시는 bcrypt이고 검증된다', async () => {
    const hash = await bcryptPassword.hash('secret1');
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(await bcryptPassword.verify({ hash, password: 'secret1' })).toBe(true);
    expect(await bcryptPassword.verify({ hash, password: 'secret2' })).toBe(false);
  });

  it('Supabase가 저장한 $2a$10$ 형식의 bcrypt 해시를 그대로 검증한다', async () => {
    const legacyHash = '$2a$10$abcdefghijklmnopqrstuusMi15QIkzh60hxzSXmzv9.uhjHUyMQy';
    expect(await bcryptPassword.verify({ hash: legacyHash, password: 'hamster-pass-1' })).toBe(true);
    expect(await bcryptPassword.verify({ hash: legacyHash, password: 'wrong' })).toBe(false);
  });
});
