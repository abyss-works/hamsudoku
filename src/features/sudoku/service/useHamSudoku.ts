import { useRef, useState } from 'react';
import type { Violations } from '../model/rules';
import type { CellState, Puzzle } from '../model/puzzles';
import type { TapKind } from '../model/tap';
import { createGameState, projectGame, transitionGame, type GameAction } from '../model/gameTransition';
import { createBoardSounds } from '../../../platform/audio/sound';
export { PROBE_SLOTS } from '../model/gameTransition';

export interface HamSudoku {
  cells: CellState[][];
  /** 조각 위에 올린 X 집합. 렌더만 X가 이기고 상태는 조각 그대로다. */
  xMarks: ReadonlySet<string>;
  violations: Violations;
  cleared: boolean;
  hamsterCount: number;
  pulse: ReadonlyMap<string, number>;
  hitKey: string | null;
  shake: number;
  /** 임시 정답 아이템 켜짐. 켠 동안 싱글톡은 앵커 놓기·회수만 한다. */
  probeActive: boolean;
  setProbeActive: (on: boolean) => void;
  /** 남은 앵커 슬롯. */
  probeSlots: number;
  tapCell: (r: number, c: number, kind: TapKind) => void;
  beginStroke: (r: number, c: number) => void;
  strokeEnter: (r: number, c: number) => void;
  endStroke: () => boolean;
  reset: () => void;
  /** X마커·앵커·조각을 전부 빈칸으로 되돌린다. 햄스터·정답·오답마커는 그대로 둔다. */
  resetMarks: () => void;
}

export function useHamSudoku(puzzle: Puzzle, events: { onWrong?: () => void; onClear?: () => void } = {}): HamSudoku {
  const [state, setState] = useState(() => createGameState(puzzle.size));
  const latest = useRef(state);
  const audio = useRef<ReturnType<typeof createBoardSounds> | null>(null);
  if (!audio.current) audio.current = createBoardSounds();

  const dispatch = (action: GameAction) => {
    const result = transitionGame(latest.current, puzzle, action);
    latest.current = result.state;
    setState(result.state);
    for (const sound of result.sounds) {
      switch (sound) {
        case 'correct': audio.current!.playCorrectSound(); break;
        case 'wrong': audio.current!.playWrongSound(); break;
        case 'mark': audio.current!.playMarkSound(); break;
        case 'erase': audio.current!.playEraseSound(); break;
        case 'reset': audio.current!.reset(); break;
      }
    }
    if (result.sounds.includes('wrong')) events.onWrong?.();
    if (result.completed) events.onClear?.();
    return result.engaged;
  };
  return { ...projectGame(state, puzzle),
    setProbeActive: (on) => { dispatch({ type: 'probe', on }); },
    tapCell: (r, c, kind) => { dispatch({ type: 'tap', r, c, kind }); },
    beginStroke: (r, c) => { dispatch({ type: 'begin', r, c }); },
    strokeEnter: (r, c) => { dispatch({ type: 'enter', r, c }); },
    endStroke: () => dispatch({ type: 'end' }),
    reset: () => { dispatch({ type: 'reset' }); },
    resetMarks: () => { dispatch({ type: 'resetMarks' }); },
  };
}
