import { PUZZLES, type Puzzle } from '../game/puzzles';

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

export async function fetchStages(): Promise<Chapter[]> {
  return [
    {
      id: 'lv1',
      title: '레벨 1',
      stages: [{ id: 'lv1-s1', code: '1-1', title: '1 스테이지', puzzle: PUZZLES[0], locked: false }],
    },
    {
      id: 'lv2',
      title: '레벨 2',
      stages: [{ id: 'lv2-s1', code: '2-1', title: '2-1 스테이지', puzzle: PUZZLES[1], locked: false }],
    },
  ];
}
