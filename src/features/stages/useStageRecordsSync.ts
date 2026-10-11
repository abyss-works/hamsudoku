import { useEffect, useRef } from 'react';
import type { Stage } from './stagesApi';
import type { ClearEntry } from '../../platform/storage/save';
import { fetchAttemptKey, pull, pushClear, reconcile } from './sync';

export interface StageRecordsAccountContext {
  uid: string | null;
  email: string | null;
  cloud: boolean;
  loading: boolean;
}

export interface StageRecordsSaveContext {
  clears: Map<string, ClearEntry>;
  record: (code: string, elapsedSec: number) => void;
  replace: (clears: ClearEntry[]) => void;
  mergeIn: (clears: ClearEntry[]) => void;
}

export interface StageRecordsSyncOptions {
  account: StageRecordsAccountContext;
  save: StageRecordsSaveContext;
  onUnauthorized?: () => void;
}

export function useStageRecordsSync({ account, save, onUnauthorized }: StageRecordsSyncOptions) {
  const { clears, record, replace, mergeIn } = save;
  const attemptKeys = useRef(new Map<string, string>());
  const entryGenerations = useRef(new Map<string, number>());
  const current = useRef({ account, clears, replace, mergeIn, onUnauthorized });
  current.current = { account, clears, replace, mergeIn, onUnauthorized };
  const uidRef = useRef<string | null | undefined>(undefined);
  const switchedRef = useRef(false);
  const holdSwitchRef = useRef(false);
  const generation = useRef(0);
  const pendingSync = useRef<{ uid: string; replace: boolean; request: ReturnType<typeof pull> } | null>(null);

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
      void request.request
        .then(({ clears: merged, unauthorized }) => {
          if (stale()) return;
          if (unauthorized) {
            if (request.replace || current.current.account.email) {
              current.current.onUnauthorized?.();
            }
          } else if (request.replace) {
            current.current.replace(merged);
          } else {
            current.current.mergeIn(merged);
          }
          if (pendingSync.current === request) pendingSync.current = null;
        })
        .catch(() => {
          if (pendingSync.current === request) pendingSync.current = null;
        });
    }
    return () => {
      generation.current += 1;
    };
  }, [account.uid, account.loading, account.cloud]);

  const prepareAttempt = (selected: Stage) => {
    if (!account.cloud) return;
    const uid = account.uid;
    const requestGeneration = generation.current;
    const entryGeneration = (entryGenerations.current.get(selected.id) ?? 0) + 1;
    entryGenerations.current.set(selected.id, entryGeneration);
    void fetchAttemptKey(selected.code).then((key) => {
      if (
        key &&
        generation.current === requestGeneration &&
        current.current.account.uid === uid &&
        entryGenerations.current.get(selected.id) === entryGeneration
      ) {
        attemptKeys.current.set(selected.id, key);
      }
    });
  };

  const recordClear = (code: string, elapsedSec: number, currentStage?: Stage | null) => {
    record(code, elapsedSec);
    if (!account.uid || !account.cloud) return;
    const key = currentStage ? attemptKeys.current.get(currentStage.id) : undefined;
    if (currentStage) {
      attemptKeys.current.delete(currentStage.id);
      entryGenerations.current.set(currentStage.id, (entryGenerations.current.get(currentStage.id) ?? 0) + 1);
    }
    const uid = account.uid;
    const requestGeneration = generation.current;
    void pushClear(code, elapsedSec, key).then((result) => {
      if (
        generation.current === requestGeneration &&
        current.current.account.uid === uid &&
        result === 'unauthorized' &&
        current.current.account.email
      ) {
        current.current.onUnauthorized?.();
      }
    });
  };

  const markSwitched = (hold: boolean) => {
    if (hold) holdSwitchRef.current = true;
    switchedRef.current = true;
  };

  const beginSwitch = () => {
    holdSwitchRef.current = false;
    switchedRef.current = false;
    if (!uidRef.current) return;
    const requestGeneration = ++generation.current;
    void pull([])
      .then(({ clears: merged, unauthorized }) => {
        if (generation.current !== requestGeneration) return;
        if (unauthorized) {
          current.current.onUnauthorized?.();
        } else {
          current.current.replace(merged);
        }
      })
      .catch(() => {});
  };

  const cancelSwitch = () => {
    holdSwitchRef.current = false;
    switchedRef.current = false;
    generation.current += 1;
    if (pendingSync.current) pendingSync.current = null;
  };

  const resetSync = () => {
    generation.current += 1;
    attemptKeys.current.clear();
    entryGenerations.current.clear();
    if (pendingSync.current) pendingSync.current = null;
  };

  return {
    prepareAttempt,
    recordClear,
    markSwitched,
    beginSwitch,
    cancelSwitch,
    resetSync,
  };
}
