// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppBoot } from './useAppBoot';
import { BOOT_TIMEOUT_MS } from './appLogic';

const mockDismissStaticSplash = vi.fn();
vi.mock('./appBrowser', () => ({
  dismissStaticSplash: () => mockDismissStaticSplash(),
}));

let mockFontsReady = true;
vi.mock('../ui/useFontsReady', () => ({
  useFontsReady: () => mockFontsReady,
}));

describe('애플리케이션 부팅 수명 (useAppBoot)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFontsReady = true;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('폰트 및 초기 데이터 준비 시 ready가 true가 되고 dismissStaticSplash가 호출된다', () => {
    const { result } = renderHook(() =>
      useAppBoot({
        accountLoading: false,
        stagesLoading: false,
        cloud: true,
        hasSummary: true,
      })
    );

    expect(result.current.ready).toBe(true);
    expect(mockDismissStaticSplash).toHaveBeenCalled();
  });

  it('부팅 완료 후 summary 재요청(hasSummary: false)이 발생해도 ready 상태를 유지한다', () => {
    let hasSummary = true;
    const { result, rerender } = renderHook(() =>
      useAppBoot({
        accountLoading: false,
        stagesLoading: false,
        cloud: true,
        hasSummary,
      })
    );

    expect(result.current.ready).toBe(true);

    hasSummary = false;
    rerender();

    expect(result.current.ready).toBe(true);
  });

  it('로딩 중이라도 타임아웃 경과 시 ready가 true가 된다', () => {
    const { result } = renderHook(() =>
      useAppBoot({
        accountLoading: true,
        stagesLoading: true,
        cloud: true,
        hasSummary: false,
      })
    );

    expect(result.current.ready).toBe(false);

    act(() => {
      vi.advanceTimersByTime(BOOT_TIMEOUT_MS);
    });

    expect(result.current.ready).toBe(true);
    expect(mockDismissStaticSplash).toHaveBeenCalled();
  });
});
