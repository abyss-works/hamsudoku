import { LEVELS } from '../game/levels.generated';
import type { Puzzle } from '../game/puzzles';

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

export type AuthResult = { ok: true } | { ok: false; msg: string };

export interface AuthApi {
  me(): Promise<{ uid: string | null; email: string | null }>;
  signup(email: string, password: string): Promise<AuthResult>;
  signin(email: string, password: string): Promise<AuthResult>;
  signout(): Promise<void>;
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

export const authApi: AuthApi = {
  async me() {
    try {
      const res = await fetch('/api/auth/me');
      return (await res.json()) as { uid: string | null; email: string | null };
    } catch {
      return { uid: null, email: null };
    }
  },
  signup: (email, password) => postJson('/api/auth/signup', { email, password }),
  signin: (email, password) => postJson('/api/auth/signin', { email, password }),
  async signout() {
    try {
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch {
      // 로그아웃 실패는 무시한다
    }
  },
};
