// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useBoardInteraction } from './useBoardInteraction';
import { PUZZLES, type CellState } from '../model/puzzles';

vi.mock('framer-motion', () => ({ useAnimationControls: () => ({ start: vi.fn() }) }));
afterEach(cleanup);

function setup(onRelease: () => boolean = () => false) {
  const puzzle = PUZZLES[0];
  const size = puzzle.size;
  const cells = Array.from({ length: size }, () => Array.from({ length: size }, (): CellState => 'empty'));
  const onPress = vi.fn();
  const onEnter = vi.fn();
  const hook = renderHook(() =>
    useBoardInteraction(puzzle, cells, new Set(), { rows: new Set(), cols: new Set(), islands: new Set(), touch: new Set() },
      new Map(), null, 0, onPress, onEnter, onRelease),
  );
  // 보드를 100px 정사각형으로 가정하여 화면 좌표를 격자 좌표로 바꿀 수 있게 한다.
  hook.result.current.boardRef.current = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
  } as unknown as HTMLDivElement;
  const cellCenter = (r: number, c: number) => ({ clientX: ((c + 0.5) * 100) / size, clientY: ((r + 0.5) * 100) / size });
  const move = (r: number, c: number) =>
    hook.result.current.handleMove({ pointerType: 'mouse', buttons: 1, nativeEvent: cellCenter(r, c) } as never);
  return { hook, onEnter, move, size };
}

describe('useBoardInteraction 경로', () => {
  it('보드 안에서 이동하면 직전 위치와 잇는 선분의 칸을 모두 넣는다', () => {
    const { hook, onEnter, move, size } = setup();
    act(() => hook.result.current.handlePress(0, 0));
    act(() => move(0, size - 1));
    const cols = onEnter.mock.calls.map(([, c]) => c);
    expect(cols).toEqual(Array.from({ length: size }, (_, i) => i));
  });

  it('보드를 벗어난 뒤 재진입하면 떠난 위치와 잇지 않고 들어온 칸부터 시작한다', () => {
    const { hook, onEnter, move, size } = setup();
    act(() => hook.result.current.handlePress(0, 0));
    act(() => hook.result.current.handleLeave());
    act(() => move(0, size - 1));
    expect(onEnter.mock.calls).toEqual([[0, size - 1]]);
  });
});
