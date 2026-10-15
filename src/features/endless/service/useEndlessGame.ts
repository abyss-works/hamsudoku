import { useEffect, useRef } from 'react';
import type { OverlayActions } from '../../../shared/overlay';
import type { EndlessSession } from './useEndlessSession';
import { endlessClearModel, endlessHudModel } from '../model/screenModels';

export interface EndlessGameOptions {
  overlay: OverlayActions;
  track<T>(promise: Promise<T>): Promise<T>;
  showEntryLoading: boolean;
}

export function useEndlessGame(session: EndlessSession, { overlay, track, showEntryLoading }: EndlessGameOptions) {
  const started = useRef(false);
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
  // 커밋된 시도만 ref에 반영한다. 렌더 중 갱신하면 보류된(미커밋) 다음 시도 렌더가
  // 현재 화면의 액션을 무효화한다.
  const stageRef = useRef(session.stageId);
  const roundRef = useRef(session.roundId);
  useEffect(() => {
    stageRef.current = session.stageId;
    roundRef.current = session.roundId;
  }, [session.stageId, session.roundId]);

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
