import type { ReactNode } from 'react';
import { Board } from '../game/Board';
import { GameHelp } from '../game/GameHelp';
import { ProbeButton } from '../game/ProbeButton';
import { useEndlessGame } from '../game/useEndlessGame';
import { useEndlessBoard } from '../game/useEndlessBoard';
import type { Puzzle } from '../game/puzzles';
import { Button } from '../ui/Button';
import { BootSplash } from '../ui/BootSplash';
import { Confetti } from '../ui/Confetti';
import { Overlay } from '../ui/Overlay';
import { Sprout } from 'lucide-react';

interface EndlessBoardProps {
  puzzle: Puzzle;
  onWrong: () => void;
  onFinish: () => void;
  clearOverlay: ReactNode;
}

function EndlessBoard({ puzzle, onWrong, onFinish, clearOverlay }: EndlessBoardProps) {
  const board = useEndlessBoard(puzzle, onWrong, onFinish);

  return (
    <>
      <Board
        puzzle={puzzle}
        cells={board.cells}
        xMarks={board.xMarks}
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
      <ProbeButton
        active={board.probeActive}
        slots={board.probeSlots}
        onToggle={board.toggleProbe}
        onResetMarks={board.resetMarks}
      />
    </>
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
  const session = useEndlessGame();

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
    return session.showEntryLoading ? <BootSplash /> : null;
  }

  return (
    <div className="game">
      <div className="hud">
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
        <span className="hud-code">무한모드</span>
        <span className="seed-box" role="status" aria-label={`씨앗 ${session.mirror.wallet.balance}개, 목숨 ${session.seeds}개`}>
          <Sprout size={20} aria-hidden="true" />
          <span className="seed-count">{session.mirror.wallet.balance}</span>
          <span className="seed-lives" aria-hidden="true">
            +{session.seeds}
          </span>
        </span>
      </div>
      <GameHelp probe />
      <EndlessBoard
        key={session.stageId ?? 'loading'}
        puzzle={session.puzzle}
        onWrong={session.reportWrong}
        onFinish={session.finishBoard}
        clearOverlay={
          <ClearOverlay
            result={session.finishResult}
            error={session.error}
            submitting={session.submitting}
            starting={session.starting}
            onNext={session.next}
            onExit={onBack}
          />
        }
      />
      {session.phase === 'gameover' && (
        <Overlay label="게임오버">
          <p className="clear-title">씨앗을 다 썼어요…</p>
          {session.error && <p className="home-note">{session.error}</p>}
          <div className="clear-actions">
            <Button variant="sticker" className="btn-primary" onClick={session.next}>
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
