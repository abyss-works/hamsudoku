import { useState } from 'react';
import type { Chapter, Stage } from '../features/stages/stagesApi';
import { chapterForStage, nextStage, recoveryState, stageSelection, type Screen } from './appLogic';
import { locationSearch, removeRecoveryLocation } from './appBrowser';

export interface AppNavigationOptions {
  chapters: Chapter[];
  onEnterStage?: (stage: Stage) => void;
}

export function useAppNavigation({ chapters, onEnterStage }: AppNavigationOptions) {
  const [initialLocation] = useState(() => recoveryState(locationSearch()));
  const [screen, setScreen] = useState<Screen>(initialLocation.screen);
  const [stageId, setStageId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);

  const { stages, stage } = stageSelection(chapters, stageId);

  const enter = (selected: Stage) => {
    setStageId(selected.id);
    setChapterId(chapterForStage(chapters, selected));
    setScreen('game');
    onEnterStage?.(selected);
  };

  const goHome = () => {
    removeRecoveryLocation();
    setScreen('home');
  };

  const goNextMap = () => {
    const next = nextStage(stages, stage);
    if (next) enter(next);
    else setScreen('home');
  };

  return {
    screen,
    stage,
    chapterId,
    linkError: initialLocation.linkError,
    stages,
    enter,
    goHome,
    goNextMap,
    browse: () => setScreen('select'),
    openEndless: () => setScreen('endless'),
    openLogin: () => setScreen('login'),
    home: () => setScreen('home'),
    setScreen,
  };
}
