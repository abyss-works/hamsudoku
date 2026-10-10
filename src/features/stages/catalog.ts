import { LEVELS } from './levels.generated';
import type { Puzzle } from '../sudoku/model/puzzles';
export interface Stage {
  id: string;
  code: string;
  title: string;
  puzzle: Puzzle;
  locked: boolean;
}

export interface Chapter {
  id: string;
  title: string;
  stages: Stage[];
}

export function stageCatalog(): Chapter[] {
  const levels = [...new Set(LEVELS.map((lv) => lv.level))].sort((a, b) => a - b);
  return levels.map((level) => ({
    id: `lv${level}`,
    title: `레벨 ${level}`,
    stages: LEVELS.filter((lv) => lv.level === level).map((lv) => ({
      id: `lv${lv.level}-s${lv.no}`,
      code: lv.code,
      title: `${lv.code} 스테이지`,
      puzzle: lv.puzzle,
      locked: false,
    })),
  }));
}
