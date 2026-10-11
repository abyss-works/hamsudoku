import { describe, expect, it } from 'vitest';
import {
  applyProfileNickname,
  createInitialProfileState,
  resetProfileState,
  setProfileTarget,
} from './profileState';

describe('profileState 순수 전이 및 계정 격리', () => {
  it('초기 상태는 nickname이 null이고 generation이 0이다', () => {
    const s = createInitialProfileState('u1');
    expect(s.nickname).toBeNull();
    expect(s.targetUid).toBe('u1');
    expect(s.generation).toBe(0);
  });

  it('setProfileTarget은 대상과 generation을 순수 전이하고 nickname을 초기화한다', () => {
    const s = createInitialProfileState('u1');
    const sWithNick = applyProfileNickname(s, 'u1', 0, '햄찌');
    expect(sWithNick.nickname).toBe('햄찌');

    const sNext = setProfileTarget(sWithNick, 'u2', 1);
    expect(sNext.targetUid).toBe('u2');
    expect(sNext.nickname).toBeNull();
    expect(sNext.generation).toBe(1);

    // 동일한 대상과 세대이면 객체를 유지한다
    const same = setProfileTarget(sNext, 'u2', 1);
    expect(same).toBe(sNext);
  });

  it('applyProfileNickname은 generation이 불일치하는 오래된 응답을 무시한다', () => {
    let s = createInitialProfileState('u1');
    s = setProfileTarget(s, 'u2', 1);
    const next = applyProfileNickname(s, 'u2', 0, '오래된닉네임'); // 이전 generation 0
    expect(next).toBe(s);
    expect(next.nickname).toBeNull();
  });

  it('applyProfileNickname은 targetUid가 다른 오래된 응답을 무시한다', () => {
    const s = createInitialProfileState('u2');
    const next = applyProfileNickname(s, 'u1', 0, '다른계정닉네임');
    expect(next).toBe(s);
    expect(next.nickname).toBeNull();
  });

  it('applyProfileNickname은 generation과 targetUid가 일치하면 닉네임을 반영한다', () => {
    const s = createInitialProfileState('u1');
    const next = applyProfileNickname(s, 'u1', 0, '최신닉네임');
    expect(next.nickname).toBe('최신닉네임');
  });

  it('resetProfileState는 targetUid와 nickname을 null로 리셋하고 지정된 generation을 설정한다', () => {
    let s = createInitialProfileState('u1');
    s = applyProfileNickname(s, 'u1', 0, '닉네임');
    const reset = resetProfileState(s, 1);
    expect(reset.targetUid).toBeNull();
    expect(reset.nickname).toBeNull();
    expect(reset.generation).toBe(1);

    // 이미 리셋된 상태와 동일한 세대면 재할당하지 않는다
    expect(resetProfileState(reset, 1)).toBe(reset);
  });
});
