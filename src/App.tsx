import { useEffect, useRef, useState } from 'react';
import type { Stage } from './api/stagesApi';
import { useClears } from './game/useClears';
import { useAccount } from './game/useAccount';
import { useEndlessSummary } from './game/useEndlessSummary';
import { useDelayedLoading } from './ui/useDelayedLoading';
import { fetchAttemptKey, pull, pushClear, reconcile } from './game/sync';
import type { ClearEntry } from './game/save';
import { useStages } from './game/useStages';
import { EndlessGameScreen } from './screens/EndlessGameScreen';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { SelectScreen } from './screens/SelectScreen';
import { SetPasswordScreen } from './screens/SetPasswordScreen';
import { BootSplash } from './ui/BootSplash';
import { useFontsReady } from './ui/useFontsReady';

export type Screen = 'home' | 'select' | 'game' | 'login' | 'recovery' | 'endless';

// 부팅 게이트가 데이터를 무한정 기다리지 않게 하는 상한이다.
export const BOOT_TIMEOUT_MS = 5000;

function initialScreen(): Screen {
  if (typeof window === 'undefined') return 'home';
  const q = new URLSearchParams(window.location.search);
  return q.has('recovery') ? 'recovery' : 'home';
}

function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [stageId, setStageId] = useState<string | null>(null);
  // 마지막으로 들어간 스테이지의 레벨. 선택 화면이 다시 열릴 때 그 레벨 탭을 유지한다.
  const [chapterId, setChapterId] = useState<string | null>(null);
  const { clears, record, replace, mergeIn, reset } = useClears();
  const account = useAccount();
  const { chapters, loading, error } = useStages();
  const summary = useEndlessSummary(account.cloud);
  const [bootTimedOut, setBootTimedOut] = useState(false);
  // 웹폰트 교체 요동을 막으려고 폰트가 올라오기 전에는 빈 셸만 둔다.
  // 타임아웃이 지나면 폰트 없이도 렌더한다.
  const fontsReady = useFontsReady();
  const attemptKeys = useRef(new Map<string, string>());
  const clearsRef = useRef<ClearEntry[]>([]);
  clearsRef.current = [...clears.values()];
  const uidRef = useRef<string | null | undefined>(undefined);
  const switchedRef = useRef(false);

  const stages = chapters.flatMap((c) => c.stages);
  const stage = stages.find((s) => s.id === stageId) ?? null;

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

  useEffect(() => {
    const t = setTimeout(() => setBootTimedOut(true), BOOT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  const enter = (s: Stage) => {
    setStageId(s.id);
    setChapterId(chapters.find((c) => c.stages.some((st) => st.id === s.id))?.id ?? null);
    setScreen('game');
    if (!account.cloud) return;
    void fetchAttemptKey(s.code).then((key) => {
      if (key) attemptKeys.current.set(s.id, key);
    });
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

  // 전역 바운더리: 부팅 데이터가 모이기 전에는 그리지 않는다.
  // 계정·스테이지·(클라우드면) 무한모드 요약의 첫 결착을 기다린다.
  // 타임아웃이 지나면 가진 데이터로 그린다.
  const dataReady =
    !account.loading && !loading && (!account.cloud || summary.me !== null || summary.error !== null);
  const ready = fontsReady && (dataReady || bootTimedOut);
  const showBootLoading = useDelayedLoading(!ready);

  return (
    <main className="app">
      {!ready ? (
        showBootLoading && <BootSplash />
      ) : (
        <>
          {screen === 'home' && (
            <HomeScreen
              email={account.email}
              nickname={account.nickname}
              summary={summary}
              onBrowse={() => setScreen('select')}
              onEndless={() => setScreen('endless')}
              endlessEnabled={account.cloud}
              onSaveNickname={account.saveNickname}
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
              initialChapterId={chapterId}
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
          {screen === 'endless' && <EndlessGameScreen onBack={() => setScreen('home')} />}
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
        </>
      )}
    </main>
  );
}

export default App;
