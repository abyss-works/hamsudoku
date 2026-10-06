import { describe, expect, it } from 'vitest';
import { normalizeNickname, validateNickname } from './nickname';

describe('normalizeNickname', () => {
  it('앞뒤 공백을 제거한다', () => {
    expect(normalizeNickname('  햄찌  ')).toBe('햄찌');
  });
});

describe('validateNickname', () => {
  it('2~12자는 통과한다', () => {
    expect(validateNickname('햄찌')).toEqual({ ok: true, nickname: '햄찌' });
  });
  it('앞뒤 공백은 제거하고 판정한다', () => {
    expect(validateNickname('  햄찌  ')).toEqual({ ok: true, nickname: '햄찌' });
  });
  it('빈 값은 거부된다', () => {
    expect(validateNickname('   ').ok).toBe(false);
  });
  it('1자는 거부된다', () => {
    expect(validateNickname('햄').ok).toBe(false);
  });
  it('13자는 거부된다', () => {
    expect(validateNickname('가나다라마바사아자차카타파').ok).toBe(false);
  });
});
