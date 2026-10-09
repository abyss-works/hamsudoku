// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Howl } from 'howler';
import { isSfxEnabled, playSfx, setSfxEnabled, type SfxName } from './sound';

vi.mock('howler', () => ({
  Howl: vi.fn(function (this: { play?: unknown }) {
    this.play = vi.fn();
  }),
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
