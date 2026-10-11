import { useClears } from '../features/stages/useClears';
import { useAccount } from '../features/account/useAccount';
import { useEndlessSummary } from '../features/endless/useEndlessSummary';
import { useStages } from '../features/stages/useStages';
import { useStageRecordsSync } from '../features/stages/useStageRecordsSync';
import { useAppBoot } from './useAppBoot';
import { useAppNavigation } from './useAppNavigation';
import { useAccountTransfer } from './useAccountTransfer';
import { useSoundPreferences, useSoundToggle } from '../platform/audio/useSoundPreferences';

export function useAppService() {
  const clearsService = useClears();
  const { clears, record, replace, mergeIn, reset, sound, setSound } = clearsService;
  const account = useAccount();
  const { chapters, loading, error } = useStages();
  const summary = useEndlessSummary(account.cloud, account.uid);

  const boot = useAppBoot({
    accountLoading: account.loading,
    stagesLoading: loading,
    cloud: account.cloud,
    hasSummary: summary.me !== null || summary.error !== null,
  });

  const goLoginExpired = () => {
    void account.signout();
    navigation.openLogin();
  };

  const recordsSync = useStageRecordsSync({
    account: {
      uid: account.uid,
      email: account.email,
      cloud: account.cloud,
      loading: account.loading,
    },
    save: { clears, record, replace, mergeIn },
    onUnauthorized: goLoginExpired,
  });

  const navigation = useAppNavigation({
    chapters,
    onEnterStage: (selected) => {
      recordsSync.prepareAttempt(selected);
    },
  });

  const transfer = useAccountTransfer({
    account,
    summary,
    recordsSync,
    resetClears: reset,
    onLogoutComplete: () => navigation.home(),
  });

  const handleRecord = (code: string, elapsedSec: number) => {
    recordsSync.recordClear(code, elapsedSec, navigation.stage);
  };

  useSoundPreferences(sound);
  const toggleSound = useSoundToggle(sound, () => setSound(!sound));

  return {
    screen: navigation.screen,
    stage: navigation.stage,
    chapterId: navigation.chapterId,
    clears,
    sound,
    account,
    chapters,
    loading,
    error,
    summary,
    ready: boot.ready,
    showBootLoading: boot.showBootLoading,
    linkError: navigation.linkError,
    enter: navigation.enter,
    handleRecord,
    signinThenSwitch: transfer.signinThenSwitch,
    beginSwitch: transfer.beginSwitch,
    cancelSignin: transfer.cancelSignin,
    handleLogout: transfer.handleLogout,
    goHome: navigation.goHome,
    goNextMap: navigation.goNextMap,
    toggleSound,
    browse: navigation.browse,
    openEndless: navigation.openEndless,
    openLogin: navigation.openLogin,
    home: navigation.home,
  };
}
