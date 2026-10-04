import { useState } from 'react';
import { Board } from './game/Board';
import { useHamSudoku } from './game/useHamSudoku';
import { PUZZLES, type Puzzle } from './game/puzzles';

interface GameProps {
  puzzle: Puzzle;
  puzzleIndex: number;
  onSelectMap: (i: number) => void;
  onNextMap: () => void;
}

function Game({ puzzle, puzzleIndex, onSelectMap, onNextMap }: GameProps) {
  const { cells, violations, cleared, hamsterCount, cycleCell, reset } = useHamSudoku(puzzle);

  return (
    <>
      <p className="map-line">
        {puzzle.name} · 햄스터 {hamsterCount}/5
      </p>
      <div className="map-switch" role="group" aria-label="맵 선택">
        {PUZZLES.map((p, i) => (
          <button key={p.name} type="button" disabled={i === puzzleIndex} onClick={() => onSelectMap(i)}>
            {p.name}
          </button>
        ))}
        <button type="button" onClick={reset}>
          리셋
        </button>
      </div>
      <Board
        puzzle={puzzle}
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

function App() {
  const [puzzleIndex, setPuzzleIndex] = useState(0);

  return (
    <main className="app">
      <header className="app-header">
        <h1>🐹 hamsudoku</h1>
      </header>
      <Game
        key={puzzleIndex}
        puzzle={PUZZLES[puzzleIndex]}
        puzzleIndex={puzzleIndex}
        onSelectMap={setPuzzleIndex}
        onNextMap={() => setPuzzleIndex((i) => (i + 1) % PUZZLES.length)}
      />
    </main>
  );
}

export default App;
