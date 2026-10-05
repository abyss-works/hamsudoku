import type { AuthApi } from './stagesApi';

const KEY = 'hamsudoku:account:v1';

interface Stored {
  uid: string | null;
  email: string;
  passHash: string;
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`hamsudoku:${s}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
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
      save({ uid, email, passHash: await sha256Hex(password) });
      return { ok: true };
    },
    async signin(email: string, password: string) {
      if (!valid(email, password)) return { ok: false, msg: '이메일과 비밀번호를 확인하세요.' };
      const fail = { ok: false as const, msg: '이메일 또는 비밀번호가 틀렸어요.', code: 'invalid_credentials' };
      const a = load();
      if (!a || a.email !== email) return fail;
      if ((await sha256Hex(password)) !== a.passHash) return fail;
      const next = { ...a, uid: a.uid ?? `local-${globalThis.crypto.randomUUID()}` };
      save(next);
      return { ok: true };
    },
    async signout() {
      const a = load();
      if (a) save({ ...a, uid: null });
    },
  };
}
