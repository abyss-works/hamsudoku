import { useCallback, useEffect, useRef, useState } from 'react';
import { authApi, type AuthResult, type Me } from './accountApi';
import {
  applyAuthCloud,
  applyAuthMe,
  createInitialAuthState,
  type AuthState,
} from './authState';

export interface AuthServiceOptions {
  onBootAuth?: (uid: string | null) => void;
}

export interface WarmSessionResult {
  restored: boolean;
  me: Me | null;
}

export interface AuthService {
  uid: string | null;
  email: string | null;
  cloud: boolean;
  loading: boolean;
  signup: (email: string, password: string) => Promise<AuthResult>;
  signin: (email: string, password: string) => Promise<AuthResult>;
  signout: () => Promise<void>;
  warmSession: () => Promise<WarmSessionResult>;
  restoreGuest: () => Promise<Me>;
  refresh: () => Promise<Me>;
  reset: (email: string) => Promise<AuthResult>;
  setPassword: (password: string) => Promise<AuthResult>;
}

export function useAuthService(options: AuthServiceOptions = {}): AuthService {
  const [state, setState] = useState<AuthState>(createInitialAuthState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const isMountedRef = useRef(true);
  const mountInstanceIdRef = useRef(0);
  const onBootAuthRef = useRef(options.onBootAuth);
  onBootAuthRef.current = options.onBootAuth;

  useEffect(() => {
    isMountedRef.current = true;
    const instanceId = ++mountInstanceIdRef.current;

    authApi
      .me()
      .then(async (bootMe) => {
        if (!isMountedRef.current || instanceId !== mountInstanceIdRef.current) return null;
        if (bootMe) {
          setState((prev) => applyAuthCloud(prev, bootMe.cloud));
          if (bootMe.uid) return bootMe;
        }
        await authApi.session();
        if (!isMountedRef.current || instanceId !== mountInstanceIdRef.current) return null;
        return authApi.me();
      })
      .then((me) => {
        if (!me || !isMountedRef.current || instanceId !== mountInstanceIdRef.current) return;
        setState((prev) => applyAuthMe(prev, me));
        onBootAuthRef.current?.(me.uid);
      });

    return () => {
      isMountedRef.current = false;
      ++mountInstanceIdRef.current;
    };
  }, []);

  const refresh = useCallback(async (): Promise<Me> => {
    const me = await authApi.me();
    if (isMountedRef.current) {
      setState((prev) => applyAuthMe(prev, me));
    }
    return me;
  }, []);

  const restoreGuest = useCallback(async (): Promise<Me> => {
    await authApi.session();
    return refresh();
  }, [refresh]);

  const warmSession = useCallback(async (): Promise<WarmSessionResult> => {
    // 최신 상태 guard: 로그인된 사용자(email 존재)는 세션을 건드리지 않는다.
    if (stateRef.current.email) {
      return { restored: false, me: null };
    }
    const me = await restoreGuest();
    return { restored: true, me };
  }, [restoreGuest]);

  const signup = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    return authApi.signup(email, password);
  }, []);

  const signin = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    return authApi.signin(email, password);
  }, []);

  const signout = useCallback(async (): Promise<void> => {
    await authApi.signout();
  }, []);

  const reset = useCallback((email: string) => authApi.reset(email), []);
  const setPassword = useCallback((password: string) => authApi.setPassword(password), []);

  return {
    uid: state.uid,
    email: state.email,
    cloud: state.cloud,
    loading: state.loading,
    signup,
    signin,
    signout,
    warmSession,
    restoreGuest,
    refresh,
    reset,
    setPassword,
  };
}
