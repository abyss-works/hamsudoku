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

  it('도움말 섹션마다 한 장에 3열로 합쳐진다', () => {
    const { container } = render(<GameScreen stage={SIX} onBack={vi.fn()} onNextMap={vi.fn()} onRecord={vi.fn()} />);
    expect(container.querySelectorAll('.help-card')).toHaveLength(2);
    const rules = screen.getByLabelText('기본 규칙');
    expect(rules.querySelectorAll('.help-col')).toHaveLength(3);
    const controls = screen.getByLabelText('기본 조작');
    expect(controls.querySelectorAll('.help-col')).toHaveLength(3);
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
