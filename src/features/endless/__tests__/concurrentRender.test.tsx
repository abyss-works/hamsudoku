// @vitest-environment jsdom
import { Suspense, startTransition, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useEndlessGame } from '../service/useEndlessGame';
import { OverlayProvider } from '../../../core/composition/OverlayProvider';
import { LoadingProvider, useLoading } from '../../../core/composition/LoadingProvider';
import { useOverlayScope } from '../../../core/orchestration/useOverlayScope';
import * as sessionModule from '../service/useEndlessSession';

vi.mock('howler', () => ({ Howl: vi.fn(function () { return { play: vi.fn(), rate: vi.fn(), volume: vi.fn() }; }), Howler: { ctx: null } }));

const fixture = vi.hoisted(() => ({ round: 1, start: vi.fn(), wrong: vi.fn(), finish: vi.fn() }));
vi.mock('../service/useEndlessSession', () => ({
  useEndlessSession: () => ({
    roundId: fixture.round, stageId: `stage-${fixture.round}`, puzzle: { name: '', size: 1, islands: [[0]], solution: [[0, 0]] }, seeds: 3,
    phase: 'playing', mirror: { v: 1, wallet: { balance: 0 }, clearedIds: [], streak: { current: 0, best: 0 }, season: '2026-W42' },
    error: null, finishResult: null, starting: false, submitting: false,
    start: fixture.start, reportWrong: fixture.wrong, finish: fixture.finish,
  }),
}));

afterEach(() => { cleanup(); fixture.round = 1; vi.clearAllMocks(); });

function useGame() {
  const session = sessionModule.useEndlessSession();
  const overlay = useOverlayScope(`endless-${session.roundId}`);
  const { track } = useLoading();
  return useEndlessGame(session, { overlay, track, showEntryLoading: false });
}

it('커밋되지 않은 다음 시도 렌더는 현재 게임 액션을 무효화하지 않는다', async () => {
  fixture.start.mockResolvedValue(true);
  const pending = new Promise<void>(() => {});
  let committed: ReturnType<typeof useEndlessGame> | undefined;
  function Content({ round }: { round: number }) {
    const game = useGame();
    if (round === 2) throw pending;
    committed = game;
    return <div>current-round</div>;
  }
  function Harness() {
    const [round, setRound] = useState(1);
    return (
      <LoadingProvider>
        <OverlayProvider>
          <button onClick={() => { fixture.round = 2; startTransition(() => setRound(2)); }}>transition</button>
          <Suspense fallback={<div>pending</div>}><Content round={round} /></Suspense>
        </OverlayProvider>
      </LoadingProvider>
    );
  }
  render(<Harness />);
  const reportWrong = committed!.reportWrong;
  await act(async () => { fireEvent.click(screen.getByText('transition')); });
  expect(screen.getByText('current-round')).toBeDefined();
  act(() => reportWrong());
  expect(fixture.wrong).toHaveBeenCalledTimes(1);
});
