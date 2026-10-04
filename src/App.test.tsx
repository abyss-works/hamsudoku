// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';

describe('맵 전환', () => {
  it('맵을 바꾸면 빈판으로 시작한다', () => {
    render(<App />);
    const cells = screen.getAllByRole('button', { name: /빈칸/ });
    expect(cells).toHaveLength(25);

    fireEvent.click(cells[0]);
    const line = () => screen.getByText((_, el) => el?.className === 'map-line');
    expect(line().textContent).toBe('햄스터 마을 입구 · 햄스터 1/5');

    fireEvent.click(screen.getByRole('button', { name: '해바라기 밭' }));
    expect(line().textContent).toBe('해바라기 밭 · 햄스터 0/5');
    expect(screen.getAllByRole('button', { name: /빈칸/ })).toHaveLength(25);
  });
});
