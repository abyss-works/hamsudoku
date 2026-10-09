// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MarkerControls } from './MarkerControls';

afterEach(cleanup);

describe('MarkerControls', () => {
  it('선택 안 된 펜을 누르면 그 색으로 바뀐다', () => {
    const onSelectPen = vi.fn();
    const onClearColor = vi.fn();
    const { container } = render(<MarkerControls pen="mark" onSelectPen={onSelectPen} onClearColor={onClearColor} />);
    fireEvent.click(screen.getByRole('button', { name: '가설 펜으로 바꾸기' }));
    expect(onSelectPen).toHaveBeenCalledWith('hypo');
    expect(onClearColor).not.toHaveBeenCalled();
    expect(container.querySelectorAll('button svg')).toHaveLength(1);
  });

  it('선택된 펜을 누르면 그 색만 지우고 선택은 유지한다', () => {
    const onSelectPen = vi.fn();
    const onClearColor = vi.fn();
    render(<MarkerControls pen="hypo" onSelectPen={onSelectPen} onClearColor={onClearColor} />);
    fireEvent.click(screen.getByRole('button', { name: '가설만 지우기' }));
    expect(onClearColor).toHaveBeenCalledWith('hypo');
    expect(onSelectPen).not.toHaveBeenCalled();
  });

  it('버튼에 아이콘 하나만 보이고 글씨는 없다', () => {
    const { container } = render(<MarkerControls pen="mark" onSelectPen={vi.fn()} onClearColor={vi.fn()} />);
    const selected = screen.getByRole('button', { name: '의심만 지우기' });
    const idle = screen.getByRole('button', { name: '가설 펜으로 바꾸기' });
    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(idle.getAttribute('aria-pressed')).toBe('false');
    // 선택된 펜은 리셋, 나머지는 표시 하나씩만 보인다
    expect(selected.querySelector('.lucide-rotate-ccw')).not.toBeNull();
    expect(selected.querySelector('.lucide-pencil')).toBeNull();
    expect(selected.textContent).not.toContain('의심');
    expect(idle.querySelector('.lucide-rotate-ccw')).toBeNull();
    expect(idle.querySelector('.lucide-pencil')).toBeNull();
    expect(idle.textContent).not.toContain('가설');
    expect(container.querySelectorAll('.pen-btn.selected')).toHaveLength(1);
  });
});
