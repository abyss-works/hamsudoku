import { useState } from 'react';
import type { Stage } from './api/stagesApi';
import { useStages } from './game/useStages';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SelectScreen } from './screens/SelectScreen';

export type Screen = 'home' | 'select' | 'game';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [stage, setStage] = useState<Stage | null>(null);
  const { chapters, loading, error } = useStages();

  const stages = chapters.flatMap((c) => c.stages);
  const goNextMap = () => {
    if (!stage) {
      setScreen('select');
      return;
    }
    const i = stages.findIndex((s) => s.id === stage.id);
    const next = stages[i + 1];
    if (next) {
      setStage(next);
    } else {
      setScreen('select');
    }
  };

  return (
    <main className="app">
      {screen === 'home' && <HomeScreen onStart={() => setScreen('select')} />}
      {screen === 'select' && (
        <SelectScreen
          chapters={chapters}
          loading={loading}
          error={error}
          onSelect={(s) => {
            setStage(s);
            setScreen('game');
          }}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'game' && stage && (
        <GameScreen
          key={stage.id}
          stage={stage}
          onBack={() => setScreen('select')}
          onNextMap={goNextMap}
        />
      )}
    </main>
  );
}

export default App;
