import { createHash } from 'node:crypto';
import { validateNickname } from './nickname';
import type { AuthApi, ProfileApi } from './accountApi';

const KEY = 'hamsudoku:account:v1';
const PROFILE_KEY = 'hamsudoku:profile:v1';

interface Stored {
  uid: string | null;
  email: string;
  passHash: string;
}

// 로컬 어댑터 전용 해시 — 브라우저 폴백 용도이며 webcrypto 대신 동기 해시로 통일한다.
function sha256Hex(s: string): string {
  return createHash('sha256').update(`hamsudoku:${s}`).digest('hex');
}

function valid(email: string, password: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && password.length >= 6;
}

// 로컬 어댑터 — 서버 미설정 때 클라우드 어댑터 대신 쓴다. 계정은 이 기기에만 둔다.
export function createLocalAuthApi(store: Storage = localStorage): AuthApi {
  const load = (): Stored | null => {
    try {
      const raw = store.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Stored;
      if (typeof parsed.email !== 'string' || typeof parsed.passHash !== 'string') return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const save = (a: Stored) => {
    store.setItem(KEY, JSON.stringify(a));
  };

  return {
    async me() {
      const a = load();
      if (!a || !a.uid) return { uid: null, email: null, cloud: false };
      return { uid: a.uid, email: a.email, cloud: false };
    },
    async session() {
      const { uid } = await this.me();
      return { uid };
    },
    async signup(email: string, password: string) {
      if (!valid(email, password)) return { ok: false, msg: '이메일과 비밀번호를 확인하세요.' };
      const a = load();
      if (a && a.email === email) {
        return { ok: false, msg: '이미 가입된 이메일이에요.', code: 'user_already_exists' };
      }
      const uid = `local-${globalThis.crypto.randomUUID()}`;
      save({ uid, email, passHash: sha256Hex(password) });
      return { ok: true };
    },
    async signin(email: string, password: string) {
      if (!valid(email, password)) return { ok: false, msg: '이메일과 비밀번호를 확인하세요.' };
      const fail = { ok: false as const, msg: '이메일 또는 비밀번호가 틀렸어요.', code: 'invalid_credentials' };
      const a = load();
      if (!a || a.email !== email) return fail;
      if (sha256Hex(password) !== a.passHash) return fail;
      const next = { ...a, uid: a.uid ?? `local-${globalThis.crypto.randomUUID()}` };
      save(next);
      return { ok: true };
    },
    async signout() {
      const a = load();
      if (a) save({ ...a, uid: null });
    },
    async reset() {
      return { ok: false as const, msg: '로컬 모드에서는 메일을 보낼 수 없어요.' };
    },
    async setPassword() {
      return { ok: false as const, msg: '로컬 모드에서는 비밀번호를 바꿀 수 없어요.' };
    },
  };
}

// 로컬 프로필 — 기기당 하나. 남의 기록이 없어 조회는 빈 매핑이다.
export function createLocalProfileApi(store: Storage = localStorage): ProfileApi {
  return {
    async get() {
      try {
        const raw = store.getItem(PROFILE_KEY);
        if (!raw) return { nickname: null };
        const parsed = JSON.parse(raw) as { nickname?: unknown };
        return { nickname: typeof parsed.nickname === 'string' ? parsed.nickname : null };
      } catch {
        return { nickname: null };
      }
    },
    async save(nickname: string) {
      const v = validateNickname(nickname);
      if (!v.ok) return { ok: false, msg: v.msg };
      store.setItem(PROFILE_KEY, JSON.stringify({ nickname: v.nickname }));
      return { ok: true, nickname: v.nickname };
    },
    async lookup() {
      return { nicknames: {} };
    },
  };
}
