import { useEffect, useRef } from 'react';
export function useFeedbackLifetime() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current)
        clearTimeout(timer.current);
      timer.current = null;
    };
  }, []);
  return { timer, alive };
}
