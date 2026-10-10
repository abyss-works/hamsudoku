// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppNavigation } from './useAppNavigation';
import type { Chapter } from '../features/stages/stagesApi';

const dummyChapters: Chapter[] = [
  {
    id: 'ch1',
    title: '챕터 1',
    stages: [
      { id: 's1', code: '1-1', title: '스테이지 1', locked: false, puzzle: {} as any },
      { id: 's2', code: '1-2', title: '스테이지 2', locked: false, puzzle: {} as any },
    ],
  },
];

describe('애플리케이션 내비게이션 (useAppNavigation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/');
  });

  afterEach(cleanup);

  it('기본 진입 시 홈 화면으로 시작하고 화면 이동 메서드가 동작한다', () => {
    const { result } = renderHook(() => useAppNavigation({ chapters: dummyChapters }));

    expect(result.current.screen).toBe('home');
    expect(result.current.linkError).toBe(false);

    act(() => result.current.browse());
    expect(result.current.screen).toBe('select');

    act(() => result.current.openEndless());
    expect(result.current.screen).toBe('endless');

    act(() => result.current.openLogin());
    expect(result.current.screen).toBe('login');

    act(() => result.current.home());
    expect(result.current.screen).toBe('home');
  });

  it('복구 URL 파라미터가 있으면 recovery 화면으로 시작하고 goHome 시 파라미터를 정리한다', () => {
    window.history.replaceState({}, '', '/?recovery=error');
    const { result } = renderHook(() => useAppNavigation({ chapters: dummyChapters }));

    expect(result.current.screen).toBe('recovery');
    expect(result.current.linkError).toBe(true);

    act(() => result.current.goHome());

    expect(result.current.screen).toBe('home');
    expect(window.location.search).toBe('');
  });

  it('스테이지 진입 시 game 화면과 stageId/chapterId를 설정하고 onEnterStage 콜백을 호출한다', () => {
    const onEnterStage = vi.fn();
    const { result } = renderHook(() =>
      useAppNavigation({ chapters: dummyChapters, onEnterStage })
    );

    const targetStage = dummyChapters[0].stages[0];
    act(() => result.current.enter(targetStage));

    expect(result.current.screen).toBe('game');
    expect(result.current.stage?.id).toBe('s1');
    expect(result.current.chapterId).toBe('ch1');
    expect(onEnterStage).toHaveBeenCalledWith(targetStage);
  });

  it('goNextMap 호출 시 다음 스테이지로 진입하고 마지막 스테이지에서는 home으로 복귀한다', () => {
    const { result } = renderHook(() => useAppNavigation({ chapters: dummyChapters }));

    act(() => result.current.enter(dummyChapters[0].stages[0]));
    expect(result.current.stage?.id).toBe('s1');

    act(() => result.current.goNextMap());
    expect(result.current.stage?.id).toBe('s2');

    act(() => result.current.goNextMap());
    expect(result.current.screen).toBe('home');
  });
});
