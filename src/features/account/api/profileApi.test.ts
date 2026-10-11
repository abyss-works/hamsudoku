// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalProfileApi } from './localAuth';
import { cloudProfileApi } from './accountApi';

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
  vi.unstubAllGlobals();
});

describe('cloudProfileApi', () => {
  it('내 닉네임을 조회한다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, nickname: '햄찌' }) })));
    expect(await cloudProfileApi.get()).toEqual({ nickname: '햄찌' });
  });
  it('조회 실패는 null이다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    expect(await cloudProfileApi.get()).toEqual({ nickname: null });
  });
  it('닉네임을 저장한다', async () => {
    const fetchMock = vi.fn(async () => ({ json: async () => ({ ok: true, nickname: '햄찌' }) }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await cloudProfileApi.save('햄찌')).toEqual({ ok: true, nickname: '햄찌' });
    expect(fetchMock).toHaveBeenCalledWith('/api/profile/nickname', expect.objectContaining({ method: 'POST' }));
  });
  it('서버 거부 메시지를 그대로 돌려준다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ ok: false, msg: '닉네임은 2~12자로 입력하세요.' }) })));
    expect(await cloudProfileApi.save(' ')).toEqual({ ok: false, msg: '닉네임은 2~12자로 입력하세요.' });
  });
  it('여러 uid의 닉네임을 조회한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({ ok: true, nicknames: { u1: '햄찌', u2: null } }) })),
    );
    expect(await cloudProfileApi.lookup(['u1', 'u2'])).toEqual({ nicknames: { u1: '햄찌', u2: null } });
  });
  it('연결 실패는 빈 매핑이다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('down');
    }));
    expect(await cloudProfileApi.lookup(['u1'])).toEqual({ nicknames: {} });
  });
});

describe('createLocalProfileApi', () => {
  it('저장한 닉네임을 돌려준다', async () => {
    const api = createLocalProfileApi(memStorage());
    expect(await api.get()).toEqual({ nickname: null });
    expect(await api.save('햄찌')).toEqual({ ok: true, nickname: '햄찌' });
    expect(await api.get()).toEqual({ nickname: '햄찌' });
  });
  it('규칙에 어긋나면 저장하지 않는다', async () => {
    const api = createLocalProfileApi(memStorage());
    expect((await api.save(' ')).ok).toBe(false);
    expect(await api.get()).toEqual({ nickname: null });
  });
  it('조회는 빈 매핑이다 (로컬에 남의 기록이 없다)', async () => {
    const api = createLocalProfileApi(memStorage());
    await api.save('햄찌');
    expect(await api.lookup(['u1'])).toEqual({ nicknames: {} });
  });
});
