import { Howl, Howler } from 'howler';

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

/** 테스트 전용. Howl 캐시를 비운다. 목 기록은 테스트마다 초기화되지만
 * 캐시는 살아 있어서, 비우지 않으면 두 번째부터 재생이 안 보인다. */
export function resetSoundForTests(): void {
  cache.clear();
}

export function setSfxEnabled(on: boolean): void {
  enabled = on;
}

export function isSfxEnabled(): boolean {
  return enabled;
}

// 이름마다 대응 파일을 미리 받아둔다. 첫 재생 때 받아오면 소리가 늦는다.
export function preloadSfx(): void {
  if (typeof window === 'undefined') return;
  (Object.keys(FILES) as SfxName[]).forEach((name) => {
    if (!cache.has(name)) cache.set(name, new Howl({ src: [FILES[name]], preload: true }));
  });
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

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (Howler as unknown as { ctx?: AudioContext | null }).ctx ?? null;
}

// 끊긴 공유 컨텍스트를 깨운다. iOS 사파리는 백그라운드에서 suspend시키고
// 복귀해도 안 깨우므로 복귀 감지(아래)에서 부른다.
export function recoverAudio(): void {
  const ctx = audioCtx();
  if (ctx && ctx.state === 'suspended') void ctx.resume();
}

// 복귀하면 재연결한다. 리로드하지 않는다(판이 날아간다).
export function installAudioRecovery(): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible') recoverAudio();
  };
  const onShow = () => recoverAudio();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onShow);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onShow);
  };
}

// C5 기준 pentatonic 상승. 전파 디리리링용이다.
const CASCADE_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export function cascadeFrequencies(n: number): number[] {
  const count = Math.max(0, Math.min(24, Math.floor(n)));
  return Array.from({ length: count }, (_, i) => {
    const st = CASCADE_STEPS[i] ?? CASCADE_STEPS[CASCADE_STEPS.length - 1] + (i - CASCADE_STEPS.length + 1) * 2;
    return 523.25 * 2 ** (st / 12);
  });
}

// 전파 박자마다 한음씩 늘어난 화음을 올린다. 0박 2음, 1박 3음, ….
// 박자 합을 일정하게 나눠 먹지 않게 한다. 12박자까지 본다.
export function playCascade(delaysMs: number[]): void {
  if (!enabled) return;
  const ctx = audioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
    return;
  }
  const ordered = [...delaysMs].sort((a, b) => a - b).slice(0, 12);
  const t0 = ctx.currentTime;
  ordered.forEach((ms, i) => {
    const t = t0 + ms / 1000;
    const freqs = cascadeFrequencies(2 * i + 2).slice(i);
    const gainValue = 0.25 / freqs.length;
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gainValue, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  });
}
