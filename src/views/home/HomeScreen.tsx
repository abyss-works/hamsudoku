import { PawPrint, Settings, Sprout, Trophy, User } from 'lucide-react';
import { useHomeService } from '../../features/home/useHomeService';
import type { HomeServiceOptions } from '../../features/home/home.types';
import { Button } from '../../ui/Button';
import { GuestEndlessDialog } from '../account/GuestEndlessDialog';
import { NicknameGateDialog } from '../account/NicknameGateDialog';
import { SettingsDialog } from './SettingsDialog';
import { ProfileDialog } from '../account/ProfileDialog';
import { AuthDialog } from '../account/AuthDialog';
import { RankDialog } from '../ranking/RankDialog';

export interface HomeScreenProps extends HomeServiceOptions {
  sound: boolean;
  onToggleSound: () => void;
  onBrowse: () => void;
  onSaveNickname: (name: string) => Promise<{ ok: boolean; msg?: string }>;
  onSignup: (e: string, p: string) => Promise<{ ok: boolean; code?: string; msg?: string }>;
  onReset: (e: string) => Promise<{ ok: boolean; msg?: string }>;
  onLogout: () => void;
}

export function HomeScreen({
  email,
  nickname,
  uid,
  summary,
  sound,
  onToggleSound,
  onBaseChosen,
  onCancelSignin,
  onBrowse,
  onEndless,
  endlessEnabled,
  onWarmSession,
  onSaveNickname,
  onSignup,
  onSignin,
  onReset,
  onLogin,
  onLogout,
}: HomeScreenProps) {
  const {
    settingsOpen,
    profileOpen,
    rankOpen,
    guestGateOpen,
    nicknameGateOpen,
    authOpen,
    showWallet,
    walletBalance,
    walletAriaLabel,
    signedIn,
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
  } = useHomeService({
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
  });

  return (
    <div className="home">
      <div className="home-top">
        <Button variant="sticker" aria-label="프로필" onClick={openProfile}>
          <User size={22} aria-hidden="true" />
        </Button>
        <Button variant="sticker" aria-label="설정" onClick={openSettings}>
          <Settings size={22} aria-hidden="true" />
        </Button>
      </div>
      <div className="home-mascot" aria-hidden="true">
        <img src="/hamster-mascot.svg" alt="" />
      </div>
      <h1 className="home-title">
        <PawPrint size={34} aria-hidden="true" /> hamsudoku
      </h1>
      <p className="home-sub">숨은 햄스터를 찾아라</p>
      {showWallet && (
        <div className="seed-box" role="status" aria-label={walletAriaLabel!}>
          <Sprout size={20} aria-hidden="true" />
          <span className="seed-count">{walletBalance}</span>
        </div>
      )}
      <div className="home-actions">
        <Button variant="sticker" className="btn-primary" onClick={onBrowse}>
          스테이지
        </Button>
        <div className="home-endless-row">
          <Button
            variant="sticker"
            className="btn-sun home-endless-main"
            disabled={!endlessEnabled}
            onClick={enterEndless}
          >
            무한모드
          </Button>
          {endlessEnabled && (
            <Button
              variant="sticker"
              className="btn-icon home-trophy"
              aria-label="랭킹"
              onClick={openRank}
            >
              <Trophy size={22} aria-hidden="true" />
            </Button>
          )}
        </div>
        {!endlessEnabled && <p className="home-note">무한모드는 온라인 연결이 필요해요</p>}
      </div>
      {guestGateOpen && (
        <GuestEndlessDialog
          onClose={closeGuestGate}
          onLogin={guestLogin}
        />
      )}
      {nicknameGateOpen && (
        <NicknameGateDialog
          onSaveNickname={onSaveNickname}
          onEnter={enterAfterNickname}
          onLater={enterAfterNickname}
        />
      )}
      {settingsOpen && <SettingsDialog sound={sound} onToggleSound={onToggleSound} onClose={closeSettings} />}
      {profileOpen && (
        <ProfileDialog
          email={email}
          nickname={nickname}
          onSaveNickname={onSaveNickname}
          onLogin={profileLogin}
          onLogout={onLogout}
          onClose={closeProfile}
          onGuestLink={guestLink}
        />
      )}
      {authOpen && (
        <AuthDialog
          signup={onSignup}
          signin={signinHeld}
          reset={onReset}
          fetchAccountSeeds={fetchAccountSeeds}
          guest={guestAccount}
          onBase={baseChosen}
          onBack={cancelAuth}
          onDone={closeAuth}
        />
      )}
      {rankOpen && (
        <RankDialog
          rank={summary.rank}
          myRank={summary.myRank}
          uid={uid}
          signedIn={signedIn}
          onClose={closeRank}
        />
      )}
    </div>
  );
}
