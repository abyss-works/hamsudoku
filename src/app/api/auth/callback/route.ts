import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// 재설정 메일 링크 착지 — code를 세션으로 교환하고 새 비밀번호 화면으로 보낸다.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const { SUPABASE_URL: supaUrl, SUPABASE_ANON_KEY: anonKey } = process.env;
  if (!code || !supaUrl || !anonKey) {
    return NextResponse.redirect(`${url.origin}/?recovery=error`);
  }
  const store = await cookies();
  const supabase = createServerClient(supaUrl, anonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (pairs) => {
        for (const p of pairs) store.set(p);
      },
    },
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return NextResponse.redirect(`${url.origin}/${error ? '?recovery=error' : '?recovery=1'}`);
}
