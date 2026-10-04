import { useState } from 'react';
import { Board } from './game/Board';
import { useHamSudoku } from './game/useHamSudoku';
import { PUZZLES } from './game/puzzles';

function App() {
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const puzzle = PUZZLES[puzzleIndex];
  const { cells, violations, cleared, hamsterCount, cycleCell, reset } = useHamSudoku(puzzle);

  return (
    <main className="app">
      <header className="app-header">
        <h1>🐹 hamsudoku</h1>
        <p className="map-line">
          {puzzle.name} · 햄스터 {hamsterCount}/5
        </p>
        <div className="map-switch" role="group" aria-label="맵 선택">
          {PUZZLES.map((p, i) => (
            <button
              key={p.name}
              type="button"
              disabled={i === puzzleIndex}
              onClick={() => setPuzzleIndex(i)}
            >
              {p.name}
            </button>
          ))}
          <button type="button" onClick={reset}>
            리셋
          </button>
        </div>
      </header>
      <Board
        key={puzzleIndex}
        puzzle={puzzle}
        cells={cells}
        violations={violations}
        cleared={cleared}
        onCell={cycleCell}
        onReset={reset}
        onNextMap={() => setPuzzleIndex((i) => (i + 1) % PUZZLES.length)}
      />
    </main>
  );
}

export default App;
