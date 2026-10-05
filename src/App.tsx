import { useEffect, useRef, useState } from 'react';
import type { Stage } from './api/stagesApi';
import { useClears } from './game/useClears';
import { useAccount } from './game/useAccount';
import { fetchAttemptKey, pull, pushClear, reconcile } from './game/sync';
import type { ClearEntry } from './game/save';
import { useStages } from './game/useStages';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SelectScreen } from './screens/SelectScreen';
import { SetPasswordScreen } from './screens/SetPasswordScreen';

export type Screen = 'home' | 'select' | 'game' | 'login' | 'recovery';

function initialScreen(): Screen {
  if (typeof window === 'undefined') return 'home';
  const q = new URLSearchParams(window.location.search);
  return q.has('recovery') ? 'recovery' : 'home';
}

function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [stageId, setStageId] = useState<string | null>(null);
  const { clears, record, replace, mergeIn, reset, resumeId } = useClears();
  const account = useAccount();
  const { chapters, loading, error } = useStages();
  const attemptKeys = useRef(new Map<string, string>());
  const clearsRef = useRef<ClearEntry[]>([]);
  clearsRef.current = [...clears.values()];
  const uidRef = useRef<string | null | undefined>(undefined);
  const switchedRef = useRef(false);

  const stages = chapters.flatMap((c) => c.stages);
  const stage = stages.find((s) => s.id === stageId) ?? null;
  const resumeCode = resumeId(stages.map((s) => s.code));
  const resumeStage = stages.find((s) => s.code === resumeCode) ?? null;

  const goLoginExpired = () => {
    void account.signout();
    setScreen('login');
  };

  useEffect(() => {
    if (account.loading) return;
    const prev = uidRef.current;
    uidRef.current = account.uid;
    if (!account.uid || !account.cloud) return;
    if (switchedRef.current) {
      switchedRef.current = false;
      pull([])
        .then(({ clears: merged, unauthorized }) => {
          if (unauthorized) {
            goLoginExpired();
            return;
          }
          replace(merged);
        })
        .catch(() => {});
      return;
    }
    if (prev === undefined || prev === null) {
      reconcile(clearsRef.current).then(({ clears: merged, unauthorized }) => {
        if (unauthorized) {
          if (account.email) goLoginExpired();
          return;
        }
        mergeIn(merged);
      });
    }
  // mergeIn/replace는 함수형 setState라 클로저가 항상 최신이다. uid 변화에만 반응한다.
  }, [account.uid, account.loading]);

  const enter = (s: Stage) => {
    setStageId(s.id);
    setScreen('game');
    if (!account.cloud) return;
    void fetchAttemptKey(s.code).then((key) => {
      if (key) attemptKeys.current.set(s.id, key);
    });
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
    if (!account.uid || !account.cloud) return;
    const key = stage ? attemptKeys.current.get(stage.id) : undefined;
    if (stage) attemptKeys.current.delete(stage.id);
    void pushClear(code, elapsedSec, key).then((r) => {
      if (r === 'unauthorized' && account.email) goLoginExpired();
    });
  };

  // signin은 항상 계정 교체다. 성공 피드백 지연과 무관하게 uid가 바뀌기 전에
  // 교체 의도를 먼저 세워야 화해가 아니라 갈아끼우기가 탄다.
  const signinThenSwitch = (email: string, password: string) => {
    switchedRef.current = true;
    return account.signin(email, password).then((r) => {
      if (!r.ok) switchedRef.current = false;
      return r;
    });
  };
  const handleLogout = () => {
    void account.signout().then(() => {
      reset();
      setScreen('home');
    });
  };

  const goHome = () => {
    window.history.replaceState({}, '', window.location.pathname);
    setScreen('home');
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
          onLogout={handleLogout}
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
      {screen === 'login' && (
        <LoginScreen
          signup={account.signup}
          signin={signinThenSwitch}
          reset={account.reset}
          cloud={account.cloud}
          onBack={() => setScreen('home')}
          onDone={() => setScreen('home')}
        />
      )}
      {screen === 'recovery' && (
        <SetPasswordScreen
          setPassword={account.setPassword}
          linkError={new URLSearchParams(window.location.search).get('recovery') === 'error'}
          onDone={goHome}
        />
      )}
    </main>
  );
}

export default App;
