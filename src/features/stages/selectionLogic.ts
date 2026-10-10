import type { Chapter, Stage } from "./catalog";
import type { ClearEntry } from '../../shared/saveTypes';

function elapsed(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export interface StageViewModel {
  stage: Stage;
  number: number;
  best: string;
  label: string;
  locked: boolean;
  cleared: boolean;
}

export interface ChapterTabModel {
  id: string;
  title: string;
  active: boolean;
}

export function selectionModel(chapters: Chapter[], selectedId: string | null, clears: Map<string, ClearEntry>) {
  const active = chapters.find(c => c.id === selectedId) ?? chapters[0];
  const chapterTabs: ChapterTabModel[] = chapters.map((c) => ({
    id: c.id,
    title: c.title,
    active: c.id === active?.id,
  }));
  const stages: StageViewModel[] = (active?.stages ?? []).map((stage, i) => {
    const entry = clears.get(stage.code);
    const best = entry ? elapsed(entry.elapsedSec) : '-';
    return {
      stage,
      number: i + 1,
      best,
      label: entry ? `${i + 1}, 베스트 ${best}` : String(i + 1),
      locked: stage.locked,
      cleared: Boolean(entry),
    };
  });
  return { active, chapterTabs, stages };
}

export function stageHudModel(stageCode: string, elapsedText: string, hamsterCount: number, puzzleSize: number) {
  return {
    hudText: `${stageCode} · ${elapsedText}`,
    hamsterDotsLabel: `햄스터 ${hamsterCount}/${puzzleSize}`,
    dots: Array.from({ length: puzzleSize }, (_, i) => ({
      id: i,
      on: i < hamsterCount,
    })),
  };
}
