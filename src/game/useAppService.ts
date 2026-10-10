import { useEffect, useRef, useState } from 'react';
import type { Stage } from '../api/stagesApi';
import { useClears } from './useClears';
import { useAccount } from './useAccount';
import { useEndlessSummary } from './useEndlessSummary';
import { useStages } from './useStages';
import { useDelayedLoading } from '../ui/useDelayedLoading';
import { useFontsReady } from '../ui/useFontsReady';
import { fetchAttemptKey, pull, pushClear, reconcile } from './sync';
import { BOOT_TIMEOUT_MS, bootReady, chapterForStage, nextStage, recoveryState, stageSelection, type Screen } from './appLogic';
import { dismissStaticSplash, locationSearch, removeRecoveryLocation } from './appBrowser';
import { useSoundPreferences } from './useSoundPreferences';

export function useAppService() {
  const [initialLocation] = useState(() => recoveryState(locationSearch()));
  const [screen, setScreen] = useState<Screen>(initialLocation.screen);
  const [stageId, setStageId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const clearsService = useClears();
  const { clears, record, replace, mergeIn, reset, sound, setSound } = clearsService;
  const account = useAccount();
  const { chapters, loading, error } = useStages();
  const summary = useEndlessSummary(account.cloud, account.uid);
  const [bootTimedOut, setBootTimedOut] = useState(false);
  const fontsReady = useFontsReady();
  const attemptKeys = useRef(new Map<string, string>());
  const entryGenerations = useRef(new Map<string, number>());
  const current = useRef({ account, clears, replace, mergeIn });
  current.current = { account, clears, replace, mergeIn };
  const uidRef = useRef<string | null | undefined>(undefined);
  const switchedRef = useRef(false);
  const holdSwitchRef = useRef(false);
  const generation = useRef(0);
  const pendingSync = useRef<{ uid: string; replace: boolean; request: ReturnType<typeof pull> } | null>(null);
  const { stages, stage } = stageSelection(chapters, stageId);

  const goLoginExpired = () => {
    void current.current.account.signout();
    setScreen('login');
  };

  useEffect(() => {
    const requestGeneration = ++generation.current;
    if (account.loading) return;
    const previous = uidRef.current;
    uidRef.current = account.uid;
    if (previous !== account.uid) {
      attemptKeys.current.clear();
      entryGenerations.current.clear();
    }
    if (!account.uid || !account.cloud || holdSwitchRef.current) return;
    const stale = () => generation.current !== requestGeneration;
    if (switchedRef.current) {
      switchedRef.current = false;
      pendingSync.current = { uid: account.uid, replace: true, request: pull([]) };
    } else if (previous === undefined || previous === null) {
      pendingSync.current = { uid: account.uid, replace: false, request: reconcile([...current.current.clears.values()]) };
    }
    const request = pendingSync.current;
    if (request?.uid === account.uid) {
      void request.request.then(({ clears: merged, unauthorized }) => {
        if (stale()) return;
        if (unauthorized) {
          if (request.replace || current.current.account.email) goLoginExpired();
        } else if (request.replace) current.current.replace(merged);
        else current.current.mergeIn(merged);
        if (pendingSync.current === request) pendingSync.current = null;
      }).catch(() => { if (pendingSync.current === request) pendingSync.current = null; });
    }
    return () => { generation.current += 1; };
  }, [account.uid, account.loading, account.cloud]);

  useEffect(() => {
    const timer = setTimeout(() => setBootTimedOut(true), BOOT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  const enter = (selected: Stage) => {
    setStageId(selected.id);
    setChapterId(chapterForStage(chapters, selected));
    setScreen('game');
    if (!account.cloud) return;
    const uid = account.uid;
    const requestGeneration = generation.current;
    const entryGeneration = (entryGenerations.current.get(selected.id) ?? 0) + 1;
    entryGenerations.current.set(selected.id, entryGeneration);
    void fetchAttemptKey(selected.code).then((key) => {
      if (key && generation.current === requestGeneration && current.current.account.uid === uid && entryGenerations.current.get(selected.id) === entryGeneration) attemptKeys.current.set(selected.id, key);
    });
  };

  const handleRecord = (code: string, elapsedSec: number) => {
    record(code, elapsedSec);
    if (!account.uid || !account.cloud) return;
    const key = stage ? attemptKeys.current.get(stage.id) : undefined;
    if (stage) {
      attemptKeys.current.delete(stage.id);
      entryGenerations.current.set(stage.id, (entryGenerations.current.get(stage.id) ?? 0) + 1);
    }
    const uid = account.uid;
    const requestGeneration = generation.current;
    void pushClear(code, elapsedSec, key).then((result) => {
      if (generation.current === requestGeneration && current.current.account.uid === uid && result === 'unauthorized' && current.current.account.email) goLoginExpired();
    });
  };

  const signinThenSwitch = (email: string, password: string, hold = false) => {
    if (hold) holdSwitchRef.current = true;
    switchedRef.current = true;
    return account.signin(email, password).then((result) => {
      if (!result.ok) {
        switchedRef.current = false;
        holdSwitchRef.current = false;
      }
      return result;
    });
  };

  const beginSwitch = () => {
    holdSwitchRef.current = false;
    switchedRef.current = false;
    if (!uidRef.current) return;
    const requestGeneration = ++generation.current;
    void pull([]).then(({ clears: merged, unauthorized }) => {
      if (generation.current !== requestGeneration) return;
      if (unauthorized) goLoginExpired();
      else current.current.replace(merged);
    }).catch(() => {});
  };

  const cancelSignin = () => {
    holdSwitchRef.current = false;
    switchedRef.current = false;
    generation.current += 1;
    void account.signout().then(() => { void summary.refreshSoft(); });
  };

  const handleLogout = () => {
    generation.current += 1;
    attemptKeys.current.clear();
    void account.signout().then(() => {
      reset();
      setScreen('home');
    });
  };

  const goHome = () => {
    removeRecoveryLocation();
    setScreen('home');
  };

  const goNextMap = () => {
    const next = nextStage(stages, stage);
    if (next) enter(next);
    else setScreen('home');
  };

  const ready = bootReady(fontsReady, bootTimedOut, account.loading, loading, account.cloud, summary.me !== null || summary.error !== null);
  const showBootLoading = useDelayedLoading(!ready);
  useEffect(() => { if (ready) dismissStaticSplash(); }, [ready]);
  useSoundPreferences(sound);

  return {
    screen, stage, chapterId, clears, sound, account, chapters, loading, error, summary,
    ready, showBootLoading, linkError: initialLocation.linkError,
    enter, handleRecord, signinThenSwitch, beginSwitch, cancelSignin, handleLogout, goHome, goNextMap,
    toggleSound: () => setSound(!sound),
    browse: () => setScreen('select'),
    openEndless: () => setScreen('endless'),
    openLogin: () => setScreen('login'),
    home: () => setScreen('home'),
  };
}
