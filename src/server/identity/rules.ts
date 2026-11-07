import bcrypt from 'bcryptjs';

export type AuthResult = { ok: true } | { ok: false; msg: string; code?: string };

export const MIN_PASSWORD_LENGTH = 6;
export const MAX_PASSWORD_LENGTH = 128;

/** 익명 계정의 자리표시 이메일 도메인. 예약된 최상위 도메인이라 실제 주소와 겹치지 않는다. */
export const ANONYMOUS_EMAIL_DOMAIN = 'anonymous.invalid';

/** 비밀번호 재설정 토큰의 유효 시간(초). */
export const RESET_PASSWORD_EXPIRES_IN = 60 * 60;

/** 로그인 세션의 유효 시간(초). 익명 사용자의 신원은 세션뿐이므로 1년 동안 쓰지 않을 때만 끝난다. */
export const SESSION_EXPIRES_IN = 60 * 60 * 24 * 365;

/** 이전 인증 서버가 저장한 해시가 bcrypt이므로 새 해시도 bcrypt로 맞춘다. */
export const bcryptPassword = {
  hash: (password: string) => bcrypt.hash(password, 10),
  verify: ({ hash, password }: { hash: string; password: string }) => bcrypt.compare(password, hash),
};

const FAILURES: Record<string, { code: string; msg: string }> = {
  USER_ALREADY_EXISTS: { code: 'user_already_exists', msg: '이미 가입된 이메일이에요.' },
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: { code: 'user_already_exists', msg: '이미 가입된 이메일이에요.' },
  PASSWORD_TOO_SHORT: { code: 'weak_password', msg: `비밀번호가 너무 짧아요 (${MIN_PASSWORD_LENGTH}자 이상).` },
  PASSWORD_TOO_LONG: { code: 'password_too_long', msg: `비밀번호가 너무 길어요 (${MAX_PASSWORD_LENGTH}자 이하).` },
  INVALID_EMAIL_OR_PASSWORD: { code: 'invalid_credentials', msg: '이메일 또는 비밀번호가 틀렸어요.' },
  INVALID_TOKEN: { code: 'invalid_token', msg: '재설정 링크가 만료됐어요. 다시 요청해 주세요.' },
  USER_IS_NOT_ANONYMOUS: { code: 'not_anonymous', msg: '이미 가입된 계정이에요.' },
  UNAUTHORIZED: { code: 'no_session', msg: '로그인 세션이 없어요. 새로고침 후 다시 시도하세요.' },
};

function apiErrorBody(error: unknown): { code?: string; message?: string } | null {
  if (typeof error !== 'object' || error === null || !('body' in error)) return null;
  const body = (error as { body: unknown }).body;
  return typeof body === 'object' && body !== null ? (body as { code?: string; message?: string }) : null;
}

/**
 * 인증 라이브러리의 API 오류를 라우트 응답 계약의 코드와 메시지로 바꾼다.
 * 라이브러리 오류가 아닌 예외(데이터베이스 연결 실패 등)는 그대로 던진다.
 */
export function authFailure(error: unknown): { ok: false; msg: string; code: string } {
  const body = apiErrorBody(error);
  if (!body?.code) throw error;
  const known = FAILURES[body.code];
  if (known) return { ok: false, ...known };
  return { ok: false, msg: body.message ?? '알 수 없는 오류', code: body.code.toLowerCase() };
}
