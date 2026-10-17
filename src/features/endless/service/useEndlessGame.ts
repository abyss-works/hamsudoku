import { useEffect, useLayoutEffect, useRef } from 'react';
import type { PlayLog } from '../../../shared/endless';
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
  // 현재 화면의 액션을 무효화한다. 커밋 직후 이벤트가 이전 시도로 판정되지 않도록
  // 페인트 전에 동기 실행되는 layout effect로 맞춘다.
  const stageRef = useRef(session.stageId);
  const roundRef = useRef(session.roundId);
  useLayoutEffect(() => {
    stageRef.current = session.stageId;
    roundRef.current = session.roundId;
  }, [session.stageId, session.roundId]);

  const clearModel = endlessClearModel({
    result: session.finishResult,
    error: session.error,
    submitting: session.submitting,
    starting: session.starting,
    seedLeft: session.seeds,
  });

  const hud = endlessHudModel(session.mirror.wallet.balance, session.seeds);

  // 판을 시작하고 결과에 따라 오버레이를 정리한다. stageId를 주면 그 판에 다시 도전한다.
  const begin = (stageId?: string) => {
    if (roundRef.current !== boundRoundId || stageRef.current !== boundStageId) return;
    openedGameOverRef.current = true;
    overlay.close({ slot: 'endless-gameover' });
    void track(
      (stageId === undefined ? session.start() : session.start(stageId)).then(
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
  };

  return {
    ...session,
    showEntryLoading,
    clearModel,
    hud,
    reportWrong: (log?: PlayLog) => {
      if (roundRef.current !== boundRoundId || stageRef.current !== boundStageId) return;
      session.reportWrong(log);
    },
    next: () => begin(),
    retry: () => begin(boundStageId ?? undefined),
    finishBoard: (log?: PlayLog) => {
      if (roundRef.current !== boundRoundId || stageRef.current !== boundStageId) return;
      overlay.open({ type: 'clear', slot: 'endless-clear' });
      void session.finish(log);
    },
  };
}

// 무한모드 화면이 의존하는 표시·액션 계약. 화면은 훅 반환 전체가 아니라 이 집합에만 의존한다.
export type EndlessGameView = Pick<
  ReturnType<typeof useEndlessGame>,
  'puzzle' | 'error' | 'showEntryLoading' | 'hud' | 'roundId' | 'reportWrong' | 'finishBoard'
>;
