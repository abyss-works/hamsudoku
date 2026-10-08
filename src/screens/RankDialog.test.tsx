// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RankDialog } from './RankDialog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeAll(() => {
  vi.useFakeTimers({ now: new Date('2026-10-07T00:00:30.000Z') });
});

afterAll(() => {
  vi.useRealTimers();
});

const rank = {
  season: '2026-W41',
  top: [
    { userId: 'u1', nickname: '햄찌', score: 9 },
    { userId: 'u2', nickname: null, score: 6 },
  ],
  snapshotAt: '2026-10-07T00:00:00.000Z',
  me: { rank: 2, score: 6 },
};

describe('RankDialog', () => {
  it('상위 목록과 내 순위를 보여준다', () => {
    render(<RankDialog rank={rank} uid="u2" signedIn onClose={() => {}} />);
    expect(screen.getByText('햄찌')).toBeTruthy();
    expect(screen.getByText('게스트')).toBeTruthy();
    expect(screen.getByText(/내 순위: 2위/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  });

  it('기록이 없으면 안내를 보여준다', () => {
    render(<RankDialog rank={{ ...rank, top: [], me: { rank: null, score: 0 } }} uid={null} signedIn onClose={() => {}} />);
    expect(screen.getByText('아직 기록이 없어요')).toBeTruthy();
    expect(screen.getByText(/내 순위: 아직 없음/)).toBeTruthy();
  });

  it('내 행은 실시간 점수로 다시 정렬돼 표시된다', () => {
    const r = {
      season: '2026-W41',
      top: [
        { userId: 'u1', nickname: '햄찌', score: 60 },
        { userId: 'u2', nickname: '토끼', score: 51 },
        { userId: 'u3', nickname: '곰', score: 47 },
      ],
      snapshotAt: '2026-10-07T00:00:00.000Z',
      me: { rank: 3, score: 52 },
    };
    render(<RankDialog rank={r} uid="me" signedIn onClose={() => {}} />);
    // 60(1위), 나 52(2위, 실시간), 토끼 51, 곰 47
    const list = document.querySelectorAll('.rank-row');
    expect(list).toHaveLength(4);
    expect(list[1].className).toContain('me');
    expect(list[1].textContent).toContain('52');
    expect(list[2].textContent).toContain('토끼');
    expect(screen.getByText('실시간')).toBeTruthy();
    expect(screen.getByText(/순위표 기준: 30초 전/)).toBeTruthy();
  });
});

describe('RankDialog 게스트 뷰와 스크롤', () => {
  it('게스트는 목록만 보고 내 순위 영역은 숨긴다', () => {
    render(<RankDialog rank={rank} uid={null} signedIn={false} onClose={() => {}} />);
    expect(screen.getByText('햄찌')).toBeTruthy();
    expect(screen.queryByText(/내 순위:/)).toBeNull();
    expect(document.querySelector('.rank-live')).toBeNull();
  });

  it('목록이 5개 넘으면 내부 스크롤 영역으로 감싼다', () => {
    const big = {
      season: '2026-W41',
      top: Array.from({ length: 12 }, (_, i) => ({ userId: `u${i}`, nickname: null, score: 100 - i })),
      snapshotAt: '2026-10-07T00:00:00.000Z',
      me: { rank: null, score: 0 },
    };
    render(<RankDialog rank={big} uid={null} signedIn={false} onClose={() => {}} />);
    const list = document.querySelector('.rank-list');
    expect(list).toBeTruthy();
    expect((list as HTMLElement).className).toContain('rank-scroll');
    expect(document.querySelectorAll('.rank-row').length).toBe(12);
  });
});
