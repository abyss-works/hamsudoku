// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useFontsReady } from './useFontsReady';

const REAL_FONTS = Object.getOwnPropertyDescriptor(document, 'fonts');

function stubFonts(load: (spec: string) => Promise<FontFace[]>) {
  Object.defineProperty(document, 'fonts', { value: { load }, configurable: true });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  if (REAL_FONTS) Object.defineProperty(document, 'fonts', REAL_FONTS);
  else delete (document as { fonts?: unknown }).fonts;
});

describe('useFontsReady', () => {
  it('Font Loading API가 없으면 즉시 준비된다', () => {
    Object.defineProperty(document, 'fonts', { value: undefined, configurable: true });
    const { result } = renderHook(() => useFontsReady(['Jua'], 1500));
    expect(result.current).toBe(true);
  });

  it('요청한 폰트가 올라오면 준비된다', async () => {
    const seen: string[] = [];
    stubFonts(async (spec: string) => {
      seen.push(spec);
      return [];
    });
    const { result } = renderHook(() => useFontsReady(['Jua', 'Noto Sans KR'], 1500));
    await act(async () => {});
    expect(seen).toEqual(['16px "Jua"', '16px "Noto Sans KR"']);
    expect(result.current).toBe(true);
  });

  it('폰트가 안 와도 타임아웃이면 준비된다', () => {
    vi.useFakeTimers();
    stubFonts(() => new Promise<FontFace[]>(() => {}));
    const { result } = renderHook(() => useFontsReady(['Jua'], 1500));
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current).toBe(true);
  });
});
