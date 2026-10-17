import { describe, expect, it } from 'vitest';
import type { PlayEvent } from '../../shared/endless';
import { assessSubmission, auditPlayLog, clearRejection, readPlayLog, solutionMatches } from './rules';

describe('solutionMatches', () => {
  it('좌표 순서와 무관하게 저장된 정답과 같으면 true다', () => {
    expect(solutionMatches([[1, 2], [0, 0]], '0,0;1,2')).toBe(true);
    expect(solutionMatches([[0, 0]], '0,0;1,2')).toBe(false);
  });
});

describe('clearRejection', () => {
  const ok = { solutionOk: true, elapsedMs: 3000, seedLeft: 1 };

  it('정답·최소 시간·잔여 씨앗을 모두 만족하면 거절하지 않는다', () => {
    expect(clearRejection(ok)).toBeNull();
  });

  it.each([
    [{ solutionOk: false, elapsedMs: 1000, seedLeft: 0 }, '정답 불일치', '정답이 맞지 않아요.'],
    [{ ...ok, elapsedMs: 2999, seedLeft: 0 }, '하한 미달', '제출이 너무 빨라요.'],
    [{ ...ok, seedLeft: 0 }, '잔여 씨앗 없음', '잔여 씨앗이 없어요.'],
  ])('앞선 조건부터 판정해 거절 사유를 반환한다 (%j)', (input, event, message) => {
    expect(clearRejection(input)).toEqual({ event, message });
  });
});

describe('assessSubmission', () => {
  const now = new Date('2026-10-21T03:00:00.000Z');
  const at = (msBefore: number) => new Date(now.getTime() - msBefore);

  it('마지막 검증 클리어와 1초 미만이면 너무 잦은 제출이다', () => {
    expect(assessSubmission([], at(999), now).tooSoon).toBe(true);
    expect(assessSubmission([], at(1000), now).tooSoon).toBe(false);
  });

  it('간격은 최근 이벤트가 아니라 마지막 검증 클리어 시각으로 판정한다', () => {
    const recent = [{ verified: false, seedLeft: 2, createdAt: at(10) }];
    expect(assessSubmission(recent, at(5000), now).tooSoon).toBe(false);
    expect(assessSubmission(recent, null, now).tooSoon).toBe(false);
  });

  it('최근 이벤트 중 씨앗 3개 검증 클리어가 16건 이상이면 의심 표시를 한다', () => {
    const perfect = (n: number) => Array.from({ length: n }, (_, i) => ({ verified: true, seedLeft: 3, createdAt: at(60_000 + i) }));
    expect(assessSubmission(perfect(15), at(60_000), now).suspicious).toBe(false);
    expect(assessSubmission(perfect(16), at(60_000), now).suspicious).toBe(true);
  });
});

describe('readPlayLog', () => {
  it('형식에 맞는 기록은 버전과 이벤트를 반환한다', () => {
    const events = [[0, 'probe-on'], [120, 'correct', 0, 6]];
    expect(readPlayLog({ version: 1, events })).toEqual({ logVersion: 1, events, logError: null });
  });

  it('기록이 없으면 missing이다', () => {
    expect(readPlayLog(undefined)).toEqual({ logVersion: null, events: null, logError: 'missing' });
  });

  it.each([[null], ['broken'], [{ version: 2, events: [] }], [{ version: 1, events: [[0, 'jump']] }], [{ version: 1 }]])(
    '형식이 틀린 기록 %j는 invalid이다',
    (raw) => {
      expect(readPlayLog(raw)).toEqual({ logVersion: null, events: null, logError: 'invalid' });
    },
  );

  it('이벤트가 상한을 넘으면 내용과 무관하게 too_large이다', () => {
    const events = Array.from({ length: 2001 }, () => 'x');
    expect(readPlayLog({ version: 1, events })).toEqual({ logVersion: null, events: null, logError: 'too_large' });
    expect(readPlayLog({ version: 1, events: Array.from({ length: 2000 }, (_, i) => [i, 'mark']) }).logError).toBeNull();
  });
});

