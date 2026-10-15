import { useClears } from '../../features/stages/service/useClears';
import { useAccount } from '../../features/account/service/useAccount';
import { useEndlessSummary } from '../../features/endless/service/useEndlessSummary';
import { useStages } from '../../features/stages/service/useStages';
import { useStageRecordsSync } from '../../features/stages/service/useStageRecordsSync';
import { useAppBoot } from './useAppBoot';
import { useAppNavigation } from './useAppNavigation';
import { useAccountTransfer } from './useAccountTransfer';
import { useSoundPreferences, useSoundToggle } from '../../platform/audio/useSoundPreferences';

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

  // 재도전은 새 판 시작이므로 진입과 같은 입장 키 발급 조율을 다시 거친다.
  const handleRetry = () => {
    if (navigation.stage) recordsSync.prepareAttempt(navigation.stage);
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
    handleRetry,
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
