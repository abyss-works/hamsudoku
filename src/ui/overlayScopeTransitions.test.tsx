// @vitest-environment jsdom
import { startTransition, Suspense, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { OverlayProvider } from './OverlayProvider';
import { OverlayOutlet } from './OverlayOutlet';
import { useOverlayScope } from './useOverlayScope';
import type { ScopedOverlayHandle } from './overlayTypes';

describe('오버레이 범위 전환의 이전 액션 격리', () => {
  afterEach(cleanup);
  function fixture() {
    let handle: ScopedOverlayHandle;
    function ScopedContent({ scope }: { scope: string }) {
      handle = useOverlayScope(scope);
      return <OverlayOutlet render={(request) => <div role="status">{request.type}</div>} />;
    }
    function Harness() {
      const [scope, setScope] = useState('home');
      return (
        <OverlayProvider>
          <button onClick={() => setScope('game')}>게임 범위</button>
          <button onClick={() => setScope('home')}>홈 범위</button>
          <ScopedContent scope={scope} />
        </OverlayProvider>
      );
    }
    render(<Harness />);
    return () => handle!;
  }

  it('이전 범위의 닫기 액션은 현재 범위의 오버레이를 닫지 않는다', () => {
    const current = fixture();
    const previousClose = current().close;
    fireEvent.click(screen.getByText('게임 범위'));
    act(() => current().open({ type: 'current' }));
    expect(screen.getByRole('status').textContent).toBe('current');
    act(() => previousClose());
    expect(screen.getByRole('status').textContent).toBe('current');
  });

  it('같은 범위 이름으로 돌아와도 이전 인스턴스의 열기 액션은 재활성화되지 않는다', () => {
    const current = fixture();
    const previousOpen = current().open;
    fireEvent.click(screen.getByText('게임 범위'));
    fireEvent.click(screen.getByText('홈 범위'));
    act(() => previousOpen({ type: 'stale' }));
    expect(screen.queryByRole('status')).toBeNull();
    act(() => current().open({ type: 'new' }));
    expect(screen.getByRole('status').textContent).toBe('new');
  });

  it('새 범위 렌더가 보류되면 현재 화면의 액션은 계속 유효하다', async () => {
    const pending = new Promise<void>(() => {});
    let committed: ScopedOverlayHandle;
    function Content({ scope }: { scope: string }) {
      const handle = useOverlayScope(scope);
      if (scope === 'game') throw pending;
      committed = handle;
      return <OverlayOutlet render={(request) => <div role="status">{request.type}</div>} />;
    }
    function Harness() {
      const [scope, setScope] = useState('home');
      return (
        <OverlayProvider>
          <button onClick={() => startTransition(() => setScope('game'))}>전환 시작</button>
          <Suspense fallback={<div>전환 대기</div>}>
            <Content scope={scope} />
          </Suspense>
        </OverlayProvider>
      );
    }
    render(<Harness />);
    const previousOpen = committed!.open;
    await act(async () => fireEvent.click(screen.getByText('전환 시작')));
    act(() => previousOpen({ type: 'committed-home' }));
    expect(screen.getByRole('status').textContent).toBe('committed-home');
  });
});
