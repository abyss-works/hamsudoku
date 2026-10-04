import type { Stage } from '../api/stagesApi';
import { Board } from '../game/Board';
import { useHamSudoku } from '../game/useHamSudoku';
import { Button } from '../ui/Button';

interface GameScreenProps {
  stage: Stage;
  onBack: () => void;
  onNextMap: () => void;
}

export function GameScreen({ stage, onBack, onNextMap }: GameScreenProps) {
  const { cells, violations, cleared, hamsterCount, cycleCell, reset } = useHamSudoku(stage.puzzle);

  return (
    <>
      <div className="game-head">
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
        <p className="map-line">
          {stage.code} · 햄스터 {hamsterCount}/5
        </p>
        <Button variant="sticker" onClick={reset}>
          리셋
        </Button>
      </div>
      <Board
        puzzle={stage.puzzle}
        cells={cells}
        violations={violations}
        cleared={cleared}
        onCell={cycleCell}
        onReset={reset}
        onNextMap={onNextMap}
      />
    </>
  );
}
