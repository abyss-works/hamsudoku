import { useCallback } from 'react';
import type { AuthResult, ProfileResult } from '../api/accountApi';
import { useAuthService } from './useAuthService';
import { useProfileService } from './useProfileService';

export function useAccount(): {
  uid: string | null;
  email: string | null;
  nickname: string | null;
  cloud: boolean;
  loading: boolean;
  signup: (email: string, password: string) => Promise<AuthResult>;
  signin: (email: string, password: string) => Promise<AuthResult>;
  signout: () => Promise<void>;
  /** 진입점 예열 — 게스트의 익명 세션을 미리 확보한다. 로그인 사용자는 건드리지 않는다. */
  warmSession: () => Promise<void>;
  reset: (email: string) => Promise<AuthResult>;
  setPassword: (password: string) => Promise<AuthResult>;
  saveNickname: (nickname: string) => Promise<ProfileResult>;
} {
  const profile = useProfileService();

  const handleBootAuth = useCallback(
    (uid: string | null) => {
      if (uid) {
        void profile.loadProfile(uid);
      } else {
        profile.resetProfile();
      }
    },
    [profile]
  );

  const auth = useAuthService({
    onBootAuth: handleBootAuth,
  });

  const refreshAccount = useCallback(async () => {
    const m = await auth.refresh();
    if (m.uid) {
      await profile.loadProfile(m.uid);
    } else {
      profile.resetProfile();
    }
  }, [auth, profile]);

  const restoreGuest = useCallback(async () => {
    const m = await auth.restoreGuest();
    if (m.uid) {
      await profile.loadProfile(m.uid);
    } else {
      profile.resetProfile();
    }
  }, [auth, profile]);

  const signup = useCallback(
    async (email: string, password: string) => {
      const r = await auth.signup(email, password);
      if (r.ok) await refreshAccount();
      return r;
    },
    [auth, refreshAccount]
  );

  const signin = useCallback(
    async (email: string, password: string) => {
      const r = await auth.signin(email, password);
      if (r.ok) await refreshAccount();
      return r;
    },
    [auth, refreshAccount]
  );

  const signout = useCallback(async () => {
    await auth.signout();
    await restoreGuest();
  }, [auth, restoreGuest]);

  // 최신 상태 guard가 적용된 AuthService의 warmSession 계약을 조합
  // 실제 세션 복원이 발생했을 때만 프로필을 동기화한다
  const warmSession = useCallback(async () => {
    const res = await auth.warmSession();
    if (res.restored) {
      if (res.me?.uid) {
        await profile.loadProfile(res.me.uid);
      } else {
        profile.resetProfile();
      }
    }
  }, [auth.warmSession, profile]);

  const saveNickname = useCallback(
    async (nickname: string) => {
      return profile.saveNickname(nickname, auth.uid);
    },
    [auth.uid, profile]
  );

  return {
    uid: auth.uid,
    email: auth.email,
    nickname: profile.nickname,
    cloud: auth.cloud,
    loading: auth.loading,
    signup,
    signin,
    signout,
    warmSession,
    reset: auth.reset,
    setPassword: auth.setPassword,
    saveNickname,
  };
}
