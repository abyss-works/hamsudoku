import { useEffect, useRef, useState } from 'react';
import { homeGate } from './screenModels';
import type { HomeScreenProps } from './useHomeServiceContracts';
export function useHomeService({ email, nickname, uid, summary, onSignin, onBaseChosen, onCancelSignin, onEndless, endlessEnabled, onWarmSession, onLogin }: HomeScreenProps) {
  const latestSummary = useRef(summary);
  latestSummary.current = summary;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const gate = homeGate(endlessEnabled, uid, email, nickname);
  const guest = gate === 'guest';
  const [guestGateOpen, setGuestGateOpen] = useState(false);
  // 로그인 상태인데 닉네임이 없으면 진입 전에 정하도록 안내한다.
  const [nicknameGateOpen, setNicknameGateOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
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
    setProfileOpen(true);
  };
  const openSettings = () => setSettingsOpen(true);
  const closeSettings = () => setSettingsOpen(false);
  const closeProfile = () => setProfileOpen(false);
  const openRank = () => {
    setRankOpen(true);
    void summary.refreshSoft();
    void summary.refreshMyRank();
  };
  const closeRank = () => setRankOpen(false);
  const enterEndless = () => {
    if (gate === 'guest') {
      setGuestGateOpen(true);
    } else if (gate === 'nickname') {
      setNicknameGateOpen(true);
    } else {
      onEndless();
    }
  };
  const closeGuestGate = () => setGuestGateOpen(false);
  const guestLogin = () => {
    setGuestGateOpen(false);
    setAuthOpen(true);
  };
  const enterAfterNickname = () => {
    setNicknameGateOpen(false);
    onEndless();
  };
  const profileLogin = () => {
    setProfileOpen(false);
    onLogin();
  };
  const guestLink = () => setAuthOpen(true);
  const signinHeld = (email: string, password: string) => onSignin(email, password, true);
  const fetchAccountSeeds = async () => {
    const account = await latestSummary.current.refreshSoft();
    return account?.wallet.balance ?? 0;
  };
  const guestAccount = guest ? { seeds: summary.me?.wallet.balance ?? 0, clears: summary.me?.clearedCount ?? 0 } : null;
  const baseChosen = () => onBaseChosen?.();
  const cancelAuth = () => {
    onCancelSignin?.();
    setAuthOpen(false);
  };
  const closeAuth = () => setAuthOpen(false);
  return { settingsOpen, profileOpen, rankOpen, guestGateOpen, nicknameGateOpen, authOpen, openProfile, openSettings, closeSettings, closeProfile, openRank, closeRank, enterEndless, closeGuestGate, guestLogin, enterAfterNickname, profileLogin, guestLink, signinHeld, fetchAccountSeeds, guestAccount, baseChosen, cancelAuth, closeAuth };
}
