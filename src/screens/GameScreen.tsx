import type { Stage } from '../api/stagesApi';
import { Board } from '../game/Board';
import { formatElapsed, useElapsed } from '../game/useElapsed';
import { useHamSudoku } from '../game/useHamSudoku';
import { Button } from '../ui/Button';

interface GameScreenProps {
  stage: Stage;
  onBack: () => void;
  onNextMap: () => void;
}

const RULES = ['색 섬마다 햄스터 1마리', '주변 8칸에 다른 햄스터 금지', '가로·세로줄에 1마리씩'];

export function GameScreen({ stage, onBack, onNextMap }: GameScreenProps) {
  const { cells, violations, cleared, hamsterCount, cycleCell, reset } = useHamSudoku(stage.puzzle);
  const sec = useElapsed(!cleared);

  return (
    <div className="game">
      <div className="hud">
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
        <span className="hud-code">
          {stage.code} · {formatElapsed(sec)}
        </span>
        <Button variant="sticker" onClick={reset}>
          리셋
        </Button>
      </div>
      <div className="dots" role="status" aria-label={`햄스터 ${hamsterCount}/5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className={i < hamsterCount ? 'dot on' : 'dot'} aria-hidden="true" />
        ))}
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
      <ol className="rules">
        {RULES.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ol>
    </div>
  );
}
