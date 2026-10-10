import type { Chapter } from "./catalog";
import type { ClearEntry } from '../../shared/saveTypes';

function elapsed(sec: number) { return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }

export function selectionModel(chapters: Chapter[], selectedId: string | null, clears: Map<string, ClearEntry>) {
  const active = chapters.find(c => c.id === selectedId) ?? chapters[0];
  const stages = (active?.stages ?? []).map((stage, i) => {
    const entry = clears.get(stage.code);
    const best = entry ? elapsed(entry.elapsedSec) : '-';
    return { stage, number: i + 1, best, label: entry ? `${i + 1}, 베스트 ${best}` : String(i + 1) };
  });
  return { active, stages };
}
