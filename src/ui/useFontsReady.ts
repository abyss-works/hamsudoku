import { useEffect, useState } from 'react';

// 웹폰트가 올라올 때까지 첫 렌더를 미루는 게이트다. Font Loading API로
// families를 명시 로드하고, 타임아웃이 지나면 폰트 없이도 렌더한다.
// (오프라인·차단 환경에서 빈 화면으로 고착되지 않게 한다.)
export function useFontsReady(families: string[] = ['Jua', 'Noto Sans KR'], timeoutMs = 1500): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, timeoutMs);
    const fonts = document.fonts as FontFaceSet | undefined;
    if (typeof fonts?.load !== 'function') {
      clearTimeout(timer);
      setReady(true);
      return;
    }
    void Promise.allSettled(families.map((f) => fonts.load(`16px "${f}"`))).then(() => {
      if (cancelled) return;
      clearTimeout(timer);
      setReady(true);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [timeoutMs, families.join('\u0000')]);

  return ready;
}
