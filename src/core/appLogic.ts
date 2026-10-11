import type { Chapter, Stage } from '../features/stages/stagesApi';

export type Screen = 'home' | 'select' | 'game' | 'login' | 'recovery' | 'endless';
export const BOOT_TIMEOUT_MS = 5000;

export function recoveryState(search: string): { screen: Screen; linkError: boolean } {
  const value = new URLSearchParams(search);
  return { screen: value.has('recovery') ? 'recovery' : 'home', linkError: value.get('recovery') === 'error' };
}

export function stageSelection(chapters: Chapter[], id: string | null) {
  const stages = chapters.flatMap((chapter) => chapter.stages);
  return { stages, stage: stages.find((stage) => stage.id === id) ?? null };
}

export function chapterForStage(chapters: Chapter[], stage: Stage): string | null {
  return chapters.find((chapter) => chapter.stages.some((candidate) => candidate.id === stage.id))?.id ?? null;
}

export function nextStage(stages: Stage[], stage: Stage | null): Stage | null {
  if (!stage) return null;
  return stages[stages.findIndex((candidate) => candidate.id === stage.id) + 1] ?? null;
}

export function bootReady(fontsReady: boolean, timedOut: boolean, accountLoading: boolean, stagesLoading: boolean, cloud: boolean, hasSummary: boolean): boolean {
  return fontsReady && (timedOut || (!accountLoading && !stagesLoading && (!cloud || hasSummary)));
}
