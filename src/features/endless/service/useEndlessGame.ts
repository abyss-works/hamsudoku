import { useEffect, useRef } from 'react';
import { useEndlessSession } from './useEndlessSession';
import { useDelayedLoading } from '../../../ui/useDelayedLoading';
import { useLoading } from '../../../ui/LoadingProvider';
import { endlessClearModel, endlessHudModel } from '../model/screenModels';
import { useOverlayScope } from '../../../ui/useOverlayScope';

export function useEndlessGame() {
  const session = useEndlessSession();
  const { track } = useLoading();
  const started = useRef(false);
  const showEntryLoading = useDelayedLoading(!session.puzzle);
  const overlay = useOverlayScope(`endless-${session.roundId}`);
  const openedGameOverRef = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void session.start();
  }, [session.start]);

  useEffect(() => {
    if (session.phase === 'gameover' && !openedGameOverRef.current) {
      openedGameOverRef.current = true;
      overlay.close({ slot: 'endless-clear' });
      overlay.open({ type: 'gameover', slot: 'endless-gameover' });
    }
    if (session.phase !== 'gameover') {
      openedGameOverRef.current = false;
    }
  }, [session.phase, overlay]);

  const boundStageId = session.stageId;
  const boundRoundId = session.roundId;
  const stageRef = useRef(session.stageId);
  const roundRef = useRef(session.roundId);
  stageRef.current = session.stageId;
  roundRef.current = session.roundId;

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
    reportWrong: () => {
      if (roundRef.current !== boundRoundId || stageRef.current !== boundStageId) return;
      session.reportWrong();
    },
    next: () => {
      if (roundRef.current !== boundRoundId || stageRef.current !== boundStageId) return;
      openedGameOverRef.current = true;
      overlay.close({ slot: 'endless-gameover' });
      void track(
        session.start().then(
          (ok) => {
            if (ok === false) {
              if (session.phase === 'gameover') {
                overlay.open({ type: 'gameover', slot: 'endless-gameover' });
              }
            } else {
              openedGameOverRef.current = false;
              overlay.close({ slot: 'endless-clear' });
              overlay.close({ slot: 'endless-gameover' });
            }
          },
          () => {
            if (session.phase === 'gameover') {
              overlay.open({ type: 'gameover', slot: 'endless-gameover' });
            }
          },
        ),
      );
    },
    finishBoard: () => {
      if (roundRef.current !== boundRoundId || stageRef.current !== boundStageId) return;
      overlay.open({ type: 'clear', slot: 'endless-clear' });
      void session.finish();
    },
  };
}
