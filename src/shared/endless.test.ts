import { describe, expect, it } from 'vitest';
import {
  ENDLESS_MIRROR_KEY,
  clearRequestSchema,
  clearResponseSchema,
  endlessMirrorSchema,
  failRequestSchema,
  PLAY_LOG_MAX_EVENTS,
  playLogSchema,
  nextResponseSchema,
  rankResponseSchema,
  seasonIdSchema,
} from './endless';

describe('계약 스키마', () => {
  it('next 응답을 파싱한다', () => {
    const parsed = nextResponseSchema.safeParse({
      stage: { id: 'e-000123', size: 7, regions: '0123456'.repeat(7) },
      solutionCipher: 'abc',
      serverPublicKey: 'def',
      iv: 'ghi',
      attemptKey: 'jkl',
    });
    expect(parsed.success).toBe(true);
  });

  it('clear 요청은 seedLeft 4를 거부한다', () => {
    const parsed = clearRequestSchema.safeParse({
      attemptKey: 'k',
      stageId: 'e-1',
      solution: [[0, 1]],
      seedLeft: 4,
    });
    expect(parsed.success).toBe(false);
  });

  it('clear 응답을 파싱한다', () => {
    const parsed = clearResponseSchema.safeParse({
      ok: true,
      earned: 2,
      balance: 5,
      streak: 3,
      suspicious: false,
    });
    expect(parsed.success).toBe(true);
  });

  it('clear 응답의 무효 분기를 파싱한다', () => {
    const parsed = clearResponseSchema.safeParse({ ok: false, reason: '하한 미달' });
    expect(parsed.success).toBe(true);
  });

  it('fail 요청을 파싱한다', () => {
    expect(failRequestSchema.safeParse({ attemptKey: 'k' }).success).toBe(true);
  });

  it('fail 요청은 attemptKey 누락을 거부한다', () => {
    expect(failRequestSchema.safeParse({}).success).toBe(false);
  });

  it('rank 응답의 me.rank null을 허용한다', () => {
    const parsed = rankResponseSchema.safeParse({
      season: '2026-W41',
      top: [],
      snapshotAt: '2026-10-07T00:00:00.000Z',
      me: { rank: null, score: 0 },
      frozen: false,
    });
    expect(parsed.success).toBe(true);
  });

  it('rank 응답은 잘못된 snapshotAt을 거부한다', () => {
    const parsed = rankResponseSchema.safeParse({
      season: '2026-W41',
      top: [],
      snapshotAt: 'x',
      me: { rank: null, score: 0 },
    });
    expect(parsed.success).toBe(false);
  });

  it('seasonIdSchema가 W00과 W54 이상을 거부한다', () => {
    expect(seasonIdSchema.safeParse('2026-W41').success).toBe(true);
    expect(seasonIdSchema.safeParse('2026-W00').success).toBe(false);
    expect(seasonIdSchema.safeParse('2026-W54').success).toBe(false);
  });

  it('미러 스키마와 저장 키를 노출한다', () => {
    expect(ENDLESS_MIRROR_KEY).toBe('hamsudoku:endless:v1');
    const parsed = endlessMirrorSchema.safeParse({
      v: 1,
      wallet: { balance: 3 },
      clearedIds: ['e-1'],
      streak: { current: 1, best: 2 },
      season: '2026-W41',
    });
    expect(parsed.success).toBe(true);
  });
});

describe('플레이 기록 계약', () => {
  it('좌표 없는 이벤트와 좌표 있는 이벤트를 함께 파싱한다', () => {
    const log = {
      version: 1,
      events: [[0, 'probe-on'], [120, 'correct', 0, 6], [300, 'mark'], [450, 'wrong', 6, 0], [900, 'probe-off'], [1000, 'reset'], [1200, 'erase', 3, 3]],
    };
    expect(playLogSchema.parse(log)).toEqual(log);
  });

  it.each([
    ['버전이 1이 아니면', { version: 2, events: [] }],
    ['알 수 없는 코드면', { version: 1, events: [[0, 'jump']] }],
    ['t가 음수면', { version: 1, events: [[-1, 'mark']] }],
    ['t가 정수가 아니면', { version: 1, events: [[1.5, 'mark']] }],
    ['좌표가 하나만 있으면', { version: 1, events: [[0, 'mark', 1]] }],
    ['좌표가 판 범위를 벗어나면', { version: 1, events: [[0, 'mark', 7, 0]] }],
    ['events가 배열이 아니면', { version: 1, events: {} }],
  ])('%s 거부한다', (_label, log) => {
    expect(playLogSchema.safeParse(log).success).toBe(false);
  });

  it('이벤트는 상한 개수까지 허용하고 초과하면 거부한다', () => {
    const events = (count: number) => Array.from({ length: count }, (_, i) => [i, 'mark']);
    expect(PLAY_LOG_MAX_EVENTS).toBe(2000);
    expect(playLogSchema.safeParse({ version: 1, events: events(PLAY_LOG_MAX_EVENTS) }).success).toBe(true);
    expect(playLogSchema.safeParse({ version: 1, events: events(PLAY_LOG_MAX_EVENTS + 1) }).success).toBe(false);
  });

  it('clear·fail 요청은 형식이 틀린 기록이 있어도 파싱하고 기록 원문을 유지한다', () => {
    const clear = clearRequestSchema.parse({ attemptKey: 'k', stageId: 'e-1', solution: [[0, 1]], seedLeft: 2, log: 'broken' });
    expect(clear.log).toBe('broken');
    const fail = failRequestSchema.parse({ attemptKey: 'k', log: { version: 9 } });
    expect(fail.log).toEqual({ version: 9 });
    expect(failRequestSchema.parse({ attemptKey: 'k' }).log).toBeUndefined();
  });
});
