import { useEffect, useRef } from 'react';
import { useEndlessSession } from './useEndlessSession';
import { useDelayedLoading } from '../../ui/useDelayedLoading';
import { useLoading } from '../../ui/LoadingProvider';
import { endlessClearModel, endlessHudModel } from './screenModels';

export function useEndlessGame() {
  const session = useEndlessSession();
  const { track } = useLoading();
  const started = useRef(false);
  const showEntryLoading = useDelayedLoading(!session.puzzle);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void session.start();
  }, [session.start]);

  const clearModel = endlessClearModel({
    result: session.finishResult,
    error: session.error,
    submitting: session.submitting,
    starting: session.starting,
  });

  const hud = endlessHudModel(session.mirror.wallet.balance, session.seeds);

  return {
    ...session,
    showEntryLoading,
    clearModel,
    hud,
    next: () => {
      void track(session.start());
    },
    finishBoard: () => {
      void session.finish();
    },
  };
}
