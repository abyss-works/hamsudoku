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

/** 테스트 전용. Howl 캐시와 재생 큐를 비운다. 목 기록은 테스트마다 초기화되지만
 * 캐시는 살아 있어서, 비우지 않으면 두 번째부터 재생이 안 보인다. */
export function resetSoundForTests(): void {
  cache.clear();
  queue.length = 0;
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  lastStart = 0;
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
export function playSfx(name: SfxName, rate = 1): void {
  if (!enabled || typeof window === 'undefined') return;
  // 밀리면 버린다. 낡은 소리가 꼬리를 물면 더 이상하다. 진행 1 + 대기 5개까지.
  if (timer !== null && queue.length >= 5) return;
  queue.push({ name, rate });
  pump();
}

function playNow(name: SfxName, rate: number): void {
  let howl = cache.get(name);
  if (!howl) {
    howl = new Howl({ src: [FILES[name]], preload: true });
    cache.set(name, howl);
  }
  if (rate === 1) {
    howl.play();
    return;
  }
  const id = howl.play();
  howl.rate(rate, id);
}

// 최소 간격으로 띄워 재생한다. 바로바로 붙으면 소리가 뭉개진다.
const MIN_GAP_MS = 90;

interface Queued {
  name: SfxName;
  rate: number;
}

const queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let lastStart = 0;

function pump(): void {
  if (timer !== null) return;
  const next = queue.shift();
  if (!next) return;
  const wait = Math.max(0, MIN_GAP_MS - (Date.now() - lastStart));
  timer = setTimeout(() => {
    timer = null;
    lastStart = Date.now();
    playNow(next.name, next.rate);
    pump();
  }, wait);
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

// C5 기준 pentatonic 상승. 진행음의 재료다.
const CASCADE_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export function cascadeFrequencies(n: number): number[] {
  const count = Math.max(0, Math.min(24, Math.floor(n)));
  return Array.from({ length: count }, (_, i) => {
    const st = CASCADE_STEPS[i] ?? CASCADE_STEPS[CASCADE_STEPS.length - 1] + (i - CASCADE_STEPS.length + 1) * 2;
    return 523.25 * 2 ** (st / 12);
  });
}

function blip(ctx: AudioContext, freq: number, t: number, gainValue: number): void {
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

function liveCtx(): AudioContext | null {
  if (!enabled) return null;
  const ctx = audioCtx();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    void ctx.resume();
    return null;
  }
  return ctx;
}

// 정답 연타 진행음. 맞힐 때마다 높아지고 한음씩 붙는다. 2음 시작, 최대 5음.
export function playGoodProgression(streak: number): void {
  const ctx = liveCtx();
  if (!ctx) return;
  const s = Math.max(1, Math.min(8, Math.floor(streak)));
  const count = Math.min(s + 1, 5);
  const start = Math.min(s - 1, 12);
  const freqs = cascadeFrequencies(start + count).slice(start);
  const t0 = ctx.currentTime;
  freqs.forEach((freq, i) => blip(ctx, freq, t0 + i * 0.09, 0.2));
}
