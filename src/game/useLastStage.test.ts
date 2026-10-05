// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useLastStage } from './useLastStage';
import { saveLastStageId } from './progress';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('useLastStage', () => {
  it('저장된 id를 읽고 저장하면 갱신된다', () => {
    saveLastStageId('lv2-s1');
    const { result } = renderHook(() => useLastStage());
    expect(result.current[0]).toBe('lv2-s1');
    act(() => {
      result.current[1]('lv3-s1');
    });
    expect(result.current[0]).toBe('lv3-s1');
    expect(localStorage.getItem('hamsudoku:last-stage')).toBe('lv3-s1');
  });
  it('없으면 null이다', () => {
    const { result } = renderHook(() => useLastStage());
    expect(result.current[0]).toBeNull();
  });
});
