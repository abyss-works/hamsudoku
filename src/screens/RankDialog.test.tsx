// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RankDialog } from './RankDialog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const rank = {
  season: '2026-W41',
  top: [
    { userId: 'u1', nickname: '햄찌', score: 9 },
    { userId: 'u2', nickname: null, score: 6 },
  ],
  snapshotAt: '2026-10-07T00:00:00.000Z',
  me: { rank: 2, score: 6 },
  frozen: false,
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

  it('내 행은 별도 조회 값으로 다시 정렬돼 표시된다', () => {
    const r = {
      season: '2026-W41',
      top: [
        { userId: 'u1', nickname: '햄찌', score: 60 },
        { userId: 'u2', nickname: '토끼', score: 51 },
        { userId: 'u3', nickname: '곰', score: 47 },
      ],
      snapshotAt: '2026-10-07T00:00:00.000Z',
      me: { rank: 3, score: 47 },
      frozen: false,
    };
    render(<RankDialog rank={r} myRank={{ rank: 2, score: 52, nickname: '나' }} uid="me" signedIn onClose={() => {}} />);
    // 60(1위), 나 52(2위), 토끼 51, 곰 47
    const list = document.querySelectorAll('.rank-row');
    expect(list).toHaveLength(4);
    expect(list[1].className).toContain('me');
    expect(list[1].textContent).toContain('52');
    expect(list[1].textContent).toContain('나');
    expect(list[2].textContent).toContain('토끼');
    expect(screen.getByText(/내 순위: 2위/)).toBeTruthy();
  });

  it('갱신 시각 문구와 실시간 뱃지를 보여주지 않는다', () => {
    render(<RankDialog rank={rank} myRank={{ rank: 2, score: 6, nickname: '햄찌' }} uid="u2" signedIn onClose={() => {}} />);
    expect(screen.queryByText(/순위표 기준/)).toBeNull();
    expect(screen.queryByText(/초 전|분 전/)).toBeNull();
    expect(screen.queryByText('실시간')).toBeNull();
    expect(document.querySelector('.rank-live')).toBeNull();
  });
});

describe('RankDialog 마감 창', () => {
  const frozenRank = {
    ...rank,
    season: '2026-W40',
    frozen: true,
  };

  it('마감 안내를 보여준다', () => {
    render(<RankDialog rank={frozenRank} myRank={{ rank: 2, score: 6, nickname: '햄찌' }} uid="u2" signedIn onClose={() => {}} />);
    expect(screen.getByText(/집계가 마감됐어요/)).toBeTruthy();
    expect(document.querySelector('.rank-live')).toBeNull();
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
      frozen: false,
    };
    render(<RankDialog rank={big} uid={null} signedIn={false} onClose={() => {}} />);
    const list = document.querySelector('.rank-list');
    expect(list).toBeTruthy();
    expect((list as HTMLElement).className).toContain('rank-scroll');
    expect(document.querySelectorAll('.rank-row').length).toBe(12);
  });
});
