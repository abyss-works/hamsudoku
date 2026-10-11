import type { HomeServiceOptions } from '../features/home/home.types';
import { useHomeService } from '../features/home/useHomeService';
import { OverlayProvider } from '../ui/OverlayProvider';
import { HomeScreen } from '../views/home/HomeScreen';
import { HomeOverlayHost } from './HomeOverlayHost';

export interface HomeSceneProps extends HomeServiceOptions {
  sound: boolean;
  onToggleSound: () => void;
  onBrowse: () => void;
  onSaveNickname: (name: string) => Promise<{ ok: boolean; msg?: string }>;
  onSignup: (e: string, p: string) => Promise<{ ok: boolean; code?: string; msg?: string }>;
  onReset: (e: string) => Promise<{ ok: boolean; msg?: string }>;
  onLogout: () => void;
}

function HomeSceneContent({
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
}: HomeSceneProps) {
  const service = useHomeService({
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
    <HomeScreen
      showWallet={service.showWallet}
      walletBalance={service.walletBalance}
      walletAriaLabel={service.walletAriaLabel}
      endlessEnabled={endlessEnabled}
      onBrowse={onBrowse}
      enterEndless={service.enterEndless}
      openProfile={service.openProfile}
      openSettings={service.openSettings}
      openRank={service.openRank}
      overlays={
        <HomeOverlayHost
          sound={sound}
          onToggleSound={onToggleSound}
          email={email}
          nickname={nickname}
          uid={uid}
          summary={summary}
          signedIn={service.signedIn}
          onSaveNickname={onSaveNickname}
          onSignup={onSignup}
          onReset={onReset}
          onLogout={onLogout}
          closeSettings={service.closeSettings}
          closeProfile={service.closeProfile}
          closeRank={service.closeRank}
          closeGuestGate={service.closeGuestGate}
          guestLogin={service.guestLogin}
          enterAfterNickname={service.enterAfterNickname}
          profileLogin={service.profileLogin}
          guestLink={service.guestLink}
          signinHeld={service.signinHeld}
          fetchAccountSeeds={service.fetchAccountSeeds}
          guestAccount={service.guestAccount}
          baseChosen={service.baseChosen}
          cancelAuth={service.cancelAuth}
          closeAuth={service.closeAuth}
        />
      }
    />
  );
}

export function HomeScene(props: HomeSceneProps) {
  return (
    <OverlayProvider initialScopeId="home">
      <HomeSceneContent {...props} />
    </OverlayProvider>
  );
}
