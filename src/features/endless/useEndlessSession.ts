import { useCallback, useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/nextjs';
import { EndlessApiError, nextStage, reportFail, submitClear } from './endlessApi';
import type { EndlessMirror } from '../../shared/endless';
import { seasonId } from '../../shared/season';
import { toPuzzle } from './endlessBoard';
import { applyClear, applyClearResponse, applyFail, markCleared } from '../../shared/endlessMirrorRules';
import { loadMirror, storeMirror } from './mirrorApi';
import { playClearSound, playGameOverSound } from '../../platform/audio/sound';
import type { Puzzle } from '../sudoku/model/puzzles';

export type EndlessPhase = 'idle' | 'playing' | 'gameover' | 'cleared';

export interface EndlessSession {
  puzzle: Puzzle | null;
  stageId: string | null;
  seeds: number;
  phase: EndlessPhase;
  mirror: EndlessMirror;
  error: string | null;
  finishResult: { ok: boolean; earned: number } | null;
  submitting: boolean;
  starting: boolean;
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
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const attemptKeyRef = useRef<string | null>(null);
  const solutionRef = useRef<[number, number][]>([]);
  const seedRef = useRef(3);
  const stageRef = useRef<string | null>(null);
  const mirrorRef = useRef(mirror);
  const finishedRef = useRef(false);
  const genRef = useRef(0);
  const startingRef = useRef(false);
  const activeRef = useRef(true);
  const retryRef = useRef<{ timer: ReturnType<typeof setTimeout>; resolve: () => void } | null>(null);
  const cancelRetry = useCallback(() => {
    if (!retryRef.current) return;
    clearTimeout(retryRef.current.timer);
    retryRef.current.resolve();
    retryRef.current = null;
  }, []);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; cancelRetry(); };
  }, [cancelRetry]);

  const setMirrorBoth = useCallback((next: EndlessMirror) => {
    mirrorRef.current = next;
    storeMirror(next);
    setMirror(next);
  }, []);

  const start = useCallback(async () => {
    if (startingRef.current) return;
    setStarting(true);
    startingRef.current = true;
    const gen = genRef.current + 1;
    genRef.current = gen;
    cancelRetry();
    setSubmitting(false);
    setFinishResult(null);
    setError(null);
    finishedRef.current = false;
    try {
      const next = await nextStage();
      if (!activeRef.current || genRef.current !== gen) return;
      attemptKeyRef.current = next.attemptKey;
      solutionRef.current = next.solution;
      stageRef.current = next.stage.id;
      seedRef.current = 3;
      setStageId(next.stage.id);
      setPuzzle(toPuzzle(next.stage, next.solution));
      setSeeds(3);
      setPhase('playing');
    } catch (e) {
      if (!activeRef.current || genRef.current !== gen) return;
      // 예상된 흐름(비로그인 401)은 로그하지 않고, Unexpected 실패만 남긴다.
      if (e instanceof EndlessApiError && e.status === 401) setError('로그인이 필요해요.');
      else {
        Sentry.logger.warn('Endless stage load failed', { status: e instanceof EndlessApiError ? e.status : 0 });
        setError('무한모드를 불러오지 못했어요.');
      }
    } finally {
      if (activeRef.current && genRef.current === gen) {
        startingRef.current = false;
        setStarting(false);
      }
    }
  }, [cancelRetry]);

  const reportWrong = useCallback(() => {
    if (seedRef.current <= 0) return;
    const nextSeeds = seedRef.current - 1;
    seedRef.current = nextSeeds;
    setSeeds(nextSeeds);
    if (nextSeeds === 0) {
      setPhase('gameover');
      playGameOverSound();
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
    const stale = () => !activeRef.current || genRef.current !== gen;
    const left = seedRef.current;
    const previous = mirrorRef.current;
    const optimistic = applyClear(markCleared(previous, sid), left);
    setMirrorBoth(optimistic);
    setFinishResult(null);
    setSubmitting(true);

    try {
      const submit = () => submitClear({ attemptKey: key, stageId: sid, solution: solutionRef.current, seedLeft: left });

      const acceptResponse = (res: Awaited<ReturnType<typeof submitClear>>) => {
        if (res.ok) {
          setMirrorBoth(applyClearResponse(optimistic, res));
          setFinishResult({ ok: true, earned: res.earned });
          playClearSound(res.earned);
        } else {
          setMirrorBoth(previous);
          setError(res.reason);
          setFinishResult({ ok: false, earned: 0 });
          playClearSound();
        }
      };

      try {
        const res = await submit();
        if (stale()) return;
        acceptResponse(res);
        setPhase('cleared');
      } catch (e) {
        if (stale()) return;
        if (e instanceof EndlessApiError) {
          setMirrorBoth(previous);
          setError(e.status === 401 ? '로그인이 필요해요.' : '기록을 저장하지 못했어요.');
          setFinishResult({ ok: false, earned: 0 });
          playClearSound();
          setPhase('cleared');
          return;
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => { retryRef.current = null; resolve(); }, RETRY_DELAY_MS);
          retryRef.current = { timer, resolve };
        });
        if (stale()) return;
        try {
          const res = await submit();
          if (stale()) return;
          acceptResponse(res);
        } catch {
          if (stale()) return;
          setError('기록을 저장하지 못했어요.');
          setFinishResult({ ok: false, earned: 0 });
          playClearSound();
        }
        setPhase('cleared');
      }
    } finally {
      if (!stale()) setSubmitting(false);
    }
  }, [setMirrorBoth]);

  return { puzzle, stageId, seeds, phase, mirror, error, finishResult, submitting, starting, start, reportWrong, finish };
}
