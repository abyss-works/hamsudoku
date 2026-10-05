import { useEffect, useRef, useState } from 'react';
import type { Stage } from './api/stagesApi';
import { useClears } from './game/useClears';
import { useAccount } from './game/useAccount';
import { pull, pushClear } from './game/sync';
import type { ClearEntry } from './game/save';
import { useStages } from './game/useStages';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SelectScreen } from './screens/SelectScreen';

export type Screen = 'home' | 'select' | 'game' | 'login';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [stageId, setStageId] = useState<string | null>(null);
  const { clears, record, replace, resumeId } = useClears();
  const account = useAccount();
  const { chapters, loading, error } = useStages();
  const attemptKeys = useRef(new Map<string, string>());
  const clearsRef = useRef<ClearEntry[]>([]);
  clearsRef.current = [...clears.values()];
  const pulled = useRef(false);

  const stages = chapters.flatMap((c) => c.stages);
  const stage = stages.find((s) => s.id === stageId) ?? null;
  const resumeCode = resumeId(stages.map((s) => s.code));
  const resumeStage = stages.find((s) => s.code === resumeCode) ?? null;

  useEffect(() => {
    if (!account.uid || pulled.current) return;
    pulled.current = true;
    pull(clearsRef.current)
      .then((merged) => replace(merged))
      .catch(() => {});
  }, [account.uid, replace]);

  const enter = (s: Stage) => {
    setStageId(s.id);
    setScreen('game');
    fetch('/api/attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageCode: s.code }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.attemptKey) attemptKeys.current.set(s.id, data.attemptKey);
      })
      .catch(() => {});
  };

  const resume = (s: Stage | null) => {
    if (s) {
      enter(s);
    } else {
      setScreen('select');
    }
  };

  const handleRecord = (code: string, elapsedSec: number) => {
    record(code, elapsedSec);
    const key = stage ? attemptKeys.current.get(stage.id) : undefined;
    if (stage) attemptKeys.current.delete(stage.id);
    void pushClear(code, elapsedSec, key);
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
        <HomeScreen
          loading={loading}
          lastStage={resumeStage}
          onResume={resume}
          onBrowse={() => setScreen('select')}
          email={account.email}
          onLogin={() => setScreen('login')}
          onLogout={() => void account.signout()}
        />
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
        <GameScreen
          key={stage.id}
          stage={stage}
          onBack={() => setScreen('select')}
          onNextMap={goNextMap}
          onRecord={handleRecord}
        />
      )}
      {screen === 'login' && <LoginScreen onBack={() => setScreen('home')} onDone={() => setScreen('home')} />}
    </main>
  );
}

export default App;
