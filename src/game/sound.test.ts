// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Howl, Howler } from 'howler';
import {
  cascadeFrequencies,
  installAudioRecovery,
  isSfxEnabled,
  playCascade,
  playSfx,
  recoverAudio,
  setSfxEnabled,
  type SfxName,
} from './sound';

vi.mock('howler', () => ({
  Howl: vi.fn(function (this: { play?: unknown }) {
    this.play = vi.fn();
  }),
  Howler: { ctx: null as unknown },
}));

const NAMES: SfxName[] = ['ui-click', 'mark', 'erase', 'good', 'bad', 'clear', 'gameover', 'seed'];

afterEach(() => {
  vi.clearAllMocks();
  setSfxEnabled(true);
});

describe('sound', () => {
  it('이름마다 대응 파일을 재생한다', () => {
    for (const name of NAMES) playSfx(name);
    expect(Howl).toHaveBeenCalledTimes(NAMES.length);
    const urls = vi.mocked(Howl).mock.calls.map(([opts]) => (opts as { src: string[] }).src[0]);
    for (const name of NAMES) expect(urls).toContain(`/sfx/${name}.wav`);
    for (const instance of vi.mocked(Howl).mock.instances) {
      expect(instance.play).toHaveBeenCalledTimes(1);
    }
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

function fakeCtx(scheduled: ScheduledNote[], state = 'running'): FakeCtx {
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
    gain = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
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

describe('cascade', () => {
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

  it('전파 딜레이마다 음을 올린다', () => {
    const scheduled: ScheduledNote[] = [];
    useCtx(fakeCtx(scheduled));
    playCascade([180, 60, 120]);
    expect(scheduled).toHaveLength(3);
    expect(scheduled.map((s) => s.at)).toEqual([10.06, 10.12, 10.18]);
    const freqs = scheduled.map((s) => s.freq);
    for (let i = 1; i < freqs.length; i += 1) expect(freqs[i]).toBeGreaterThan(freqs[i - 1]);
  });

  it('끄면 스케줄하지 않는다', () => {
    const scheduled: ScheduledNote[] = [];
    useCtx(fakeCtx(scheduled));
    setSfxEnabled(false);
    playCascade([60]);
    expect(scheduled).toHaveLength(0);
  });

  it('끊기면 깨우고 이번은 건너뛴다', () => {
    const scheduled: ScheduledNote[] = [];
    const ctx = fakeCtx(scheduled, 'suspended');
    useCtx(ctx);
    playCascade([60]);
    expect(ctx.resume).toHaveBeenCalled();
    expect(scheduled).toHaveLength(0);
  });
});

describe('recoverAudio', () => {
  afterEach(() => {
    useCtx(null);
  });

  it('끊긴 컨텍스트를 깨운다', () => {
    const ctx = fakeCtx([], 'suspended');
    useCtx(ctx);
    recoverAudio();
    expect(ctx.resume).toHaveBeenCalled();
  });

  it('돌아가는 컨텍스트는 건드리지 않는다', () => {
    const ctx = fakeCtx([], 'running');
    useCtx(ctx);
    recoverAudio();
    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it('복귀하면 재연결한다', () => {
    const ctx = fakeCtx([], 'suspended');
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
