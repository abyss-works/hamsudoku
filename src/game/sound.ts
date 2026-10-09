import { Howl } from 'howler';

export type SfxName = 'ui-click' | 'mark' | 'erase' | 'good' | 'bad' | 'clear' | 'gameover' | 'seed';

const FILES: Record<SfxName, string> = {
  'ui-click': '/sfx/ui-click.wav',
  mark: '/sfx/mark.wav',
  erase: '/sfx/erase.wav',
  good: '/sfx/good.wav',
  bad: '/sfx/bad.wav',
  clear: '/sfx/clear.wav',
  gameover: '/sfx/gameover.wav',
  seed: '/sfx/seed.wav',
};

let enabled = true;
const cache = new Map<SfxName, Howl>();

export function setSfxEnabled(on: boolean): void {
  enabled = on;
}

export function isSfxEnabled(): boolean {
  return enabled;
}

// 설정이 꺼져 있거나 서버에서는 재생하지 않는다.
// Howler가 첫 제스처에 오디오 잠금을 푼다.
export function playSfx(name: SfxName): void {
  if (!enabled || typeof window === 'undefined') return;
  let howl = cache.get(name);
  if (!howl) {
    howl = new Howl({ src: [FILES[name]], preload: true });
    cache.set(name, howl);
  }
  howl.play();
}
