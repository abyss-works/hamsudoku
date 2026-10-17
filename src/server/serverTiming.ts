import * as Sentry from '@sentry/nextjs';

/** 요청 처리 시간 중 따로 합산하는 외부 호출 구분. */
export type TimingName = 'db' | 'redis' | 'supabase' | 'http';
export type Timings = Map<TimingName, { durationMs: number; count: number }>;

const ORDER: TimingName[] = ['db', 'redis', 'supabase', 'http'];

/** 완료된 span의 종류와 대상 호스트로 합산 구분을 정한다. DB와 외부 HTTP 호출이 아니면 제외한다. */
export function classifySpan(span: { op: string | undefined; host: string | undefined }): TimingName | undefined {
  if (span.op === 'db' || span.op?.startsWith('db.')) return 'db';
  if (span.op !== 'http.client') return undefined;
  if (span.host?.endsWith('.supabase.co')) return 'supabase';
  // QStash도 upstash.io 호스트이므로 Redis REST 호스트만 따로 센다.
  if (span.host?.endsWith('.upstash.io') && !span.host.startsWith('qstash')) return 'redis';
  return 'http';
}

function hostOf(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

/** span 속성의 대상 주소나 URL, 설명에 포함된 URL에서 호스트를 읽는다. */
export function spanHost(data: Record<string, unknown>, description: string | undefined): string | undefined {
  if (typeof data['server.address'] === 'string') return data['server.address'];
  return hostOf(data['url.full']) ?? hostOf(data['http.url']) ?? hostOf(description?.split(' ').find((part) => part.includes('://')));
}

export function addTiming(timings: Timings, name: TimingName, durationMs: number): void {
  const entry = timings.get(name) ?? { durationMs: 0, count: 0 };
  entry.durationMs += durationMs;
  entry.count += 1;
  timings.set(name, entry);
}

const round = (ms: number) => Math.round(ms * 10) / 10;

/** 구분별 합계 시간·횟수와 전체 처리 시간, 앱 버전을 Server-Timing 헤더 값으로 만든다. 병렬 호출의 합계는 전체보다 클 수 있다. */
export function formatServerTiming(timings: Timings | undefined, totalMs: number, version: string): string {
  const parts = ORDER.flatMap((name) => {
    const entry = timings?.get(name);
    return entry ? [`${name};dur=${round(entry.durationMs)};desc="${entry.count}"`] : [];
  });
  return [...parts, `total;dur=${round(totalMs)}`, `app;desc="${version}"`].join(', ');
}

const timingsByRoot = new WeakMap<object, Timings>();

/** 완료되는 DB·외부 HTTP span의 시간을 요청 루트 span별로 합산한다. 서버 Sentry 초기화 뒤 한 번 호출한다. */
export function collectSpanTimings(): void {
  Sentry.getClient()?.on('spanEnd', (span) => {
    const root = Sentry.getRootSpan(span);
    if (root === span) return;
    const json = Sentry.spanToJSON(span);
    const op = json.attributes['sentry.op'];
    const name = classifySpan({ op: typeof op === 'string' ? op : undefined, host: spanHost(json.attributes, json.name) });
    if (!name || json.end_timestamp === undefined) return;
    const timings = timingsByRoot.get(root) ?? new Map();
    addTiming(timings, name, (json.end_timestamp - json.start_timestamp) * 1000);
    timingsByRoot.set(root, timings);
  });
}

function currentTimings(): Timings | undefined {
  const span = Sentry.getActiveSpan();
  return span ? timingsByRoot.get(Sentry.getRootSpan(span)) : undefined;
}

interface ServerTimingOptions {
  version: string;
  timings: () => Timings | undefined;
  now: () => number;
}

const defaultOptions: ServerTimingOptions = {
  version: process.env.APP_VERSION ?? 'unknown',
  timings: currentTimings,
  now: () => performance.now(),
};

/**
 * route handler의 응답에 처리 시간 구성을 Server-Timing 헤더로 붙인다. 응답 뒤로 미룬 작업은 포함하지 않는다.
 * 헤더를 바꿀 수 없는 응답(Response.redirect 등)은 그대로 반환한다.
 */
export function withServerTiming<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
  options: ServerTimingOptions = defaultOptions,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    const start = options.now();
    const res = await handler(...args);
    try {
      res.headers.append('Server-Timing', formatServerTiming(options.timings(), options.now() - start, options.version));
    } catch {
      // 불변 헤더 응답은 측정 헤더 없이 반환한다.
    }
    return res;
  };
}
