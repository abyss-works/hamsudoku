import { describe, expect, it } from 'vitest';
import { assessSubmission, clearRejection, solutionMatches } from './rules';

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
