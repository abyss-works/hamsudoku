// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createLocalAuthApi } from './localAuth';

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

afterEach(() => {
  localStorage.clear();
});

describe('createLocalAuthApi', () => {
  it('처음 보는 이메일이면 계정을 만들고 로그인 상태가 된다', async () => {
    const api = createLocalAuthApi(memStorage());
    const r = await api.signup('e@x.y', '123456');
    expect(r).toEqual({ ok: true });
    expect((await api.me()).uid).toMatch(/^local-/);
    expect((await api.me()).email).toBe('e@x.y');
  });

  it('이미 가입된 이메일이면 코드와 함께 실패한다', async () => {
    const api = createLocalAuthApi(memStorage());
    await api.signup('e@x.y', '123456');
    await api.signout();
    const r = await api.signup('e@x.y', '654321');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('user_already_exists');
  });

  it('같은 이메일·비밀번호면 다시 로그인된다', async () => {
    const api = createLocalAuthApi(memStorage());
    await api.signup('e@x.y', '123456');
    await api.signout();
    expect((await api.me()).uid).toBeNull();
    const r = await api.signin('e@x.y', '123456');
    expect(r).toEqual({ ok: true });
    expect((await api.me()).email).toBe('e@x.y');
  });

  it('모르는 이메일·틀린 비밀번호는 invalid_credentials다', async () => {
    const api = createLocalAuthApi(memStorage());
    await api.signup('e@x.y', '123456');
    const r1 = await api.signin('other@x.y', '123456');
    const r2 = await api.signin('e@x.y', 'wrongpw');
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    if (!r1.ok) expect(r1.code).toBe('invalid_credentials');
    if (!r2.ok) expect(r2.code).toBe('invalid_credentials');
  });

  it('짧은 입력은 서버 규칙과 같은 메시지로 막힌다', async () => {
    const api = createLocalAuthApi(memStorage());
    const r = await api.signup('bad', '123');
    expect(r).toEqual({ ok: false, msg: '이메일과 비밀번호를 확인하세요.' });
  });

  it('비밀번호는 평문으로 저장되지 않는다', async () => {
    const store = memStorage();
    const api = createLocalAuthApi(store);
    await api.signup('e@x.y', '123456');
    expect(store.getItem('hamsudoku:account:v1')).not.toContain('123456');
  });
});
