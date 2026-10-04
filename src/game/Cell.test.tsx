// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Cell } from './Cell';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Cell', () => {
  it('싱글클릭은 대기 뒤에 전달된다', () => {
    vi.useFakeTimers();
    const onTap = vi.fn();
    render(<Cell row={0} col={0} state="empty" islandId={0} conflicted={false} onTap={onTap} onPress={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /빈칸/ }));
    expect(onTap).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(180);
    });
    expect(onTap).toHaveBeenCalledWith('single');
  });

  it('더블클릭은 싱글을 취소하고 더블만 전달한다', () => {
    vi.useFakeTimers();
    const onTap = vi.fn();
    render(<Cell row={0} col={0} state="empty" islandId={0} conflicted={false} onTap={onTap} onPress={() => {}} />);
    const btn = screen.getByRole('button', { name: /빈칸/ });
    fireEvent.click(btn);
    fireEvent.doubleClick(btn);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith('double');
  });

  it('빠른 두 클릭은 dblclick 없이 더블로 확정된다', () => {
    vi.useFakeTimers();
    const onTap = vi.fn();
    render(<Cell row={0} col={0} state="empty" islandId={0} conflicted={false} onTap={onTap} onPress={() => {}} />);
    const btn = screen.getByRole('button', { name: /빈칸/ });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onTap).toHaveBeenCalledWith('double');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
