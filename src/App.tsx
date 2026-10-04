import { useState } from 'react';
import type { Stage } from './api/stagesApi';
import { loadLastStageId, saveLastStageId } from './game/progress';
import { useStages } from './game/useStages';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SelectScreen } from './screens/SelectScreen';

export type Screen = 'home' | 'select' | 'game';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [stageId, setStageId] = useState<string | null>(null);
  const [lastId, setLastId] = useState<string | null>(loadLastStageId);
  const { chapters, loading, error } = useStages();

  const stages = chapters.flatMap((c) => c.stages);
  const stage = stages.find((s) => s.id === stageId) ?? null;
  const lastStage = stages.find((s) => s.id === lastId) ?? null;

  const enter = (s: Stage) => {
    saveLastStageId(s.id);
    setLastId(s.id);
    setStageId(s.id);
    setScreen('game');
  };

  const goNextMap = () => {
    if (!stage) {
      setScreen('home');
      return;
    }
    const i = stages.findIndex((s) => s.id === stage.id);
    const next = stages[i + 1];
    if (next) {
      enter(next);
    } else {
      setScreen('home');
    }
  };

  return (
    <main className="app">
      {screen === 'home' && (
        <HomeScreen loading={loading} lastStage={lastStage} onResume={enter} onBrowse={() => setScreen('select')} />
      )}
      {screen === 'select' && (
        <SelectScreen
          chapters={chapters}
          loading={loading}
          error={error}
          onSelect={enter}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'game' && stage && (
        <GameScreen key={stage.id} stage={stage} onBack={() => setScreen('select')} onNextMap={goNextMap} />
      )}
    </main>
  );
}

export default App;
