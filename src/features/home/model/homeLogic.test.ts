import { describe, expect, it } from 'vitest';
import { homeGate, homeModel } from './homeLogic';

describe('homeLogic pure view models', () => {
  it('homeGate 진입 분기를 올바르게 판정한다', () => {
    expect(homeGate(true, 'uid', null, null)).toBe('guest');
    expect(homeGate(true, 'uid', 'a@b.com', null)).toBe('nickname');
    expect(homeGate(true, 'uid', 'a@b.com', '햄찌')).toBe('enter');
    expect(homeGate(false, 'uid', null, null)).toBe('enter');
  });

  it('homeModel이 지갑 aria-label, balance=0 보존, 로그인 여부를 올바르게 계산한다', () => {
    // 1. 온라인 비활성화 또는 me 없음
    const off = homeModel({ endlessEnabled: false, summary: { me: null }, email: null });
    expect(off.showWallet).toBe(false);
    expect(off.walletBalance).toBe(0);
    expect(off.walletAriaLabel).toBeNull();
    expect(off.signedIn).toBe(false);

    // 2. 온라인 활성화 + balance=0 보존
    const zero = homeModel({
      endlessEnabled: true,
      summary: { me: { wallet: { balance: 0 } } },
      email: 'user@test.com',
    });
    expect(zero.showWallet).toBe(true);
    expect(zero.walletBalance).toBe(0);
    expect(zero.walletAriaLabel).toBe('씨앗 0개');
    expect(zero.signedIn).toBe(true);

    // 3. 잔액이 있는 경우
    const balance = homeModel({
      endlessEnabled: true,
      summary: { me: { wallet: { balance: 42 } } },
      email: null,
    });
    expect(balance.showWallet).toBe(true);
    expect(balance.walletBalance).toBe(42);
    expect(balance.walletAriaLabel).toBe('씨앗 42개');
    expect(balance.signedIn).toBe(false);
  });
});
