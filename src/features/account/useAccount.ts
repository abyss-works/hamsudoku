import { useEffect, useRef, useState } from 'react';
import { authApi, profileApi } from './accountApi';

export function useAccount(): {
  uid: string | null;
  email: string | null;
  nickname: string | null;
  cloud: boolean;
  loading: boolean;
  signup: (email: string, password: string) => Promise<{ ok: boolean; msg?: string; code?: string }>;
  signin: (email: string, password: string) => Promise<{ ok: boolean; msg?: string; code?: string }>;
  signout: () => Promise<void>;
  /** 진입점 예열 — 게스트의 익명 세션을 미리 확보한다. 로그인 사용자는 건드리지 않는다. */
  warmSession: () => Promise<void>;
  reset: (email: string) => Promise<{ ok: boolean; msg?: string }>;
  setPassword: (password: string) => Promise<{ ok: boolean; msg?: string }>;
  saveNickname: (nickname: string) => Promise<{ ok: boolean; msg?: string; code?: string }>;
} {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [cloud, setCloud] = useState(true);
  const [loading, setLoading] = useState(true);
  const emailRef = useRef<string | null>(null);
  emailRef.current = email;

  useEffect(() => {
    authApi
      .me()
      .then(async ({ uid: id, email: mail, cloud: cl }) => {
        setCloud(cl);
        if (id) return { uid: id, email: mail, cloud: cl };
        await authApi.session();
        return authApi.me();
      })
      .then(({ uid: id, email: mail, cloud: cl }) => {
        setUid(id);
        setEmail(mail);
        setCloud(cl);
        setLoading(false);
        if (id) {
          void profileApi.get().then((p) => setNickname(p.nickname));
        } else {
          setNickname(null);
        }
      });
  }, []);

  const refresh = async () => {
    const m = await authApi.me();
    setUid(m.uid);
    setEmail(m.email);
    setCloud(m.cloud);
    if (m.uid) {
      const p = await profileApi.get();
      setNickname(p.nickname);
    } else {
      setNickname(null);
    }
  };

  // 로그아웃·예열 뒤 게스트 복귀 — 익명 세션을 세우고 계정 상태를 읽는다.
  // 세션 호출과 me()는 실패를 null로 흡수하므로 복원 실패 시 로그아웃 상태 그대로 둔다.
  const restoreGuest = async () => {
    await authApi.session();
    await refresh();
  };

  return {
    uid,
    email,
    nickname,
    cloud,
    loading,
    signup: async (e: string, p: string) => {
      const r = await authApi.signup(e, p);
      if (r.ok) await refresh();
      return r;
    },
    signin: async (e: string, p: string) => {
      const r = await authApi.signin(e, p);
      if (r.ok) await refresh();
      return r;
    },
    signout: async () => {
      await authApi.signout();
      // 로그아웃 뒤에는 게스트로 돌아온다. 익명 세션을 다시 세우지 않으면
      // 세션 없는 상태가 남아 무한모드 게이트 같은 uid 전제가 어긋난다.
      await restoreGuest();
    },
    warmSession: async () => {
      // 로그인 사용자는 건드리지 않는다. 만료는 기존 401 경로가 처리한다.
      if (emailRef.current) return;
      await restoreGuest();
    },
    reset: (email: string) => authApi.reset(email),
    setPassword: (password: string) => authApi.setPassword(password),
    saveNickname: async (name: string) => {
      const r = await profileApi.save(name);
      if (r.ok) setNickname(r.nickname);
      return r;
    },
  };
}
