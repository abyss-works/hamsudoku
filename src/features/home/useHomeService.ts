import { useEffect, useRef } from 'react';
import { homeGate, homeModel } from './homeLogic';
import type { HomeServiceOptions } from './home.types';
import { useOverlayScope } from '../../ui/useOverlayScope';

export function useHomeService({
  email,
  nickname,
  uid,
  summary,
  onSignin,
  onBaseChosen,
  onCancelSignin,
  onEndless,
  endlessEnabled,
  onWarmSession,
  onLogin,
}: HomeServiceOptions) {
  const latestSummary = useRef(summary);
  latestSummary.current = summary;
  const overlay = useOverlayScope('home');

  const gate = homeGate(endlessEnabled, uid, email, nickname);
  const guest = gate === 'guest';

  // 홈에 들어올 때마다 요약(씨앗 잔액·내 순위)을 최신으로 맞춘다.
  // 조용한 재요청을 쓴다 — loading 토글이 부팅 게이트를 재고정하면 화면 전환 직후
  // 스플래시로 되돌아가는 결함이 생긴다.
  useEffect(() => {
    void summary.refreshSoft();
    // summary 객체는 렌더마다 새로 만들어지므로 최초 1회만 본다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openProfile = () => {
    onWarmSession();
    overlay.open({ type: 'profile', slot: 'profile' });
  };
  const openSettings = () => {
    overlay.open({ type: 'settings', slot: 'settings' });
  };
  const closeSettings = () => {
    overlay.close({ slot: 'settings' });
  };
  const closeProfile = () => {
    overlay.close({ slot: 'profile' });
  };
  const openRank = () => {
    overlay.open({ type: 'rank', slot: 'rank' });
    void summary.refreshSoft();
    void summary.refreshMyRank();
  };
  const closeRank = () => {
    overlay.close({ slot: 'rank' });
  };
  const enterEndless = () => {
    if (gate === 'guest') {
      overlay.open({ type: 'guestGate', slot: 'guestGate' });
    } else if (gate === 'nickname') {
      overlay.open({ type: 'nicknameGate', slot: 'nicknameGate' });
    } else {
      onEndless();
    }
  };
  const closeGuestGate = () => {
    overlay.close({ slot: 'guestGate' });
  };
  const guestLogin = () => {
    overlay.close({ slot: 'guestGate' });
    overlay.open({ type: 'auth', slot: 'auth' });
  };
  const enterAfterNickname = () => {
    overlay.close({ slot: 'nicknameGate' });
    onEndless();
  };
  const profileLogin = () => {
    overlay.close({ slot: 'profile' });
    onLogin();
  };
  const guestLink = () => {
    overlay.open({ type: 'auth', slot: 'auth' });
  };
  const signinHeld = (email: string, password: string) => onSignin(email, password, true);
  const fetchAccountSeeds = async () => {
    const account = await latestSummary.current.refreshSoft();
    return account?.wallet.balance ?? 0;
  };
  const guestAccount = guest ? { seeds: summary.me?.wallet.balance ?? 0, clears: summary.me?.clearedCount ?? 0 } : null;
  const baseChosen = () => onBaseChosen?.();
  const cancelAuth = () => {
    onCancelSignin?.();
    overlay.close({ slot: 'auth' });
  };
  const closeAuth = () => {
    overlay.close({ slot: 'auth' });
  };

  const settingsOpen = overlay.isOpen('settings', 'settings');
  const profileOpen = overlay.isOpen('profile', 'profile');
  const rankOpen = overlay.isOpen('rank', 'rank');
  const guestGateOpen = overlay.isOpen('guestGate', 'guestGate');
  const nicknameGateOpen = overlay.isOpen('nicknameGate', 'nicknameGate');
  const authOpen = overlay.isOpen('auth', 'auth');

  const model = homeModel({ endlessEnabled, summary, email });

  return {
    settingsOpen,
    profileOpen,
    rankOpen,
    guestGateOpen,
    nicknameGateOpen,
    authOpen,
    openProfile,
    openSettings,
    closeSettings,
    closeProfile,
    openRank,
    closeRank,
    enterEndless,
    closeGuestGate,
    guestLogin,
    enterAfterNickname,
    profileLogin,
    guestLink,
    signinHeld,
    fetchAccountSeeds,
    guestAccount,
    baseChosen,
    cancelAuth,
    closeAuth,
    ...model,
  };
}
