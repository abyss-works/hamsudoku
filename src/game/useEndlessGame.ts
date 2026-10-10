import { useEffect, useRef } from 'react';
import { useEndlessSession } from './useEndlessSession';
import { useDelayedLoading } from '../ui/useDelayedLoading';
import { useLoading } from '../ui/LoadingProvider';

export function useEndlessGame() {
  const session = useEndlessSession();
  const { track } = useLoading();
  const started = useRef(false);
  const showEntryLoading = useDelayedLoading(!session.puzzle);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void session.start();
  }, [session.start]);
  return { ...session, showEntryLoading, next: () => { void track(session.start()); }, finishBoard: () => { void session.finish(); } };
}
