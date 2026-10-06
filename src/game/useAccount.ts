import { useEffect, useState } from 'react';
import { authApi, profileApi } from '../api/stagesApi';

export function useAccount(): {
  uid: string | null;
  email: string | null;
  nickname: string | null;
  cloud: boolean;
  loading: boolean;
  signup: (email: string, password: string) => Promise<{ ok: boolean; msg?: string; code?: string }>;
  signin: (email: string, password: string) => Promise<{ ok: boolean; msg?: string; code?: string }>;
  signout: () => Promise<void>;
  reset: (email: string) => Promise<{ ok: boolean; msg?: string }>;
  setPassword: (password: string) => Promise<{ ok: boolean; msg?: string }>;
  saveNickname: (nickname: string) => Promise<{ ok: boolean; msg?: string; code?: string }>;
} {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [cloud, setCloud] = useState(true);
  const [loading, setLoading] = useState(true);

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
      setUid(null);
      setEmail(null);
      setNickname(null);
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
