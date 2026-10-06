import { describe, expect, it } from 'vitest';
import { createMemoryDb } from './db';
import { fetchNickname, lookupNicknames, saveNickname } from './profile';

describe('saveNickname', () => {
  it('검증을 통과한 닉네임이 저장된다', async () => {
    const db = createMemoryDb();
    expect(await saveNickname(db, 'u1', '햄찌')).toEqual({ status: 200, nickname: '햄찌' });
    expect((await fetchNickname(db, 'u1')).nickname).toBe('햄찌');
  });
  it('앞뒤 공백은 제거하고 저장한다', async () => {
    const db = createMemoryDb();
    expect(await saveNickname(db, 'u1', '  햄찌  ')).toEqual({ status: 200, nickname: '햄찌' });
  });
  it('덮어쓰기가 된다', async () => {
    const db = createMemoryDb();
    await saveNickname(db, 'u1', '햄찌');
    await saveNickname(db, 'u1', '치즈볼');
    expect((await fetchNickname(db, 'u1')).nickname).toBe('치즈볼');
  });
  it('규칙에 어긋나면 400이다', async () => {
    const db = createMemoryDb();
    expect((await saveNickname(db, 'u1', ' ')).status).toBe(400);
    expect((await saveNickname(db, 'u1', '햄')).status).toBe(400);
  });
  it('세션 없으면 401이다', async () => {
    const db = createMemoryDb();
    expect((await saveNickname(db, null, '햄찌')).status).toBe(401);
    expect((await fetchNickname(db, null)).status).toBe(401);
  });
});

describe('fetchNickname', () => {
  it('미설정이면 null이다', async () => {
    const db = createMemoryDb();
    expect(await fetchNickname(db, 'u1')).toEqual({ status: 200, nickname: null });
  });
});

describe('lookupNicknames', () => {
  it('여러 uid의 닉네임을 한 번에 돌려준다. 없는 uid는 null이다', async () => {
    const db = createMemoryDb();
    await saveNickname(db, 'u1', '햄찌');
    expect(await lookupNicknames(db, 'u0', ['u1', 'u2'])).toEqual({
      status: 200,
      nicknames: { u1: '햄찌', u2: null },
    });
  });
  it('세션 없으면 401이다', async () => {
    const db = createMemoryDb();
    expect((await lookupNicknames(db, null, ['u1'])).status).toBe(401);
  });
});
