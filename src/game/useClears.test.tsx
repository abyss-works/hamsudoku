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
  it('mergeIn은 서버분을 합치고 로컬분을 지킨다', () => {
    const { result } = renderHook(() => useClears());
    act(() => {
      result.current.record('1-1', 90);
    });
    act(() => {
      result.current.mergeIn([{ stageCode: '1-1', clearedAt: 't9', elapsedSec: 50, attempts: 2 }]);
    });
    expect(result.current.best('1-1')).toMatchObject({ elapsedSec: 50, attempts: 2 });
  });
  it('sound 토글은 저장되고 유지된다', () => {
    const { result } = renderHook(() => useClears());
    expect(result.current.sound).toBe(true);
    act(() => {
      result.current.record('1-1', 90);
      result.current.setSound(false);
    });
    expect(result.current.sound).toBe(false);
    expect(result.current.best('1-1')?.elapsedSec).toBe(90);
  });
  it('replace는 갈아끼우고 reset은 비운다', () => {
    const { result } = renderHook(() => useClears());
    act(() => {
      result.current.record('1-1', 90);
    });
    act(() => {
      result.current.replace([]);
    });
    expect(result.current.best('1-1')).toBeUndefined();
    act(() => {
      result.current.record('1-2', 60);
      result.current.reset();
    });
    expect(result.current.best('1-2')).toBeUndefined();
  });
});
