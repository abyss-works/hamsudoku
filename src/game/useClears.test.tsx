// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useClears } from './useClears';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('useClears', () => {
  it('record하면 저장되고 best로 읽힌다', () => {
    const { result } = renderHook(() => useClears());
    act(() => {
      result.current.record('1-1', 77);
    });
    expect(result.current.best('1-1')?.elapsedSec).toBe(77);
    expect(result.current.resumeId(['1-1', '1-2'])).toBe('1-2');
  });
});
