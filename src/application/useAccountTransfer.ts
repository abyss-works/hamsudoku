import type { useAccount } from '../features/account/useAccount';
import type { useEndlessSummary } from '../features/endless/useEndlessSummary';
import type { useStageRecordsSync } from '../features/stages/useStageRecordsSync';

export interface AccountTransferOptions {
  account: Pick<ReturnType<typeof useAccount>, 'signin' | 'signout'>;
  summary: Pick<ReturnType<typeof useEndlessSummary>, 'refreshSoft'>;
  recordsSync: Pick<ReturnType<typeof useStageRecordsSync>, 'markSwitched' | 'beginSwitch' | 'cancelSwitch' | 'resetSync'>;
  resetClears: () => void;
  onLogoutComplete: () => void;
}

export function useAccountTransfer({
  account,
  summary,
  recordsSync,
  resetClears,
  onLogoutComplete,
}: AccountTransferOptions) {
  const signinThenSwitch = (email: string, password: string, hold = false) => {
    recordsSync.markSwitched(hold);
    return account.signin(email, password).then((result) => {
      if (!result.ok) {
        recordsSync.cancelSwitch();
      }
      return result;
    });
  };

  const beginSwitch = () => {
    recordsSync.beginSwitch();
  };

  const cancelSignin = () => {
    recordsSync.cancelSwitch();
    void account.signout().then(() => {
      void summary.refreshSoft();
    });
  };

  const handleLogout = () => {
    recordsSync.resetSync();
    void account.signout().then(() => {
      resetClears();
      onLogoutComplete();
    });
  };

  return {
    signinThenSwitch,
    beginSwitch,
    cancelSignin,
    handleLogout,
  };
}
