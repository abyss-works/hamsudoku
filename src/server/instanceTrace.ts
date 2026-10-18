export interface InstanceInit {
  /** 프로세스 시작부터 서버 계측 초기화를 시작할 때까지의 밀리초. */
  bootMs: number;
  /** 서버 계측 초기화에 걸린 밀리초. */
  initMs: number;
}

interface AttributeTarget {
  setAttribute(key: string, value: number | boolean): unknown;
}

const INIT_KEY = Symbol.for('hamsudoku.instanceInit');

/** 초기화 전후 시각(프로세스 시작 기준 밀리초)으로 부팅 시점과 초기화 소요 시간을 만든다. */
export function recordInitDuration(startMs: number, endMs: number): InstanceInit {
  return { bootMs: startMs, initMs: endMs - startMs };
}

/** 서버 계측 초기화 결과를 프로세스 전역에 둔다. 초기화와 요청 처리 모듈이 다른 번들이어도 같은 값을 읽는다. */
export function setInstanceInit(init: InstanceInit): void {
  (globalThis as unknown as Record<symbol, InstanceInit | undefined>)[INIT_KEY] = init;
}

function storedInstanceInit(): InstanceInit | undefined {
  return (globalThis as unknown as Record<symbol, InstanceInit | undefined>)[INIT_KEY];
}

/**
 * 요청 루트 span이 시작될 때 인스턴스 안 요청 순번, 요청 시작 시점의 인스턴스 경과 시간, 콜드 여부를 남긴다.
 * 첫 요청에는 부팅 시점과 초기화 소요 시간을 함께 남긴다. 시각은 프로세스 시작 기준 밀리초다.
 */
export function createInstanceTracker(now: () => number, init?: InstanceInit) {
  let requests = 0;
  return {
    onRootSpanStart(span: AttributeTarget) {
      requests += 1;
      span.setAttribute('instance.cold', requests === 1);
      span.setAttribute('instance.request_index', requests);
      span.setAttribute('instance.uptime_ms', Math.round(now()));
      const first = requests === 1 ? (init ?? storedInstanceInit()) : undefined;
      if (first) {
        span.setAttribute('instance.boot_ms', Math.round(first.bootMs));
        span.setAttribute('instance.init_ms', Math.round(first.initMs));
      }
    },
  };
}
