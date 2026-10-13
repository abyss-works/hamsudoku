import { useCallback, useEffect, useRef, useState } from 'react';
import { useDelayedLoading } from './useDelayedLoading';

export function useLoadingService() {
  const [pending, setPending] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const track = useCallback(<T,>(promise: Promise<T>): Promise<T> => {
    setPending((count) => count + 1);
    const done = () => {
      if (mounted.current) setPending((count) => Math.max(0, count - 1));
    };
    return promise.then(
      (value) => { done(); return value; },
      (error) => { done(); throw error; },
    );
  }, []);
  return { track, show: useDelayedLoading(pending > 0) };
}
