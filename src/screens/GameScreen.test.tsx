// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { GameScreen } from './GameScreen';

afterEach(cleanup);

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
    const { container } = render(<GameScreen stage={SIX} onBack={vi.fn()} onNextMap={vi.fn()} />);
    expect(container.querySelectorAll('.dot')).toHaveLength(6);
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('햄스터 0/6');
  });

  it('규칙 3열과 조작 2열 도움말이 보인다', () => {
    const { container } = render(<GameScreen stage={SIX} onBack={vi.fn()} onNextMap={vi.fn()} />);
    expect(container.querySelectorAll('.rule-card')).toHaveLength(3);
    expect(container.querySelectorAll('.control-card')).toHaveLength(2);
    expect(screen.getByText('한 번 톡, 표시 남기기')).toBeTruthy();
  });
});
