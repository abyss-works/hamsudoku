import type { Stage } from '../api/stagesApi';
import { Board } from '../game/Board';
import { useHamSudoku } from '../game/useHamSudoku';
import { Button } from '../ui/Button';

interface GameScreenProps {
  stage: Stage;
  onBack: () => void;
  onNextMap: () => void;
}

function Dots({ count, total }: { count: number; total: number }) {
  return (
    <div className="dots" role="status" aria-label={`햄스터 ${count}/${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < count ? 'dot on' : 'dot'} aria-hidden="true" />
      ))}
    </div>
  );
}

export function GameScreen({ stage, onBack, onNextMap }: GameScreenProps) {
  const { cells, violations, cleared, hamsterCount, cycleCell, reset } = useHamSudoku(stage.puzzle);

  return (
    <div className="game">
      <div className="hud">
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
        <span className="hud-code">{stage.code}</span>
        <Button variant="sticker" onClick={reset}>
          리셋
        </Button>
      </div>
      <Dots count={hamsterCount} total={5} />
      <Board
        puzzle={stage.puzzle}
        cells={cells}
        violations={violations}
        cleared={cleared}
        onCell={cycleCell}
        onReset={reset}
        onNextMap={onNextMap}
      />
    </div>
  );
}
