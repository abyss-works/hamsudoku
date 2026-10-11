import { describe, expect, it } from 'vitest';
import {
  applyAuthCloud,
  applyAuthMe,
  createInitialAuthState,
  setAuthLoading,
} from './authState';

describe('authState 순수 전이', () => {
  it('초기 상태는 loading이 true이고 uid/email이 null이다', () => {
    const s = createInitialAuthState();
    expect(s.uid).toBeNull();
    expect(s.email).toBeNull();
    expect(s.cloud).toBe(true);
    expect(s.loading).toBe(true);
  });

  it('applyAuthMe는 Me 결과를 반영하고 loading을 false로 전환한다', () => {
    const s = createInitialAuthState();
    const next = applyAuthMe(s, { uid: 'u1', email: 'u1@test.com', cloud: false });
    expect(next.uid).toBe('u1');
    expect(next.email).toBe('u1@test.com');
    expect(next.cloud).toBe(false);
    expect(next.loading).toBe(false);
  });

  it('applyAuthCloud는 동일한 cloud 값이면 객체를 재할당하지 않는다', () => {
    const s = createInitialAuthState();
    const next = applyAuthCloud(s, true);
    expect(next).toBe(s);

    const changed = applyAuthCloud(s, false);
    expect(changed.cloud).toBe(false);
  });

  it('setAuthLoading은 동일한 loading 상태면 객체를 재할당하지 않는다', () => {
    const s = createInitialAuthState();
    const next = setAuthLoading(s, true);
    expect(next).toBe(s);

    const changed = setAuthLoading(s, false);
    expect(changed.loading).toBe(false);
  });
});
