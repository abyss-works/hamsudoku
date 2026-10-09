// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Howl, Howler } from 'howler';
import {
  cascadeFrequencies,
  installAudioRecovery,
  isSfxEnabled,
  playGoodProgression,
  playSfx,
  recoverAudio,
  resetSoundForTests,
  setSfxEnabled,
  type SfxName,
} from './sound';

vi.mock('howler', () => ({
  Howl: vi.fn(function (this: { play?: unknown; rate?: unknown; volume?: unknown }) {
    this.play = vi.fn(() => 7);
    this.rate = vi.fn();
    this.volume = vi.fn();
  }),
  Howler: { ctx: null as unknown },
}));

const NAMES: SfxName[] = ['ui-click', 'mark', 'erase', 'good', 'bad', 'clear', 'gameover', 'seed'];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllMocks();
  resetSoundForTests();
  setSfxEnabled(true);
  vi.useRealTimers();
});

function totalPlays() {
  return vi
    .mocked(Howl)
    .mock.instances.map((inst) => (inst.play as unknown as { mock: { calls: unknown[] } }).mock.calls.length)
    .reduce((a, b) => a + b, 0);
}

describe('sound', () => {
  it('이름마다 대응 파일을 재생한다', () => {
    for (const name of NAMES) {
      playSfx(name);
      vi.advanceTimersByTime(100);
    }
    expect(Howl).toHaveBeenCalledTimes(NAMES.length);
    const urls = vi.mocked(Howl).mock.calls.map(([opts]) => (opts as { src: string[] }).src[0]);
    for (const name of NAMES) expect(urls).toContain(`/sfx/${name}.wav`);
    expect(totalPlays()).toBe(NAMES.length);
  });

  it('최소 간격으로 띄워 재생한다', () => {
    playSfx('mark');
    playSfx('mark');
    vi.advanceTimersByTime(50);
    expect(totalPlays()).toBe(1);
    vi.advanceTimersByTime(50);
    expect(totalPlays()).toBe(2);
  });

  it('밀리면 버린다', () => {
    for (let i = 0; i < 10; i += 1) playSfx('mark');
    vi.advanceTimersByTime(2000);
    expect(totalPlays()).toBe(6);
  });

  it('끄면 재생하지 않는다', () => {
    setSfxEnabled(false);
    expect(isSfxEnabled()).toBe(false);
    playSfx('mark');
    expect(Howl).not.toHaveBeenCalled();
  });

  it('서버에서는 재생하지 않는다', () => {
    const w = globalThis.window;
    delete (globalThis as { window?: unknown }).window;
    try {
      playSfx('mark');
      expect(Howl).not.toHaveBeenCalled();
    } finally {
      globalThis.window = w;
    }
  });

  it('미리 받아두면 첫 재생이 막히지 않는다', async () => {
    vi.resetModules();
    const fresh = await import('./sound');
    fresh.preloadSfx();
    expect(Howl).toHaveBeenCalledTimes(NAMES.length);
  });
});

interface ScheduledNote {
  freq: number;
  at: number;
}

interface FakeCtx {
  currentTime: number;
  state: string;
  destination: object;
  resume: ReturnType<typeof vi.fn>;
  createOscillator: () => unknown;
  createGain: () => unknown;
}

function fakeCtx(scheduled: ScheduledNote[], gains: number[], state = 'running'): FakeCtx {
  class FakeOsc {
    type = '';
    frequency = { value: 0 };
    connect() {}
    start(at?: number) {
      scheduled.push({ freq: this.frequency.value, at: at ?? 0 });
    }
    stop() {}
  }
  class FakeGain {
    gain = {
      setValueAtTime: (v: number) => {
        gains.push(v);
      },
      exponentialRampToValueAtTime() {},
    };
    connect() {}
  }
  return {
    currentTime: 10,
    state,
    destination: {},
    resume: vi.fn(),
    createOscillator: () => new FakeOsc(),
    createGain: () => new FakeGain(),
  };
}

function useCtx(ctx: FakeCtx | null) {
  (Howler as unknown as { ctx: unknown }).ctx = ctx;
}

describe('progression', () => {
  afterEach(() => {
    useCtx(null);
    setSfxEnabled(true);
  });

  it('음높이는 pentatonic으로 오른다', () => {
    const freqs = cascadeFrequencies(6);
    expect(freqs).toHaveLength(6);
    for (let i = 1; i < freqs.length; i += 1) expect(freqs[i]).toBeGreaterThan(freqs[i - 1]);
    expect(freqs[0]).toBeCloseTo(523.25, 0);
  });

  it('24개를 넘기면 자른다', () => {
    expect(cascadeFrequencies(30)).toHaveLength(24);
  });

  it('맞힐 때마다 높아지고 한음씩 붙는다', () => {
    const scheduled: ScheduledNote[] = [];
    useCtx(fakeCtx(scheduled, []));
    playGoodProgression(1);
    expect(scheduled.map((s) => s.freq)).toEqual(cascadeFrequencies(2));
    scheduled.length = 0;
    playGoodProgression(3);
    expect(scheduled.map((s) => s.freq)).toEqual(cascadeFrequencies(6).slice(2));
    expect(scheduled.map((s) => s.at)).toEqual([10, 10.09, 10.18, 10.27]);
  });

  it('5음을 넘기지 않는다', () => {
    const scheduled: ScheduledNote[] = [];
    useCtx(fakeCtx(scheduled, []));
    playGoodProgression(99);
    expect(scheduled).toHaveLength(5);
  });

  it('끄면 스케줄하지 않는다', () => {
    const scheduled: ScheduledNote[] = [];
    useCtx(fakeCtx(scheduled, []));
    setSfxEnabled(false);
    playGoodProgression(3);
    expect(scheduled).toHaveLength(0);
  });

  it('끊기면 깨우고 이번은 건너뛴다', () => {
    const scheduled: ScheduledNote[] = [];
    const ctx = fakeCtx(scheduled, [], 'suspended');
    useCtx(ctx);
    playGoodProgression(3);
    expect(ctx.resume).toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
  });
});

describe('bad rate', () => {
  it('배율을 올려 재생한다', () => {
    playSfx('bad', 1.12);
    vi.advanceTimersByTime(100);
    const inst = vi.mocked(Howl).mock.instances[0] as unknown as { rate: { mock: { calls: unknown[][] } } };
    expect(inst.rate.mock.calls).toEqual([[1.12, 7]]);
  });

  it('볼륨을 낮춰 재생한다', () => {
    playSfx('bad', 1, 0.7);
    vi.advanceTimersByTime(100);
    const inst = vi.mocked(Howl).mock.instances[0] as unknown as { volume: { mock: { calls: unknown[][] } } };
    expect(inst.volume.mock.calls).toEqual([[0.7, 7]]);
  });
});

describe('recoverAudio', () => {
  afterEach(() => {
    useCtx(null);
  });

  it('끊긴 컨텍스트를 깨운다', () => {
    const ctx = fakeCtx([], [], 'suspended');
    useCtx(ctx);
    recoverAudio();
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('돌아가는 컨텍스트는 건드리지 않는다', () => {
    const ctx = fakeCtx([], [], 'running');
    useCtx(ctx);
    recoverAudio();
    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it('복귀하면 재연결한다', () => {
    const ctx = fakeCtx([], [], 'suspended');
    useCtx(ctx);
    const off = installAudioRecovery();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    off();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });
});
