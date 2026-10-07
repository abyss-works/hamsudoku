// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RankDialog } from './RankDialog';

afterEach(cleanup);

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
    render(<RankDialog rank={rank} onClose={() => {}} />);
    expect(screen.getByText('햄찌')).toBeTruthy();
    expect(screen.getByText('게스트')).toBeTruthy();
    expect(screen.getByText(/내 순위: 2위/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
  });

  it('기록이 없으면 안내를 보여준다', () => {
    render(<RankDialog rank={{ ...rank, top: [], me: { rank: null, score: 0 } }} onClose={() => {}} />);
    expect(screen.getByText('아직 기록이 없어요')).toBeTruthy();
    expect(screen.getByText(/내 순위: 아직 없음/)).toBeTruthy();
  });
});
