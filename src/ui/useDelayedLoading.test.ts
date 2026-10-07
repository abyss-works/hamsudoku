// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useDelayedLoading } from './useDelayedLoading';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setup(initialLoading: boolean, thresholdMs = 150, minVisibleMs = 300) {
  vi.useFakeTimers();
  return renderHook(({ loading }: { loading: boolean }) => useDelayedLoading(loading, thresholdMs, minVisibleMs), {
    initialProps: { loading: initialLoading },
  });
}

describe('useDelayedLoading', () => {
  it('threshold 안에 끝나면 뜨지 않는다', () => {
    const { result, rerender } = setup(true);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ loading: false });
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(false);
  });

  it('threshold을 넘기면 뜬다', () => {
    const { result } = setup(true);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(true);
  });

  it('뜬 뒤에는 최소 시간만큼 유지된다', () => {
    const { result, rerender } = setup(true);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(true);
    rerender({ loading: false });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(true);
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(false);
  });

  it('처음부터 꺼져 있으면 뜨지 않는다', () => {
    const { result } = setup(false);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(false);
  });
});
