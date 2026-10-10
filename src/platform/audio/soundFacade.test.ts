// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { Howl } from 'howler';
import * as sound from './sound';

vi.mock('howler', () => ({
  Howl: vi.fn(function (this: { play?: unknown; rate?: unknown; volume?: unknown }) {
    this.play = vi.fn(() => 7); this.rate = vi.fn(); this.volume = vi.fn();
  }), Howler: { ctx: null },
}));
afterEach(() => { sound.resetSoundForTests(); vi.useRealTimers(); });

it('판별 오답 연속음이 독립적이며 reset 뒤 첫 음높이로 돌아간다', () => {
  vi.useFakeTimers();
  const a = sound.createBoardSounds();
  const b = sound.createBoardSounds();
  a.playWrongSound(); a.playWrongSound(); b.playWrongSound(); a.reset(); a.playWrongSound();
  vi.runAllTimers();
  const instance = vi.mocked(Howl).mock.instances[0];
  const rates = vi.mocked(instance.rate).mock.calls.map(([rate]) => rate);
  expect(rates).toEqual([2 ** (2 / 12), 2 ** (4 / 12), 2 ** (2 / 12), 2 ** (2 / 12)]);
  expect(vi.mocked(instance.volume).mock.calls).toEqual(Array(4).fill([0.7, 7]));
});
