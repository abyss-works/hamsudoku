import { useState } from 'react';
import type { Stage } from './api/stagesApi';
import { useClears } from './game/useClears';
import { useStages } from './game/useStages';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SelectScreen } from './screens/SelectScreen';

export type Screen = 'home' | 'select' | 'game';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [stageId, setStageId] = useState<string | null>(null);
  const { clears, record, resumeId } = useClears();
  const { chapters, loading, error } = useStages();

  const stages = chapters.flatMap((c) => c.stages);
  const stage = stages.find((s) => s.id === stageId) ?? null;
  const resumeCode = resumeId(stages.map((s) => s.code));
  const resumeStage = stages.find((s) => s.code === resumeCode) ?? null;

  const enter = (s: Stage) => {
    setStageId(s.id);
    setScreen('game');
  };

  const resume = (s: Stage | null) => {
    if (s) {
      enter(s);
    } else {
      setScreen('select');
    }
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
        <HomeScreen loading={loading} lastStage={resumeStage} onResume={resume} onBrowse={() => setScreen('select')} />
      )}
      {screen === 'select' && (
        <SelectScreen
          chapters={chapters}
          loading={loading}
          error={error}
          clears={clears}
          onSelect={enter}
          onBack={() => setScreen('home')}
        />
      )}
      {screen === 'game' && stage && (
        <GameScreen key={stage.id} stage={stage} onBack={() => setScreen('select')} onNextMap={goNextMap} onRecord={record} />
      )}
    </main>
  );
}

export default App;
