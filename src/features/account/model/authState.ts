import type { Me } from '../api/accountApi';

export interface AuthState {
  uid: string | null;
  email: string | null;
  cloud: boolean;
  loading: boolean;
}

export function createInitialAuthState(): AuthState {
  return {
    uid: null,
    email: null,
    cloud: true,
    loading: true,
  };
}

export function applyAuthMe(state: AuthState, me: Me | null | undefined): AuthState {
  if (!me) {
    return {
      ...state,
      loading: false,
    };
  }
  return {
    ...state,
    uid: me.uid,
    email: me.email,
    cloud: me.cloud,
    loading: false,
  };
}

export function applyAuthCloud(state: AuthState, cloud: boolean): AuthState {
  if (state.cloud === cloud) return state;
  return {
    ...state,
    cloud,
  };
}

export function setAuthLoading(state: AuthState, loading: boolean): AuthState {
  if (state.loading === loading) return state;
  return {
    ...state,
    loading,
  };
}
