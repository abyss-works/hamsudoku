import { GuestEndlessDialog } from '../views/account/GuestEndlessDialog';
import { NicknameGateDialog } from '../views/account/NicknameGateDialog';
import { SettingsDialog } from '../views/home/SettingsDialog';
import { ProfileDialog } from '../views/account/ProfileDialog';
import { AuthDialog } from '../views/account/AuthDialog';
import { RankDialog } from '../views/ranking/RankDialog';
import { OverlayOutlet } from '../ui/OverlayOutlet';
import type { OverlayRequest } from '../ui/overlayTypes';
import type { EndlessSummaryState } from '../features/endless/service/useEndlessSummary';
import type { AuthDialogOptions, AuthFn } from '../features/account/model/authDialog.types';

export interface HomeOverlayHostProps {
  sound: boolean;
  onToggleSound: () => void;
  email: string | null;
  nickname: string | null;
  uid: string | null;
  summary: EndlessSummaryState;
  signedIn: boolean;
  onSaveNickname: (name: string) => Promise<{ ok: boolean; msg?: string }>;
  onSignup: (e: string, p: string) => Promise<{ ok: boolean; code?: string; msg?: string }>;
  onReset: (e: string) => Promise<{ ok: boolean; msg?: string }>;
  onLogout: () => void;
  closeSettings: () => void;
  closeProfile: () => void;
  closeRank: () => void;
  closeGuestGate: () => void;
  guestLogin: () => void;
  enterAfterNickname: () => void;
  profileLogin: () => void;
  guestLink: () => void;
  signinHeld: AuthFn;
  fetchAccountSeeds: () => Promise<number>;
  guestAccount: AuthDialogOptions['guest'];
  baseChosen: () => void;
  cancelAuth: () => void;
  closeAuth: () => void;
}

export function HomeOverlayHost({
  sound,
  onToggleSound,
  email,
  nickname,
  uid,
  summary,
  signedIn,
  onSaveNickname,
  onSignup,
  onReset,
  onLogout,
  closeSettings,
  closeProfile,
  closeRank,
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
}: HomeOverlayHostProps) {
  const renderOverlay = (overlay: OverlayRequest) => {
    switch (overlay.type) {
      case 'guestGate':
        return <GuestEndlessDialog onClose={closeGuestGate} onLogin={guestLogin} />;
      case 'nicknameGate':
        return (
          <NicknameGateDialog
            onSaveNickname={onSaveNickname}
            onEnter={enterAfterNickname}
            onLater={enterAfterNickname}
          />
        );
      case 'settings':
        return <SettingsDialog sound={sound} onToggleSound={onToggleSound} onClose={closeSettings} />;
      case 'profile':
        return (
          <ProfileDialog
            email={email}
            nickname={nickname}
            onSaveNickname={onSaveNickname}
            onLogin={profileLogin}
            onLogout={onLogout}
            onClose={closeProfile}
            onGuestLink={guestLink}
          />
        );
      case 'auth':
        return (
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
        );
      case 'rank':
        return (
          <RankDialog
            rank={summary.rank}
            myRank={summary.myRank}
            uid={uid}
            signedIn={signedIn}
            onClose={closeRank}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <OverlayOutlet slot="guestGate" render={renderOverlay} />
      <OverlayOutlet slot="nicknameGate" render={renderOverlay} />
      <OverlayOutlet slot="settings" render={renderOverlay} />
      <OverlayOutlet slot="profile" render={renderOverlay} />
      <OverlayOutlet slot="auth" render={renderOverlay} />
      <OverlayOutlet slot="rank" render={renderOverlay} />
      <OverlayOutlet slot="default" render={renderOverlay} />
    </>
  );
}
