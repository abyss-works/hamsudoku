/** Server-Timing 항목에서 서버 앱 버전(app 항목의 설명)을 읽는다. 없으면 null이다. */
export function appVersionFrom(entries: readonly { name: string; description: string }[]): string | null {
  const app = entries.find((entry) => entry.name === 'app');
  return app && app.description ? app.description : null;
}

/**
 * 같은 출처 응답의 Server-Timing을 리소스 타이밍으로 관찰해 서버 앱 버전을 전달한다.
 * 요청 코드를 거치지 않으며, 관찰 기능이 없는 환경에서는 아무것도 하지 않는다. 반환한 함수는 관찰을 멈춘다.
 */
export function watchServerVersion(
  onVersion: (version: string) => void,
  Observer: typeof PerformanceObserver | undefined = globalThis.PerformanceObserver,
): () => void {
  if (!Observer) return () => {};
  const observer = new Observer((list) => {
    for (const entry of list.getEntries() as Partial<PerformanceResourceTiming>[]) {
      const version = appVersionFrom(entry.serverTiming ?? []);
      if (version) onVersion(version);
    }
  });
  observer.observe({ type: 'resource', buffered: true });
  return () => observer.disconnect();
}