describe('auditPlayLog', () => {
  const SOLUTION = '0,0;1,2;2,4';
  const base = { solution: SOLUTION, outcome: 'clear' as const, claimedSeedLeft: 3, serverElapsedMs: 10_000 };
  const cleanClear: PlayEvent[] = [
    [0, 'probe-on'],
    [800, 'correct', 0, 0],
    [1500, 'mark'],
    [2600, 'correct', 1, 2],
    [4000, 'correct', 2, 4],
  ];

  it('정상 클리어 기록은 이상 항목이 없다', () => {
    expect(auditPlayLog({ ...base, events: cleanClear })).toEqual({
      version: 1,
      wrongCount: 0,
      derivedSeedLeft: 3,
      seedMismatch: false,
      correctOffSolution: 0,
      missingSolutionCells: 0,
      nonMonotonic: false,
      clientDurationMs: 4000,
      durationExceedsServer: false,
      minCorrectGapMs: 1400,
      flags: [],
    });
  });

  it('오답 수로 잔여 씨앗을 계산하고 신고 값과 다르면 seedMismatch로 표시한다', () => {
    const events: PlayEvent[] = [[100, 'wrong', 0, 1], ...cleanClear.slice(1)];
    const audit = auditPlayLog({ ...base, events });
    expect(audit).toMatchObject({ wrongCount: 1, derivedSeedLeft: 2, seedMismatch: true, flags: ['seedMismatch'] });
    expect(auditPlayLog({ ...base, claimedSeedLeft: 2, events }).flags).toEqual([]);
  });

  it('잔여 씨앗은 0 아래로 내려가지 않는다', () => {
    const wrongs: PlayEvent[] = [[1, 'wrong', 0, 1], [2, 'wrong', 0, 2], [3, 'wrong', 0, 3], [4, 'wrong', 0, 4]];
    expect(auditPlayLog({ ...base, outcome: 'fail', claimedSeedLeft: null, events: wrongs })).toMatchObject({
      wrongCount: 4,
      derivedSeedLeft: 0,
    });
  });

  it('정답에 없는 칸의 정답 착수와 기록에 없는 정답 칸을 센다', () => {
    const events: PlayEvent[] = [[800, 'correct', 0, 0], [900, 'correct', 0, 0], [1600, 'correct', 3, 3], [1700, 'correct']];
    expect(auditPlayLog({ ...base, events })).toMatchObject({
      correctOffSolution: 2,
      missingSolutionCells: 2,
      flags: ['correctOffSolution', 'missingSolutionCells'],
    });
  });

  it('시각 역행과 서버 경과 시간을 2초 넘게 초과한 기록을 표시한다', () => {
    const events: PlayEvent[] = [[800, 'correct', 0, 0], [700, 'correct', 1, 2], [12_001, 'correct', 2, 4]];
    expect(auditPlayLog({ ...base, events })).toMatchObject({
      nonMonotonic: true,
      clientDurationMs: 12_001,
      durationExceedsServer: true,
      minCorrectGapMs: -100,
      flags: ['nonMonotonic', 'durationExceedsServer'],
    });
    const boundary: PlayEvent[] = [[800, 'correct', 0, 0], [900, 'correct', 1, 2], [12_000, 'correct', 2, 4]];
    expect(auditPlayLog({ ...base, events: boundary }).durationExceedsServer).toBe(false);
  });

  it('정답 착수가 둘 미만이면 최소 간격이 없다', () => {
    expect(auditPlayLog({ ...base, outcome: 'fail', claimedSeedLeft: null, events: [[10, 'correct', 0, 0]] }).minCorrectGapMs).toBeNull();
  });

  it('실패 보고는 신고 씨앗과 누락 정답 칸을 판정하지 않는다', () => {
    const events: PlayEvent[] = [[300, 'wrong', 0, 1], [600, 'wrong', 0, 2], [900, 'wrong', 0, 3]];
    expect(auditPlayLog({ ...base, outcome: 'fail', claimedSeedLeft: null, events })).toEqual({
      version: 1,
      wrongCount: 3,
      derivedSeedLeft: 0,
      seedMismatch: null,
      correctOffSolution: 0,
      missingSolutionCells: null,
      nonMonotonic: false,
      clientDurationMs: 900,
      durationExceedsServer: false,
      minCorrectGapMs: null,
      flags: [],
    });
  });

  it('빈 기록의 클라이언트 경과 시간은 0이다', () => {
    expect(auditPlayLog({ ...base, outcome: 'fail', claimedSeedLeft: null, events: [] }).clientDurationMs).toBe(0);
  });

  it('기록이 없으면 no_log만 표시하고 지표를 비운다', () => {
    expect(auditPlayLog({ ...base, events: null })).toEqual({
      version: 1,
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
    });
  });
});
