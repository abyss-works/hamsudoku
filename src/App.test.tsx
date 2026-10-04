// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';

afterEach(cleanup);

describe('클리어', () => {
  it('정답 배치로 클리어 오버레이가 뜬다 (맵 1)', () => {
    const { container } = render(<App />);
    const cells = () => Array.from(container.querySelectorAll('.board .cell'));
    [0, 8, 11, 19, 22].forEach((i) => fireEvent.click(cells()[i]));
    expect(screen.getByRole('dialog', { name: '클리어' })).toBeTruthy();
  });

  it('정답 배치로 클리어 오버레이가 뜬다 (맵 2)', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '해바라기 밭' }));
    const cells = () => Array.from(container.querySelectorAll('.board .cell'));
    [2, 5, 14, 16, 23].forEach((i) => fireEvent.click(cells()[i]));
    expect(screen.getByRole('dialog', { name: '클리어' })).toBeTruthy();
  });
});

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
