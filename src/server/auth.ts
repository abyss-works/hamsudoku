import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AuthResult = { ok: true } | { ok: false; msg: string; code?: string };

function env() {
  return {
    url: process.env.SUPABASE_URL as string | undefined,
    anonKey: process.env.SUPABASE_ANON_KEY as string | undefined,
  };
}

export function isAuthConfigured(): boolean {
  const { url, anonKey } = env();
  return Boolean(url && anonKey);
}

async function userClient(): Promise<SupabaseClient | null> {
  const { url, anonKey } = env();
  if (!url || !anonKey) return null;
  const store = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (pairs) => {
        for (const p of pairs) store.set(p);
      },
    },
  });
}

export async function exchangeRecoveryCode(code: string): Promise<boolean> {
  const supabase = await userClient();
  if (!supabase) return false;
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return !error;
}

const AUTH_MSG: Record<string, string> = {
  user_already_exists: '이미 가입된 이메일이에요.',
  email_exists: '이미 가입된 이메일이에요.',
  weak_password: '비밀번호가 너무 짧아요 (6자 이상).',
  invalid_credentials: '이메일 또는 비밀번호가 틀렸어요.',
  email_not_confirmed: '이메일 확인이 필요해요. 받은편지함을 확인하세요.',
  over_email_send_rate_limit: '메일을 너무 자주 보냈어요. 잠시 후 다시 시도하세요.',
};

function authErr(e: { message?: string; code?: string } | null): AuthResult {
  return {
    ok: false,
    msg: (e?.code && AUTH_MSG[e.code]) ?? e?.message ?? '알 수 없는 오류',
    code: e?.code,
  };
}

// 익명 세션 확보 — 있으면 재사용 (기기당 계정 유지)
export async function ensureSession(): Promise<string | null> {
  const supabase = await userClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user.id;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function getSessionUser(): Promise<{ uid: string | null; email: string | null }> {
  const supabase = await userClient();
  if (!supabase) return { uid: null, email: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { uid: null, email: null };
  return { uid: user.id, email: !user.is_anonymous && user.email ? user.email : null };
}

export async function currentAccount(): Promise<string | null> {
  const { email } = await getSessionUser();
  return email;
}

// 가입 = 익명 → 영구 승격 (uid 유지)
export async function signUpWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = await userClient();
  if (!supabase) return { ok: false, msg: '클라우드 미설정' };
  const { error } = await supabase.auth.updateUser({ email, password });
  return error ? authErr(error) : { ok: true };
}

// 다른 계정으로 로그인 — 기기의 게스트 진행은 버려진다 (호출 전 UI가 경고)
export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  const supabase = await userClient();
  if (!supabase) return { ok: false, msg: '클라우드 미설정' };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? authErr(error) : { ok: true };
}

export async function signOutAccount(): Promise<void> {
  const supabase = await userClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string, redirectTo: string): Promise<AuthResult> {
  const supabase = await userClient();
  if (!supabase) return { ok: false, msg: '클라우드 미설정' };
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return error ? authErr(error) : { ok: true };
}

export async function applyNewPassword(password: string): Promise<AuthResult> {
  const supabase = await userClient();
  if (!supabase) return { ok: false, msg: '클라우드 미설정' };
  const { error } = await supabase.auth.updateUser({ password });
  return error ? authErr(error) : { ok: true };
}
