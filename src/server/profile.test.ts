import { describe, expect, it, vi } from 'vitest';
import { createMemoryDb } from './db/memory';
import { displayNicknames } from './profile';

describe('displayNicknames', () => {
  it('조회에 성공하면 uid별 닉네임을 돌려준다', async () => {
    const db = createMemoryDb();
    await db.setNickname('u1', '햄찌');
    expect(await displayNicknames(db, ['u1', 'u2'])).toEqual({ u1: '햄찌', u2: null });
  });
  it('조회가 실패하면 관측하고 모든 uid를 null로 돌려준다', async () => {
    const db = createMemoryDb();
    db.lookupNicknames = async () => { throw new Error('db down'); };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await displayNicknames(db, ['u1', 'u2'])).toEqual({ u1: null, u2: null });
    expect(warn).toHaveBeenCalledWith('Nickname lookup failed');
    warn.mockRestore();
  });
});
