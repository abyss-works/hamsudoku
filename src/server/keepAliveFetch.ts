import { Agent, fetch as undiciFetch } from 'undici';

/**
 * 외부 HTTP 호출의 유휴 연결 유지 시간. 서버가 Keep-Alive 힌트를 보내지 않으면 기본값(4초)이 적용되어
 * 드문 요청마다 TCP·TLS 연결을 새로 맺으므로 늘린다.
 */
export const KEEP_ALIVE_OPTIONS = { keepAliveTimeout: 60_000, keepAliveMaxTimeout: 60_000 };

const AGENT_KEY = Symbol.for('hamsudoku.keepAliveAgent');

/** 프로세스에서 공유하는 연결 유지 Agent. 모듈이 여러 번들에 포함돼도 하나만 만든다. */
export function keepAliveAgent(): Agent {
  const holder = globalThis as unknown as Record<symbol, Agent | undefined>;
  holder[AGENT_KEY] ??= new Agent(KEEP_ALIVE_OPTIONS);
  return holder[AGENT_KEY];
}

/** 요청 옵션을 유지한 채 지정한 dispatcher로 보내는 fetch를 만든다. */
export function createServerFetch(baseFetch: typeof fetch, dispatcher: unknown): typeof fetch {
  return ((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    baseFetch(input, { ...init, dispatcher } as RequestInit)) as typeof fetch;
}

/** 서버의 외부 HTTP 호출(Upstash Redis, Supabase Auth)에 쓰는 연결 유지 fetch. */
export const serverFetch: typeof fetch = createServerFetch(undiciFetch as unknown as typeof fetch, keepAliveAgent());
