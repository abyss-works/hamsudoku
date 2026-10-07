import { useEffect, useRef, type ReactNode } from 'react';
import { Board } from '../game/Board';
import { ControlsHelp } from '../game/ControlsHelp';
import { RulesHelp } from '../game/RulesHelp';
import { useEndlessSession } from '../game/useEndlessSession';
import { useHamSudoku } from '../game/useHamSudoku';
import type { Puzzle } from '../game/puzzles';
import { Button } from '../ui/Button';
import { BootSplash } from '../ui/BootSplash';
import { Confetti } from '../ui/Confetti';
import { Overlay } from '../ui/Overlay';
import { useLoading } from '../ui/LoadingProvider';

interface EndlessBoardProps {
  puzzle: Puzzle;
  onWrong: () => void;
  onFinish: () => void;
  clearOverlay: ReactNode;
}

function EndlessBoard({ puzzle, onWrong, onFinish, clearOverlay }: EndlessBoardProps) {
  const board = useHamSudoku(puzzle);
  const wrongCount = board.cells.flat().filter((s) => s === 'wrong').length;
  const prevWrong = useRef(0);
  const wasCleared = useRef(false);

  useEffect(() => {
    const diff = wrongCount - prevWrong.current;
    prevWrong.current = wrongCount;
    for (let i = 0; i < diff; i += 1) onWrong();
  }, [wrongCount, onWrong]);

  useEffect(() => {
    if (board.cleared && !wasCleared.current) {
      wasCleared.current = true;
      onFinish();
    } else if (!board.cleared) {
      wasCleared.current = false;
    }
  }, [board.cleared, onFinish]);

  return (
    <Board
      puzzle={puzzle}
      cells={board.cells}
      violations={board.violations}
      cleared={board.cleared}
      pulse={board.pulse}
      hitKey={board.hitKey}
      shake={board.shake}
      onCell={board.tapCell}
      onPress={board.beginStroke}
      onEnter={board.strokeEnter}
      onRelease={board.endStroke}
      onReset={board.reset}
      onNextMap={() => {}}
      onBrowse={() => {}}
      clearOverlay={clearOverlay}
    />
  );
}

function ClearOverlay({
  result,
  error,
  submitting,
  starting,
  onNext,
  onExit,
}: {
  result: { ok: boolean; earned: number } | null;
  error: string | null;
  submitting: boolean;
  starting: boolean;
  onNext: () => void;
  onExit: () => void;
}) {
  const pending = submitting || starting;
  const showPending = pending || result === null;
  const failed = result !== null && result.ok === false;
  return (
    <Overlay label="클리어">
      {!showPending && !failed && <Confetti />}
      <p className="clear-title">
        {showPending || result === null
          ? '기록을 저장하는 중…'
          : result.ok === false
            ? (error ?? '기록을 저장하지 못했어요.')
            : `햄스터를 다 찾았다! 씨앗 ${result.earned}개를 얻었어요`}
      </p>
      {!showPending && !failed && error && <p className="home-note">{error}</p>}
      <div className="clear-actions">
        <Button variant="sticker" className="btn-primary" onClick={onNext} disabled={showPending}>
          다음 판
        </Button>
        <Button variant="sticker" onClick={onExit} disabled={showPending}>
          나가기
        </Button>
      </div>
    </Overlay>
  );
}

export function EndlessGameScreen({ onBack }: { onBack: () => void }) {
  const session = useEndlessSession();
  const { track } = useLoading();
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    // 첫 진입은 게이트 스플래시가 맡으므로 track하지 않는다.
    void session.start();
  }, [session]);

  if (!session.puzzle) {
    if (session.error) {
      return (
        <div className="game">
          <div className="hud">
            <Button variant="sticker" onClick={onBack}>
              뒤로
            </Button>
            <span className="hud-code">무한모드</span>
            <span />
          </div>
          <p role="alert">{session.error}</p>
        </div>
      );
    }
    return <BootSplash />;
  }

  return (
    <div className="game">
      <div className="hud">
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
        <span className="hud-code">무한모드</span>
        <span className="hud-seeds" role="status" aria-label={`씨앗 ${session.seeds}/3`}>
          {Array.from({ length: 3 }, (_, i) => (
            <span key={i} className={i < session.seeds ? 'seed on' : 'seed'} aria-hidden="true" />
          ))}
        </span>
      </div>
      <RulesHelp />
      <EndlessBoard
        key={session.stageId ?? 'loading'}
        puzzle={session.puzzle}
        onWrong={session.reportWrong}
        onFinish={() => void session.finish()}
        clearOverlay={
          <ClearOverlay
            result={session.finishResult}
            error={session.error}
            submitting={session.submitting}
            starting={session.starting}
            onNext={() => void track(session.start())}
            onExit={onBack}
          />
        }
      />
      <ControlsHelp />
      {session.phase === 'gameover' && (
        <Overlay label="게임오버">
          <p className="clear-title">씨앗을 다 썼어요…</p>
          {session.error && <p className="home-note">{session.error}</p>}
          <div className="clear-actions">
            <Button variant="sticker" className="btn-primary" onClick={() => void track(session.start())}>
              재도전
            </Button>
            <Button variant="sticker" onClick={onBack}>
              나가기
            </Button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
