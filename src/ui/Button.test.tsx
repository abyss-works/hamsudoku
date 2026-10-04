// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('자식과 클래스를 렌더하고 클릭을 전달한다', () => {
    const onClick = vi.fn();
    render(
      <Button className="cell" data-island={1} onClick={onClick}>
        🌻
      </Button>,
    );
    const btn = screen.getByRole('button', { name: '🌻' });
    expect(btn.className).toContain('cell');
    expect(btn.getAttribute('data-island')).toBe('1');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
