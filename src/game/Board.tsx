import { useEffect, useRef, type ReactNode } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Cell } from './Cell';
import { ClearDialog } from './ClearDialog';
import { cellsAlongSegment, type GridPoint } from './path';
import { cellConflicted, type Violations } from './rules';
import type { CellState, Puzzle } from './puzzles';
import type { TapKind } from './tap';

interface BoardProps {
  puzzle: Puzzle;
  cells: CellState[][];
  violations: Violations;
  cleared: boolean;
  pulse?: ReadonlyMap<string, number>;
  hitKey?: string | null;
  shake?: number;
  onCell: (r: number, c: number, kind: TapKind) => void;
  onPress: (r: number, c: number) => void;
  onEnter: (r: number, c: number) => void;
  onRelease: () => boolean;
  onReset: () => void;
  onNextMap: () => void;
  onBrowse: () => void;
  clearOverlay?: ReactNode;
}

export function Board({
  puzzle,
  cells,
  violations,
  cleared,
  pulse = new Map(),
  hitKey = null,
  shake = 0,
  onCell,
  onPress,
  onEnter,
  onRelease,
  onReset,
  onNextMap,
  onBrowse,
  clearOverlay,
}: BoardProps) {
  const suppressClick = useRef(false);
  const first = useRef(true);
  const controls = useAnimationControls();
  const boardRef = useRef<HTMLDivElement | null>(null);
  // 직전 포인터 위치(연속 격자 좌표). 다음 위치까지의 선분이 지나는 칸을 전부 넣기 위해 둔다.
  const lastPoint = useRef<GridPoint | null>(null);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void controls.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.4, ease: 'easeOut' } });
  }, [shake, controls]);

  const cellFromPoint = (x: number, y: number): [number, number] | null => {
    const el = document.elementFromPoint(x, y)?.closest?.('.cell');
    if (!el) return null;
    const r = Number((el as HTMLElement).dataset.r);
    const c = Number((el as HTMLElement).dataset.c);
    if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
    return [r, c];
  };

  // 화면 좌표를 연속 격자 좌표(x = 열, y = 행)로 바꾼다. 보드 크기를 알 수 없으면 null.
  const gridPoint = (clientX: number, clientY: number): GridPoint | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return [((clientX - rect.left) / rect.width) * puzzle.size, ((clientY - rect.top) / rect.height) * puzzle.size];
  };

  const inside = ([x, y]: GridPoint) => x >= 0 && y >= 0 && x < puzzle.size && y < puzzle.size;

  const handlePress = (r: number, c: number) => {
    onPress(r, c);
    lastPoint.current = [c + 0.5, r + 0.5];
  };

  // 포인터 위치 하나를 처리한다. 직전 위치와 잇는 선분이 지나는 칸을 순서대로 넣는다.
  // 보드 밖으로 나가면 경로를 끊고, 다시 들어온 칸부터 새로 잇는다.
  const movePoint = (clientX: number, clientY: number) => {
    const gp = gridPoint(clientX, clientY);
    if (!gp) {
      const hit = cellFromPoint(clientX, clientY);
      if (hit) onEnter(hit[0], hit[1]);
      return;
    }
    if (!inside(gp)) {
      lastPoint.current = null;
      return;
    }
    const from = lastPoint.current ?? gp;
    for (const [r, c] of cellsAlongSegment(from, gp, puzzle.size)) onEnter(r, c);
    lastPoint.current = gp;
  };

  const handleMove = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      onRelease();
      lastPoint.current = null;
      return;
    }
    // 한 프레임에 합쳐진 중간 표본이 있으면 펼쳐서 실제 궤적에 가깝게 잇는다.
    const native = e.nativeEvent as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] };
    const samples = native.getCoalescedEvents?.() ?? [];
    for (const s of samples.length > 0 ? samples : [native]) movePoint(s.clientX, s.clientY);
  };

  const handleUp = () => {
    lastPoint.current = null;
    if (onRelease()) suppressClick.current = true;
  };

  const handleClickCapture = (e: React.SyntheticEvent) => {
    if (!suppressClick.current) return;
    e.stopPropagation();
    suppressClick.current = false;
  };

  return (
    <motion.div className={`board-wrap${shake > 0 ? ' shake' : ''}`} animate={controls}>
      <div
        ref={boardRef}
        className="board"
        role="grid"
        aria-label={puzzle.name}
        style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={() => {
          lastPoint.current = null;
          onRelease();
        }}
        onClickCapture={handleClickCapture}
      >
        {cells.map((line, r) =>
          line.map((state, c) => {
            const key = `${r},${c}`;
            return (
              <Cell
                key={`${r}-${c}`}
                row={r}
                col={c}
                state={state}
                islandId={puzzle.islands[r][c]}
                conflicted={cellConflicted(violations, puzzle.islands, r, c)}
                hit={hitKey === key}
                pulseDelay={pulse.get(key)}
                onTap={(kind) => onCell(r, c, kind)}
                onPress={() => handlePress(r, c)}
              />
            );
          }),
        )}
      </div>
      {cleared &&
        (clearOverlay ?? <ClearDialog total={puzzle.size} onReset={onReset} onNextMap={onNextMap} onBrowse={onBrowse} />)}
    </motion.div>
  );
}
