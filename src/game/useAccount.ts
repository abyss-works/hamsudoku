import { useEffect, useState } from 'react';
import { authApi } from '../api/stagesApi';

export function useAccount(): {
  uid: string | null;
  email: string | null;
  loading: boolean;
  signup: (email: string, password: string) => Promise<{ ok: boolean; msg?: string }>;
  signin: (email: string, password: string) => Promise<{ ok: boolean; msg?: string }>;
  signout: () => Promise<void>;
} {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi
      .me()
      .then(async ({ uid: id, email: mail }) => {
        if (id) return { uid: id, email: mail };
        await authApi.session();
        return authApi.me();
      })
      .then(({ uid: id, email: mail }) => {
        setUid(id);
        setEmail(mail);
        setLoading(false);
      });
  }, []);

  const refresh = async () => {
    const m = await authApi.me();
    setUid(m.uid);
    setEmail(m.email);
  };

  return {
    uid,
    email,
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
    },
  };
}
