// @vitest-environment jsdom
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useEffect, useState, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { OverlayProvider } from '../composition/OverlayProvider';
import { useOverlay } from './overlayContext';
import { useOverlayScope } from './useOverlayScope';

const wrapper = ({ children }: { children: ReactNode }) => <OverlayProvider>{children}</OverlayProvider>;

describe('useOverlayScope 토큰', () => {
  it('같은 범위 이름의 두 인스턴스는 서로 다른 토큰을 가진다', () => {
    const a = renderHook(() => useOverlayScope('game'), { wrapper });
    const b = renderHook(() => useOverlayScope('game'), { wrapper });
    expect(a.result.current.scopeToken).not.toBe(b.result.current.scopeToken);
  });
  it('같은 인스턴스는 다시 렌더해도 토큰이 바뀌지 않는다', () => {
    const hook = renderHook(() => useOverlayScope('game'), { wrapper });
    const first = hook.result.current.scopeToken;
    hook.rerender();
    expect(hook.result.current.scopeToken).toBe(first);
  });
});

// 비동기 결과로 범위 이름이 바뀌고, 새 범위의 핸들로 여는 버튼을 같은 커밋에 그린다.
function RoundHarness({ load }: { load: Promise<number> }) {
  const [round, setRound] = useState(0);
  useEffect(() => {
    void load.then(setRound);
  }, [load]);
  const overlay = useOverlayScope(`round-${round}`);
  const { current } = useOverlay();
  return (
    <>
      {round > 0 && (
        <button type="button" onClick={() => overlay.open({ type: 'notice', slot: 'notice' })}>
          열기
        </button>
      )}
      {current('notice') && <p>열림</p>}
    </>
  );
}

// 버튼이 DOM에 반영되는 MutationObserver 마이크로태스크에서 바로 클릭한다.
// React는 커밋 뒤 페인트를 위해 양보한 다음 별도 작업에서 passive effect를 실행하므로,
// 이 시점의 클릭은 실제 입력처럼 커밋과 passive effect 사이에 도착한다.
function clickWhenRendered(name: string): Promise<void> {
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const button = screen.queryByRole('button', { name });
      if (!button) return;
      observer.disconnect();
      fireEvent.click(button);
      resolve();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

describe('useOverlayScope 범위 전환', () => {
  it('새 범위를 그린 커밋 직후의 입력으로 연 오버레이를 유지한다', async () => {
    let resolveRound: (round: number) => void = () => {};
    const load = new Promise<number>((resolve) => {
      resolveRound = resolve;
    });
    render(
      <OverlayProvider>
        <RoundHarness load={load} />
      </OverlayProvider>,
    );

    // act 환경을 끄고 실제 Scheduler 순서대로 커밋과 passive effect를 분리한다.
    const actEnv = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = actEnv.IS_REACT_ACT_ENVIRONMENT;
    actEnv.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      const clicked = clickWhenRendered('열기');
      resolveRound(1);
      await clicked;
    } finally {
      actEnv.IS_REACT_ACT_ENVIRONMENT = previous;
    }

    expect(await screen.findByText('열림')).toBeDefined();
  });
});
