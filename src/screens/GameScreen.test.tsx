// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PUZZLES } from '../game/puzzles';
import { GameScreen } from './GameScreen';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function hudText(container: Element): string {
  return container.querySelector('.hud-code')?.textContent ?? '';
}

const SIX = {
  id: 't',
  code: 'T-1',
  title: '테스트',
  puzzle: {
    name: '6x6',
    size: 6,
    islands: Array.from({ length: 6 }, (_, r) => Array(6).fill(r)),
    solution: [] as [number, number][],
  },
  locked: false,
};

describe('GameScreen', () => {
  it('보드 크기에 맞춰 진행 도트를 찍는다', () => {
    const { container } = render(<GameScreen stage={SIX} onBack={vi.fn()} onNextMap={vi.fn()} onRecord={vi.fn()} />);
    expect(container.querySelectorAll('.dot')).toHaveLength(6);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('햄스터 0/6');
  });

  it('도움말은 한 장씩 좌우로 돌려본다', () => {
    const { container } = render(<GameScreen stage={SIX} onBack={vi.fn()} onNextMap={vi.fn()} onRecord={vi.fn()} />);
    expect(container.querySelectorAll('.help-card')).toHaveLength(1);
    // 조작부의 마커 펜 그룹과 이름이 겹치므로 카드 범위로 좁혀 판정한다
    const card = () => container.querySelector('.help-card') as HTMLElement;
    expect(card().getAttribute('aria-label')).toBe('기본 규칙');
    expect(card().querySelectorAll('.help-col')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(card().getAttribute('aria-label')).toBe('기본 조작');
    expect(card().querySelectorAll('.help-col')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(card().getAttribute('aria-label')).toBe('마커 펜');
    expect(card().querySelectorAll('.help-col')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '다음 도움말' }));
    expect(card().getAttribute('aria-label')).toBe('기본 규칙');
  });

  it('다시하기를 누르면 시간이 0으로 돌아간다', async () => {
    vi.useFakeTimers();
    const puzzle = PUZZLES[0];
    const stage = { id: 'p0', code: '1-1', title: '테스트', puzzle, locked: false };
    const { container } = render(<GameScreen stage={stage} onBack={vi.fn()} onNextMap={vi.fn()} onRecord={vi.fn()} />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(hudText(container)).toBe('1-1 · 0:03');
    const cells = Array.from(container.querySelectorAll('.board .cell'));
    for (const [r, c] of puzzle.solution) fireEvent.dblClick(cells[r * puzzle.size + c]);
    expect(screen.getByRole('dialog', { name: '클리어' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '다시하기' }));
    expect(hudText(container)).toBe('1-1 · 0:00');
  });
});
