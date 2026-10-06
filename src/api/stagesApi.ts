import { LEVELS } from '../game/levels.generated';
import type { Puzzle } from '../game/puzzles';
import { createLocalAuthApi, createLocalProfileApi } from './localAuth';

export interface Stage {
  id: string;
  code: string;
  title: string;
  puzzle: Puzzle;
  locked: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  stages: Stage[];
}

export async function fetchStages(): Promise<Chapter[]> {
  const levels = [...new Set(LEVELS.map((lv) => lv.level))].sort((a, b) => a - b);
  return levels.map((level) => ({
    id: `lv${level}`,
    title: `레벨 ${level}`,
    stages: LEVELS.filter((lv) => lv.level === level).map((lv) => ({
      id: `lv${lv.level}-s${lv.no}`,
      code: lv.code,
      title: `${lv.code} 스테이지`,
      puzzle: lv.puzzle,
      locked: false,
    })),
  }));
}

export type AuthResult = { ok: true } | { ok: false; msg: string; code?: string };

export type ProfileResult = { ok: true; nickname: string } | { ok: false; msg: string; code?: string };

// 닉네임 — auth 부팅 캐시와 생명주기가 달라 분리한다. 모드 선택은 auth와 같은 기준.
export interface ProfileApi {
  get(): Promise<{ nickname: string | null }>;
  save(nickname: string): Promise<ProfileResult>;
  lookup(userIds: string[]): Promise<{ nicknames: Record<string, string | null> }>;
}

export const cloudProfileApi: ProfileApi = {
  async get() {
    try {
      const res = await fetch('/api/profile/me');
      if (!res.ok) return { nickname: null };
      const data = (await res.json()) as { nickname?: string | null };
      return { nickname: data.nickname ?? null };
    } catch {
      return { nickname: null };
    }
  },
  async save(nickname: string) {
    try {
      const res = await fetch('/api/profile/nickname', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname }),
      });
      const data = (await res.json()) as ProfileResult;
      return data.ok ? { ok: true, nickname: data.nickname } : data;
    } catch {
      return { ok: false, msg: '서버에 연결하지 못했어요.' };
    }
  },
  async lookup(userIds: string[]) {
    try {
      const res = await fetch('/api/profile/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds }),
      });
      const data = (await res.json()) as { ok: boolean; nicknames?: Record<string, string | null> };
      return { nicknames: data.ok ? (data.nicknames ?? {}) : {} };
    } catch {
      return { nicknames: {} };
    }
  },
};

export type AuthMode = 'cloud' | 'local';

export interface Me {
  uid: string | null;
  email: string | null;
  cloud: boolean;
}

export interface AuthApi {
  me(): Promise<Me>;
  session(): Promise<{ uid: string | null }>;
  signup(email: string, password: string): Promise<AuthResult>;
  signin(email: string, password: string): Promise<AuthResult>;
  signout(): Promise<void>;
  reset(email: string): Promise<AuthResult>;
  setPassword(password: string): Promise<AuthResult>;
}

async function postJson(path: string, body: unknown): Promise<AuthResult> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await res.json()) as AuthResult;
  } catch {
    return { ok: false, msg: '서버에 연결하지 못했어요.' };
  }
}

export const cloudAuthApi: AuthApi = {
  async me() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) return { uid: null, email: null, cloud: true };
      const data = (await res.json()) as { uid: string | null; email: string | null; cloud?: boolean };
      return { uid: data.uid, email: data.email, cloud: data.cloud !== false };
    } catch {
      return { uid: null, email: null, cloud: true };
    }
  },
  async session() {
    try {
      const res = await fetch('/api/auth/session', { method: 'POST' });
      if (!res.ok) return { uid: null };
      return (await res.json()) as { uid: string | null };
    } catch {
      return { uid: null };
    }
  },
  signup: (email, password) => postJson('/api/auth/signup', { email, password }),
  signin: (email, password) => postJson('/api/auth/signin', { email, password }),
  reset: (email) => postJson('/api/auth/reset', { email }),
  setPassword: (password) => postJson('/api/auth/password', { password }),
  async signout() {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch {
      // 로그아웃 실패는 무시한다
    }
  },
};

// 모드 선택 — 첫 me() 응답의 cloud 플래그로 어댑터를 고른다.
// 응답이 없으면(구 서버·오프라인) 클라우드로 두고 게스트로 동작한다.
interface Boot {
  mode: AuthMode;
  me: Me;
}

let bootCache: Promise<Boot> | null = null;
let bootConsumed = false;

async function fetchBoot(): Promise<Boot> {
  const me = await cloudAuthApi.me();
  return {
    mode: me.cloud ? 'cloud' : 'local',
    me: { uid: me.uid, email: me.email, cloud: me.cloud },
  };
}

function boot(): Promise<Boot> {
  if (!bootCache) bootCache = fetchBoot();
  return bootCache;
}

let localImpl: AuthApi | null = null;

function local(): AuthApi {
  if (!localImpl) localImpl = createLocalAuthApi();
  return localImpl;
}

async function pick(): Promise<AuthApi> {
  const b = await boot();
  return b.mode === 'local' ? local() : cloudAuthApi;
}

export const authApi: AuthApi & { mode(): Promise<AuthMode> } = {
  async me() {
    const b = await boot();
    if (!bootConsumed) {
      bootConsumed = true;
      return b.me;
    }
    return pick().then((api) => api.me());
  },
  session: async () => (await pick()).session(),
  signup: async (email, password) => (await pick()).signup(email, password),
  signin: async (email, password) => (await pick()).signin(email, password),
  reset: async (email) => (await pick()).reset(email),
  setPassword: async (password) => (await pick()).setPassword(password),
  signout: async () => {
    await (await pick()).signout();
  },
  async mode() {
    return (await boot()).mode;
  },
};

// 테스트 훅 — 모드 결정을 초기화한다.
export function resetAuthApi() {
  bootCache = null;
  bootConsumed = false;
}

let localProfileImpl: ProfileApi | null = null;

function localProfile(): ProfileApi {
  if (!localProfileImpl) localProfileImpl = createLocalProfileApi();
  return localProfileImpl;
}

async function pickProfile(): Promise<ProfileApi> {
  const b = await boot();
  return b.mode === 'local' ? localProfile() : cloudProfileApi;
}

export const profileApi: ProfileApi = {
  get: async () => (await pickProfile()).get(),
  save: async (nickname: string) => (await pickProfile()).save(nickname),
  lookup: async (userIds: string[]) => (await pickProfile()).lookup(userIds),
};
