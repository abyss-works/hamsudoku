// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { formatElapsed, useElapsed } from './useElapsed';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useElapsed', () => {
  it('active면 1초씩 오른다', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useElapsed(true));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(3);
  });

  it('멈추면 더 안 오른다', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ active }: { active: boolean }) => useElapsed(active), {
      initialProps: { active: true },
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(2);
  });
});

describe('formatElapsed', () => {
  it('m:ss 형식이다', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(7)).toBe('0:07');
    expect(formatElapsed(65)).toBe('1:05');
  });
});
