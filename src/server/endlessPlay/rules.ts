import { PLAY_LOG_MAX_EVENTS, playLogSchema, type PlayEvent } from '../../shared/endless';

export const MIN_CLEAR_MS = 3_000;
export const MIN_SUBMIT_GAP_MS = 1_000;
export const PERFECT_WINDOW = 20;
export const PERFECT_SUSPICIOUS_AT = 16;

function normalizeSolution(pairs: [number, number][] | string): string {
  if (typeof pairs === 'string') {
    return pairs
      .split(';')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .sort()
      .join(';');
  }
  return pairs.map(([r, c]) => `${r},${c}`).sort().join(';');
}

/** 제출 좌표가 저장된 정답과 같은지 판정한다. 좌표 순서는 무시한다. */
export function solutionMatches(submitted: [number, number][], stored: string): boolean {
  return normalizeSolution(submitted) === normalizeSolution(stored);
}

/** 보상하지 않을 제출의 이벤트 사유와 응답 문구. 정답, 최소 시간, 잔여 씨앗 순서로 판정한다. */
export function clearRejection(input: {
  solutionOk: boolean;
  elapsedMs: number;
  seedLeft: number;
}): { event: string; message: string } | null {
  if (!input.solutionOk) return { event: '정답 불일치', message: '정답이 맞지 않아요.' };
  if (input.elapsedMs < MIN_CLEAR_MS) return { event: '하한 미달', message: '제출이 너무 빨라요.' };
  if (input.seedLeft < 1) return { event: '잔여 씨앗 없음', message: '잔여 씨앗이 없어요.' };
  return null;
}

/**
 * 제출 간격과 의심 패턴을 판정한다. 간격은 마지막 검증 클리어 시각으로부터 계산하고,
 * 의심 패턴은 최근 이벤트(기록 시각 역순) 중 씨앗 3개 검증 클리어 수로 판정한다.
 */
export function assessSubmission(
  recent: { verified: boolean; seedLeft: number; createdAt: Date }[],
  lastVerifiedAt: Date | null,
  now: Date,
): { tooSoon: boolean; suspicious: boolean } {
  const tooSoon = lastVerifiedAt !== null && now.getTime() - lastVerifiedAt.getTime() < MIN_SUBMIT_GAP_MS;
  const perfectCount = recent.filter((event) => event.verified && event.seedLeft === 3).length;
  return { tooSoon, suspicious: perfectCount >= PERFECT_SUSPICIOUS_AT };
}

export type PlayLogError = 'missing' | 'invalid' | 'too_large';

export interface PlayLogRecord {
  logVersion: number | null;
  events: PlayEvent[] | null;
  logError: PlayLogError | null;
}

/**
 * 요청의 기록 원문을 저장할 값으로 판정한다. 없으면 missing, 이벤트가 상한을 넘으면 내용과 무관하게 too_large,
 * 형식이 틀리면 invalid이며 이때는 원문을 저장하지 않는다.
 */
export function readPlayLog(raw: unknown): PlayLogRecord {
  if (raw === undefined) return { logVersion: null, events: null, logError: 'missing' };
  const events = typeof raw === 'object' && raw !== null ? (raw as { events?: unknown }).events : undefined;
  if (Array.isArray(events) && events.length > PLAY_LOG_MAX_EVENTS) {
    return { logVersion: null, events: null, logError: 'too_large' };
  }
  const parsed = playLogSchema.safeParse(raw);
  if (!parsed.success) return { logVersion: null, events: null, logError: 'invalid' };
  return { logVersion: parsed.data.version, events: parsed.data.events, logError: null };
}

export const PLAY_AUDIT_VERSION = 1;
const STARTING_SEEDS = 3;
/** 클라이언트 경과 시간이 서버 경과 시간을 넘어도 허용하는 오차. */
export const DURATION_TOLERANCE_MS = 2_000;

export type PlayAuditFlag =
  | 'seedMismatch'
  | 'correctOffSolution'
  | 'missingSolutionCells'
  | 'nonMonotonic'
  | 'durationExceedsServer'
  | 'no_log';

