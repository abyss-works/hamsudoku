// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MarkerControls } from './MarkerControls';

afterEach(cleanup);

describe('MarkerControls', () => {
  it('선택 안 된 펜을 누르면 그 색으로 바뀐다', () => {
    const onSelectPen = vi.fn();
    const onClearColor = vi.fn();
    render(<MarkerControls pen="mark" onSelectPen={onSelectPen} onClearColor={onClearColor} />);
    fireEvent.click(screen.getByRole('button', { name: '가설 펜으로 바꾸기' }));
    expect(onSelectPen).toHaveBeenCalledWith('hypo');
    expect(onClearColor).not.toHaveBeenCalled();
  });

  it('선택된 펜을 누르면 그 색만 지우고 선택은 유지한다', () => {
    const onSelectPen = vi.fn();
    const onClearColor = vi.fn();
    render(<MarkerControls pen="hypo" onSelectPen={onSelectPen} onClearColor={onClearColor} />);
    fireEvent.click(screen.getByRole('button', { name: '가설만 지우기' }));
    expect(onClearColor).toHaveBeenCalledWith('hypo');
    expect(onSelectPen).not.toHaveBeenCalled();
  });

  it('선택된 펜은 리셋 아이콘으로, 나머지는 연필로 보인다', () => {
    const { container } = render(<MarkerControls pen="mark" onSelectPen={vi.fn()} onClearColor={vi.fn()} />);
    const selected = screen.getByRole('button', { name: '의심만 지우기' });
    const idle = screen.getByRole('button', { name: '가설 펜으로 바꾸기' });
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(idle.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelectorAll('.pen-btn.selected')).toHaveLength(1);
  });
});
