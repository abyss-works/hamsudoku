export interface ApiTiming {
  /** 쿼리를 뺀 API 경로. */
  path: string;
  /** 요청 시작부터 응답 완료까지의 브라우저 기준 밀리초. */
  durationMs: number;
  /** 응답 Server-Timing의 서버 처리 밀리초(total). 없으면 null. */
  serverMs: number | null;
}

interface ResourceEntry {
  name: string;
  duration: number;
  serverTiming?: readonly { name: string; duration: number; description?: string }[];
}

/** 같은 출처의 `/api/` 리소스 응답에서 경로와 브라우저·서버 처리 시간을 읽는다. 해당하지 않으면 null이다. */
export function apiTimingFrom(entry: ResourceEntry, origin: string): ApiTiming | null {
  let url: URL;
  try {
    url = new URL(entry.name);
  } catch {
    return null;
  }
  if (url.origin !== origin || !url.pathname.startsWith('/api/')) return null;
  const total = entry.serverTiming?.find((timing) => timing.name === 'total');
  return { path: url.pathname, durationMs: Math.round(entry.duration), serverMs: total ? Math.round(total.duration) : null };
}

/**
 * 리소스 타이밍을 관찰해 같은 출처 API 응답의 시간을 전달한다. 요청 코드를 거치지 않으며,
 * 관찰 기능이 없는 환경에서는 아무것도 하지 않는다. 반환한 함수는 관찰을 멈춘다.
 */
export function watchApiTimings(
  onTiming: (timing: ApiTiming) => void,
  origin: string = globalThis.location?.origin ?? '',
  Observer: typeof PerformanceObserver | undefined = globalThis.PerformanceObserver,
): () => void {
  if (!Observer || !origin) return () => {};
  const observer = new Observer((list) => {
    for (const entry of list.getEntries() as unknown as ResourceEntry[]) {
      const timing = apiTimingFrom(entry, origin);
      if (timing) onTiming(timing);
    }
  });
  observer.observe({ type: 'resource', buffered: true });
  return () => observer.disconnect();
}
