import { useEffect, useState } from 'react';

export function useElapsed(active: boolean, resetKey: unknown = null): number {
  const [sec, setSec] = useState(0);

  useEffect(() => {
    setSec(0);
  }, [resetKey]);

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [active]);

  return sec;
}

export function formatElapsed(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
