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

// 전파 딜레이마다 음을 올린다. 끊긴 상태면 깨우고 이번은 건너뛴다(묻지 않게).
export function playCascade(delaysMs: number[]): void {
  if (!enabled) return;
  const ctx = audioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
    return;
  }
  const ordered = [...delaysMs].sort((a, b) => a - b).slice(0, 24);
  const freqs = cascadeFrequencies(ordered.length);
  const t0 = ctx.currentTime;
  ordered.forEach((ms, i) => {
    const t = t0 + ms / 1000;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freqs[i];
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}