/** 감사 결과 version 1. 기록이 없거나 outcome에 해당하지 않는 지표는 null이다. */
export interface PlayAudit {
  version: typeof PLAY_AUDIT_VERSION;
  wrongCount: number | null;
  derivedSeedLeft: number | null;
  seedMismatch: boolean | null;
  correctOffSolution: number | null;
  missingSolutionCells: number | null;
  nonMonotonic: boolean | null;
  clientDurationMs: number | null;
  durationExceedsServer: boolean | null;
  minCorrectGapMs: number | null;
  flags: PlayAuditFlag[];
}

export interface PlayAuditInput {
  events: PlayEvent[] | null;
  /** 판 정답. 저장 형식은 `r,c;r,c;...`이다. */
  solution: string;
  outcome: 'clear' | 'fail';
  claimedSeedLeft: number | null;
  serverElapsedMs: number;
}

/**
 * 플레이 기록을 판 정답과 제출 정보에 대조한 감사 결과를 계산한다.
 * 잔여 씨앗은 3에서 오답마다 1씩 줄여 계산하고, 신고 값 비교와 누락 정답 칸은 클리어에서만 판정한다.
 * 좌표가 없는 정답 착수는 정답 칸과 대조할 수 없으므로 정답에 없는 착수로 센다.
 */
export function auditPlayLog(input: PlayAuditInput): PlayAudit {
  if (input.events === null) {
    return {
      version: PLAY_AUDIT_VERSION,
      wrongCount: null,
      derivedSeedLeft: null,
      seedMismatch: null,
      correctOffSolution: null,
      missingSolutionCells: null,
      nonMonotonic: null,
      clientDurationMs: null,
      durationExceedsServer: null,
      minCorrectGapMs: null,
      flags: ['no_log'],
    };
  }
  const events = input.events;
  const solutionCells = new Set(
    input.solution
      .split(';')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0),
  );
  const corrects = events.filter((event) => event[1] === 'correct');
  const correctCells = corrects.flatMap((event) => (event.length === 4 ? [`${event[2]},${event[3]}`] : []));
  const isClear = input.outcome === 'clear';

  const wrongCount = events.filter((event) => event[1] === 'wrong').length;
  const derivedSeedLeft = Math.max(0, STARTING_SEEDS - wrongCount);
  const seedMismatch = isClear ? input.claimedSeedLeft !== derivedSeedLeft : null;
  const correctOffSolution = corrects.length - correctCells.filter((cell) => solutionCells.has(cell)).length;
  const placed = new Set(correctCells);
  const missingSolutionCells = isClear ? [...solutionCells].filter((cell) => !placed.has(cell)).length : null;
  const nonMonotonic = events.some((event, index) => index > 0 && event[0] < events[index - 1][0]);
  const clientDurationMs = events.length === 0 ? 0 : events[events.length - 1][0];
  const durationExceedsServer = clientDurationMs > input.serverElapsedMs + DURATION_TOLERANCE_MS;
  const gaps = corrects.slice(1).map((event, index) => event[0] - corrects[index][0]);
  const minCorrectGapMs = gaps.length === 0 ? null : Math.min(...gaps);

  const flags: PlayAuditFlag[] = [];
  if (seedMismatch) flags.push('seedMismatch');
  if (correctOffSolution > 0) flags.push('correctOffSolution');
  if (missingSolutionCells !== null && missingSolutionCells > 0) flags.push('missingSolutionCells');
  if (nonMonotonic) flags.push('nonMonotonic');
  if (durationExceedsServer) flags.push('durationExceedsServer');

  return {
    version: PLAY_AUDIT_VERSION,
    wrongCount,
    derivedSeedLeft,
    seedMismatch,
    correctOffSolution,
    missingSolutionCells,
    nonMonotonic,
    clientDurationMs,
    durationExceedsServer,
    minCorrectGapMs,
    flags,
  };
}
