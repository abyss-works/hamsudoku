// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      vi.advanceTimersByTime(150);
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

  it('터치는 130ms 뒤에 전달된다', () => {
    vi.useFakeTimers();
    const onTap = vi.fn();
    render(<Cell row={0} col={0} state="empty" islandId={0} conflicted={false} onTap={onTap} onPress={() => {}} />);
    const btn = screen.getByRole('button', { name: /빈칸/ });
    fireEvent.pointerDown(btn, { pointerType: 'touch' });
    fireEvent.click(btn);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onTap).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(onTap).toHaveBeenCalledWith('single');
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

const noop = () => {};

function renderCell(state: 'empty' | 'mark' | 'hypo') {
  return render(
    <Cell row={0} col={0} state={state} islandId={0} conflicted={false} onTap={noop} onPress={noop} />,
  );
}

describe('Cell 마크 애니메이션', () => {
  it('마크가 사라질 때 체크가 바로 제거되지 않고 퇴장 애니메이션을 거친다', async () => {
    const { container, rerender } = renderCell('mark');
    expect(container.querySelector('.mark-glyph')).not.toBeNull();
    rerender(
      <Cell row={0} col={0} state="empty" islandId={0} conflicted={false} onTap={noop} onPress={noop} />,
    );
    // 상태가 empty 로 바뀐 직후에도 체크는 퇴장 중이라 아직 DOM 에 있다
    expect(container.querySelector('.mark-glyph')).not.toBeNull();
    await waitFor(() => expect(container.querySelector('.mark-glyph')).toBeNull(), { timeout: 2000 });
  });
});

describe('Cell 마커 모양', () => {
  it('의심은 채워진 원, 가설은 물음표로 그린다', async () => {
    const { container, rerender } = renderCell('mark');
    expect(container.querySelector('.mark-dot')).not.toBeNull();
    expect(container.querySelector('.mark-check')).toBeNull();
    expect(container.querySelector('.mark-unknown')).toBeNull();
    rerender(
      <Cell row={0} col={0} state="hypo" islandId={0} conflicted={false} onTap={noop} onPress={noop} />,
    );
    const unknown = container.querySelector('.mark-unknown');
    expect(unknown).not.toBeNull();
    expect(unknown?.textContent).toBe('?');
    // 이전 원은 퇴장 애니메이션 뒤에 사라진다
    await waitFor(() => expect(container.querySelector('.mark-dot')).toBeNull(), { timeout: 2000 });
  });

  it('상태를 접근성 라벨로 구분한다', () => {
    renderCell('mark');
    expect(screen.getByRole('button', { name: /의심 표시/ })).toBeTruthy();
    cleanup();
    renderCell('hypo');
    expect(screen.getByRole('button', { name: /가설 표시/ })).toBeTruthy();
  });
});
