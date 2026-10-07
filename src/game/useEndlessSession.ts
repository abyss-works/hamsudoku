import { useCallback, useRef, useState } from 'react';
import { EndlessApiError, nextStage, reportFail, submitClear } from '../api/endlessApi';
import type { EndlessMirror } from '../shared/endless';
import { seasonId } from '../shared/season';
import { toPuzzle } from './endlessBoard';
import { applyClear, applyClearResponse, applyFail, loadMirror, markCleared, storeMirror } from './endlessMirror';
import type { Puzzle } from './puzzles';

export type EndlessPhase = 'idle' | 'playing' | 'gameover' | 'cleared';

export interface EndlessSession {
  puzzle: Puzzle | null;
  stageId: string | null;
  seeds: number;
  phase: EndlessPhase;
  mirror: EndlessMirror;
  error: string | null;
  finishResult: { ok: boolean; earned: number } | null;
  start(): Promise<void>;
  reportWrong(): void;
  finish(): Promise<void>;
}

export const RETRY_DELAY_MS = 3000;

export function useEndlessSession(): EndlessSession {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [stageId, setStageId] = useState<string | null>(null);
  const [seeds, setSeeds] = useState(3);
  const [phase, setPhase] = useState<EndlessPhase>('idle');
  const [mirror, setMirror] = useState<EndlessMirror>(() => loadMirror(seasonId(new Date())));
  const [error, setError] = useState<string | null>(null);
  const [finishResult, setFinishResult] = useState<{ ok: boolean; earned: number } | null>(null);
  const attemptKeyRef = useRef<string | null>(null);
  const solutionRef = useRef<[number, number][]>([]);
  const seedRef = useRef(3);
  const stageRef = useRef<string | null>(null);
  const mirrorRef = useRef(mirror);
  const finishedRef = useRef(false);
  const genRef = useRef(0);
  const startingRef = useRef(false);

  const setMirrorBoth = useCallback((next: EndlessMirror) => {
    mirrorRef.current = next;
    storeMirror(next);
    setMirror(next);
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    const gen = genRef.current + 1;
    genRef.current = gen;
    setError(null);
    setFinishResult(null);
    finishedRef.current = false;
    try {
      const next = await nextStage();
      if (genRef.current !== gen) return;
      attemptKeyRef.current = next.attemptKey;
      solutionRef.current = next.solution;
      stageRef.current = next.stage.id;
      seedRef.current = 3;
      setStageId(next.stage.id);
      setPuzzle(toPuzzle(next.stage, next.solution));
      setSeeds(3);
      setPhase('playing');
    } catch (e) {
      if (genRef.current !== gen) return;
      if (e instanceof EndlessApiError && e.status === 401) setError('로그인이 필요해요.');
      else setError('무한모드를 불러오지 못했어요.');
    } finally {
      startingRef.current = false;
    }
  }, []);

  const reportWrong = useCallback(() => {
    if (seedRef.current <= 0) return;
    const nextSeeds = seedRef.current - 1;
    seedRef.current = nextSeeds;
    setSeeds(nextSeeds);
    if (nextSeeds === 0) {
      setPhase('gameover');
      setMirrorBoth(applyFail(mirrorRef.current));
      const key = attemptKeyRef.current;
      if (key) void reportFail(key);
    }
  }, [setMirrorBoth]);

  const finish = useCallback(async () => {
    if (finishedRef.current) return;
    const key = attemptKeyRef.current;
    const sid = stageRef.current;
    if (!key || !sid) return;
    finishedRef.current = true;
    const gen = genRef.current;
    const stale = () => genRef.current !== gen;
    const left = seedRef.current;
    const previous = mirrorRef.current;
    const optimistic = applyClear(markCleared(previous, sid), left);
    setMirrorBoth(optimistic);
    setFinishResult(null);

    const submit = () => submitClear({ attemptKey: key, stageId: sid, solution: solutionRef.current, seedLeft: left });

    try {
      const res = await submit();
      if (stale()) return;
      if (res.ok) {
        setMirrorBoth(applyClearResponse(optimistic, res));
        setFinishResult({ ok: true, earned: res.earned });
      } else {
        setMirrorBoth(previous);
        setError(res.reason);
        setFinishResult({ ok: false, earned: 0 });
      }
      setPhase('cleared');
    } catch (e) {
      if (stale()) return;
      if (e instanceof EndlessApiError) {
        setMirrorBoth(previous);
        setError(e.status === 401 ? '로그인이 필요해요.' : '기록을 저장하지 못했어요.');
        setFinishResult({ ok: false, earned: 0 });
        setPhase('cleared');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      if (stale()) return;
      try {
        const res = await submit();
        if (stale()) return;
        if (res.ok) {
          setMirrorBoth(applyClearResponse(optimistic, res));
          setFinishResult({ ok: true, earned: res.earned });
        } else {
          setMirrorBoth(previous);
          setError(res.reason);
          setFinishResult({ ok: false, earned: 0 });
        }
      } catch {
        if (stale()) return;
        setError('기록을 저장하지 못했어요.');
        setFinishResult({ ok: false, earned: 0 });
      }
      setPhase('cleared');
    }
  }, [setMirrorBoth]);

  return { puzzle, stageId, seeds, phase, mirror, error, finishResult, start, reportWrong, finish };
}
