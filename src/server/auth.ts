import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import { cookies, headers } from 'next/headers';
import { appAuth, isIdentityConfigured } from './identity/instance';
import { RESET_PASSWORD_EXPIRES_IN, authFailure, type AuthResult } from './identity/rules';

export type { AuthResult };

const NOT_CONFIGURED: AuthResult = { ok: false, msg: '클라우드 미설정' };
const RECOVERY_COOKIE = 'hamsudoku.recovery';

export const isAuthConfigured = isIdentityConfigured;

/** 인증 API가 응답 헤더로 돌려준 Set-Cookie를 현재 요청의 응답 쿠키로 옮긴다. */
async function applyCookies(responseHeaders: Headers): Promise<void> {
  const store = await cookies();
  for (const [name, attributes] of parseSetCookieHeader(responseHeaders.get('set-cookie') ?? '')) {
    try {
      store.set(name, attributes.value, toCookieOptions(attributes));
    } catch {
      // 쿠키를 쓸 수 없는 컨텍스트에서는 세션 갱신을 다음 요청으로 미룬다.
    }
  }
}

/**
 * 요청 쿠키로 인증 API를 호출하고, 돌려받은 쿠키를 응답에 싣는다.
 * requestHeaders를 주면 요청 쿠키 대신 그 헤더로 호출한다.
 */
async function withRequestCookies<T>(
  call: (init: { headers: Headers; returnHeaders: true }) => Promise<{ headers: Headers; response: T }>,
  requestHeaders?: Headers,
): Promise<T> {
  const { headers: responseHeaders, response } = await call({
    headers: requestHeaders ?? (await headers()),
    returnHeaders: true,
  });
  await applyCookies(responseHeaders);
  return response;
}

type SessionUser = { id: string; email: string; isAnonymous?: boolean | null };

function toSessionUser(user: SessionUser): { uid: string; email: string | null } {
  return { uid: user.id, email: user.isAnonymous ? null : user.email };
}

// 세션 판정은 쿠키 캐시 없이 세션 표를 읽는다. 재설정과 로그아웃으로 끊은 세션이 캐시 수명 동안 통과하지 않게 한다.
async function readSession(): Promise<{ user: SessionUser } | null> {
  return withRequestCookies((init) => appAuth().api.getSession({ ...init, query: { disableCookieCache: true } }));
}

// 익명 세션 확보 — 있으면 재사용 (기기당 계정 유지). 로그인된 세션이면 이메일을 함께 반환한다.
export async function ensureSession(): Promise<{ uid: string; email: string | null } | null> {
  if (!isAuthConfigured()) return null;
  const session = await readSession();
  if (session) return toSessionUser(session.user);
  const created = await withRequestCookies((init) => appAuth().api.signInAnonymous(init));
  return created?.user.id ? { uid: created.user.id, email: null } : null;
}

export async function getSessionUser(): Promise<{ uid: string | null; email: string | null }> {
  if (!isAuthConfigured()) return { uid: null, email: null };
  const session = await readSession();
  return session ? toSessionUser(session.user) : { uid: null, email: null };
}

export async function currentAccount(): Promise<string | null> {
  const { email } = await getSessionUser();
  return email;
}

// 가입 = 익명 → 영구 승격 (uid 유지)
export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  try {
    await withRequestCookies((init) => appAuth().api.upgradeAnonymous({ ...init, body: { email, password } }));
    return { ok: true };
  } catch (error) {
    return authFailure(error);
  }
}

// 다른 계정으로 로그인 — 기기의 게스트 진행은 버려진다 (호출 전 UI가 경고)
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  try {
    // 유효하지 않은 세션 쿠키를 함께 보내면 인증 라이브러리가 새 세션 쿠키 대신 삭제 쿠키만 돌려준다.
    const stale = (await readSession()) === null;
    await withRequestCookies(
      (init) => appAuth().api.signInEmail({ ...init, body: { email, password } }),
      stale ? new Headers() : undefined,
    );
    return { ok: true };
  } catch (error) {
    return authFailure(error);
  }
}

export async function signOutAccount(): Promise<void> {
  if (!isAuthConfigured()) return;
  await withRequestCookies((init) => appAuth().api.signOut(init));
}

export async function requestPasswordReset(email: string): Promise<AuthResult> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  try {
    await withRequestCookies((init) => appAuth().api.requestPasswordReset({ ...init, body: { email } }));
    return { ok: true };
  } catch (error) {
    return authFailure(error);
  }
}

/**
 * 재설정 링크의 토큰으로 그 사용자의 세션을 열고, 새 비밀번호를 정할 때까지 토큰을 http 전용 쿠키에 둔다.
 * 토큰이 유효하지 않으면 false다.
 */
export async function exchangeRecoveryCode(token: string): Promise<boolean> {
  if (!isAuthConfigured()) return false;
  try {
    await withRequestCookies((init) => appAuth().api.openRecoverySession({ ...init, body: { token } }));
  } catch (error) {
    // 라이브러리 오류(유효하지 않은 토큰)는 false로 받고, 그 밖의 예외는 던진다.
    authFailure(error);
    return false;
  }
  const store = await cookies();
  store.set(RECOVERY_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.BETTER_AUTH_URL?.startsWith('https://') ?? false,
    path: '/api/auth',
    maxAge: RESET_PASSWORD_EXPIRES_IN,
  });
  return true;
}

// 재설정은 사용자의 모든 세션을 폐기하므로, 폐기 전에 이메일을 읽어 두었다가 새 비밀번호로 다시 로그인한다.
export async function applyNewPassword(password: string): Promise<AuthResult> {
  if (!isAuthConfigured()) return NOT_CONFIGURED;
  const store = await cookies();
  const token = store.get(RECOVERY_COOKIE)?.value;
  const session = token ? await readSession() : null;
  if (!token || !session) return authFailure({ body: { code: 'INVALID_TOKEN' } });
  try {
    await withRequestCookies((init) => appAuth().api.resetPassword({ ...init, body: { newPassword: password, token } }));
    store.delete(RECOVERY_COOKIE);
    // 재설정이 세션을 모두 폐기했으므로 요청 쿠키 없이 로그인한다.
    await withRequestCookies(
      (init) => appAuth().api.signInEmail({ ...init, body: { email: session.user.email, password } }),
      new Headers(),
    );
    return { ok: true };
  } catch (error) {
    return authFailure(error);
  }
}
