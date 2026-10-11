// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stageCatalog } from '../features/stages/catalog';
import { EndlessScene } from './EndlessScene';
import { StageScene } from './StageScene';
import * as gameTransition from '../features/sudoku/model/gameTransition';

const actions = vi.hoisted(() => ({
  start: vi.fn().mockResolvedValue(undefined),
  finish: vi.fn().mockResolvedValue(undefined),
  reportWrong: vi.fn(),
}));

vi.mock('../features/endless/service/useEndlessSession', () => ({
  useEndlessSession: () => ({
    ...actions,
    puzzle: stageCatalog()[0].stages[0].puzzle,
    stageId: 'one-round',
    roundId: 1,
    phase: 'playing',
    mirror: { wallet: { balance: 0 } },
    seeds: 3,
    error: null,
    finishResult: null,
    starting: false,
    submitting: false,
  }),
}));

describe('화면 조립의 상태 소유권', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('무한모드 화면 진입은 세션 시작을 한 번만 요청한다', () => {
    render(<EndlessScene onBack={() => {}} />);
    expect(actions.start).toHaveBeenCalledTimes(1);
  });

  it('스테이지 화면은 진행 중인 보드 상태를 한 번만 생성한다', () => {
    const create = vi.spyOn(gameTransition, 'createGameState');
    render(<StageScene stage={stageCatalog()[0].stages[0]} onBack={() => {}} onNextMap={() => {}} onRecord={() => {}} />);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
