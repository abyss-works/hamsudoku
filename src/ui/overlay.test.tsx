// @vitest-environment jsdom
import { StrictMode, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { OverlayProvider, useOverlay } from './OverlayProvider';
import { OverlayOutlet } from './OverlayOutlet';
import { useOverlayScope } from './useOverlayScope';
import type { OverlayRequest, ScopedOverlayHandle } from './overlayTypes';

afterEach(() => {
  cleanup();
});

function TestDialogHost({ overlay }: { overlay: OverlayRequest }) {
  if (overlay.type === 'settings') {
    return <div data-testid="settings-dialog">Settings Content</div>;
  }
  if (overlay.type === 'profile') {
    return <div data-testid="profile-dialog">Profile: {(overlay.data as { name: string })?.name}</div>;
  }
  if (overlay.type === 'clear') {
    return <div data-testid="clear-dialog">Stage Cleared!</div>;
  }
  return null;
}

function TestPage() {
  const { open, close, isOpen } = useOverlay();

  return (
    <div className="home">
      <button onClick={() => open({ type: 'settings' })}>Open Settings</button>
      <button onClick={() => open({ type: 'profile', data: { name: 'Hamster' } })}>Open Profile</button>
      <button onClick={() => close('settings')}>Close Settings</button>
      <button onClick={() => close()}>Close Current</button>
      <div data-testid="open-status">{isOpen('settings') ? 'settings-open' : 'closed'}</div>
      <OverlayOutlet render={(ov) => <TestDialogHost overlay={ov} />} />
    </div>
  );
}

describe('OverlayProvider & OverlayOutlet integration', () => {
  it('오버레이를 열고 닫으면 OverlayOutlet에 올바르게 렌더링 및 해제된다', () => {
    render(
      <OverlayProvider>
        <TestPage />
      </OverlayProvider>,
    );

    expect(screen.queryByTestId('settings-dialog')).toBeNull();
    expect(screen.getByTestId('open-status').textContent).toBe('closed');

    // Open settings
    fireEvent.click(screen.getByText('Open Settings'));
    expect(screen.getByTestId('settings-dialog')).toBeDefined();
    expect(screen.getByTestId('open-status').textContent).toBe('settings-open');

    // Close settings
    fireEvent.click(screen.getByText('Close Settings'));
    expect(screen.queryByTestId('settings-dialog')).toBeNull();
    expect(screen.getByTestId('open-status').textContent).toBe('closed');
  });

  it('동일 슬롯의 새 오버레이 요청은 기존 오버레이를 원자적으로 교체한다', () => {
    render(
      <OverlayProvider>
        <TestPage />
      </OverlayProvider>,
    );

    fireEvent.click(screen.getByText('Open Settings'));
    expect(screen.getByTestId('settings-dialog')).toBeDefined();

    fireEvent.click(screen.getByText('Open Profile'));
    expect(screen.queryByTestId('settings-dialog')).toBeNull();
    expect(screen.getByTestId('profile-dialog').textContent).toBe('Profile: Hamster');
  });

  it('다양한 DOM 슬롯(예: default와 board)의 오버레이가 독립적으로 렌더링된다', () => {
    function MultiSlotComponent() {
      const { open } = useOverlay();
      return (
        <div>
          <button onClick={() => open({ type: 'settings', slot: 'default' })}>Open Default</button>
          <button onClick={() => open({ type: 'clear', slot: 'board' })}>Open Board</button>
          <div className="home-outlet">
            <OverlayOutlet slot="default" render={(ov) => <TestDialogHost overlay={ov} />} />
          </div>
          <div className="board-outlet">
            <OverlayOutlet slot="board" render={(ov) => <TestDialogHost overlay={ov} />} />
          </div>
        </div>
      );
    }

    render(
      <OverlayProvider>
        <MultiSlotComponent />
      </OverlayProvider>,
    );

    fireEvent.click(screen.getByText('Open Default'));
    fireEvent.click(screen.getByText('Open Board'));

    expect(screen.getByTestId('settings-dialog')).toBeDefined();
    expect(screen.getByTestId('clear-dialog')).toBeDefined();
  });

  it('Provider 외부에서 호출해도 fallback으로 안전하게 no-op 동작한다', () => {
    function Standalone() {
      const { isOpen, current, open, close } = useOverlay();
      return (
        <div>
          <span data-testid="is-open">{String(isOpen())}</span>
          <span data-testid="current">{String(current())}</span>
          <button onClick={() => open({ type: 'foo' })}>Open</button>
          <button onClick={() => close()}>Close</button>
        </div>
      );
    }

    render(<Standalone />);
    expect(screen.getByTestId('is-open').textContent).toBe('false');
    expect(screen.getByTestId('current').textContent).toBe('null');
  });
});

describe('Overlay scope and lifecycle (StrictMode & stale callbacks)', () => {
  function ScopedView({
    scopeId,
    onDelayedCallbackReady,
  }: {
    scopeId: string;
    onDelayedCallbackReady?: (cb: () => void) => void;
  }) {
    const { scopeToken } = useOverlayScope(scopeId);
    const { open, close } = useOverlay();

    return (
      <div className={`scoped-${scopeId}`}>
        <button onClick={() => open({ type: 'settings', scopeId, scopeToken })}>Open Settings</button>
        <button onClick={() => close('settings')}>Close Settings</button>
        <button
          onClick={() => {
            onDelayedCallbackReady?.(() => {
              open({ type: 'clear', scopeId, scopeToken });
            });
          }}
        >
          Prepare Stale Callback
        </button>
        <OverlayOutlet render={(ov) => <TestDialogHost overlay={ov} />} />
      </div>
    );
  }

  it('정상 scoped overlay는 부모 컴포넌트의 무관한 리렌더에도 닫히지 않고 유지된다', () => {
    function Parent() {
      const [count, setCount] = useState(0);
      return (
        <OverlayProvider>
          <button onClick={() => setCount((c) => c + 1)}>Rerender Parent ({count})</button>
          <ScopedView scopeId="stage-1" />
        </OverlayProvider>
      );
    }

    render(<Parent />);
    fireEvent.click(screen.getByText('Open Settings'));
    expect(screen.getByTestId('settings-dialog')).toBeDefined();

    // 부모 리렌더링
    fireEvent.click(screen.getByText(/Rerender Parent/));
    // 정상 오버레이가 닫히지 않고 계속 화면에 남아 있어야 한다
    expect(screen.getByTestId('settings-dialog')).toBeDefined();
  });

  it('ScopedView unmount 뒤 보관된 이전 open 콜백을 실행해도 오버레이가 표시되지 않는다', () => {
    let staleCb: (() => void) | null = null;
    function Parent() {
      const [show, setShow] = useState(true);
      return (
        <OverlayProvider>
          <button onClick={() => setShow(false)}>Unmount ScopedView</button>
          {show && <ScopedView scopeId="stage-1" onDelayedCallbackReady={(cb) => { staleCb = cb; }} />}
          <OverlayOutlet render={(ov) => <TestDialogHost overlay={ov} />} />
        </OverlayProvider>
      );
    }

    render(<Parent />);
    fireEvent.click(screen.getByText('Prepare Stale Callback'));
    expect(staleCb).toBeDefined();

    // ScopedView unmount
    fireEvent.click(screen.getByText('Unmount ScopedView'));

    // 언마운트 후 이전 콜백 실행
    act(() => {
      staleCb?.();
    });

    expect(screen.queryByTestId('clear-dialog')).toBeNull();
  });

  it('스코프 전환 뒤 이전 스코프에서 온 지연 콜백 요청은 무시된다', () => {
    let staleCallback: (() => void) | null = null;

    function Parent() {
      const [scope, setScope] = useState('stage-1');
      return (
        <OverlayProvider>
          <button onClick={() => setScope('stage-2')}>Switch to Stage 2</button>
          <ScopedView scopeId={scope} onDelayedCallbackReady={(cb) => { staleCallback = cb; }} />
        </OverlayProvider>
      );
    }

    render(<Parent />);

    // Stage 1 콜백 준비
    fireEvent.click(screen.getByText('Prepare Stale Callback'));
    expect(staleCallback).toBeDefined();

    // Stage 2로 전환
    fireEvent.click(screen.getByText('Switch to Stage 2'));

    // 전환 후 Stage 1 시절의 비동기 완료 콜백 실행
    act(() => {
      staleCallback?.();
    });

    // 만료된 스코프의 요청이므로 clear-dialog가 화면에 뜨지 않아야 한다
    expect(screen.queryByTestId('clear-dialog')).toBeNull();
  });

  it('React StrictMode 환경에서 useOverlayScope를 실제 사용하는 컴포넌트가 setup/cleanup/setup 후에도 정상 동작한다', () => {
    render(
      <StrictMode>
        <OverlayProvider>
          <ScopedView scopeId="stage-strict" />
        </OverlayProvider>
      </StrictMode>,
    );

    // StrictMode 하에서 ScopedView 오버레이 열기
    fireEvent.click(screen.getByText('Open Settings'));
    expect(screen.getByTestId('settings-dialog')).toBeDefined();

    // 닫기
    fireEvent.click(screen.getByText('Close Settings'));
    expect(screen.queryByTestId('settings-dialog')).toBeNull();
  });

  it('동일한 scopeId 이름이 재사용될 때 이전 마운트 세션의 콜백은 무시되고 새 마운트 세션은 정상 작동한다', () => {
    let session1Cb: (() => void) | null = null;
    function Parent() {
      const [step, setStep] = useState(1);
      return (
        <OverlayProvider>
          <button onClick={() => setStep(2)}>Go Other</button>
          <button onClick={() => setStep(3)}>Re-enter Same</button>
          {step === 1 && <ScopedView scopeId="stage-1" onDelayedCallbackReady={(cb) => { session1Cb = cb; }} />}
          {step === 2 && <div>Other Screen</div>}
          {step === 3 && <ScopedView scopeId="stage-1" />}
        </OverlayProvider>
      );
    }

    render(<Parent />);
    fireEvent.click(screen.getByText('Prepare Stale Callback')); // session 1 콜백 보관
    expect(session1Cb).toBeDefined();

    fireEvent.click(screen.getByText('Go Other')); // step 2
    fireEvent.click(screen.getByText('Re-enter Same')); // step 3 (새로운 stage-1 세션)

    // 이전 세션 1 콜백 실행 -> 차단되어야 함
    act(() => {
      session1Cb?.();
    });
    expect(screen.queryByTestId('clear-dialog')).toBeNull();

    // 새 세션에서 열기 -> 정상 동작해야 함!
    fireEvent.click(screen.getByText('Open Settings'));
    expect(screen.getByTestId('settings-dialog')).toBeDefined();
  });

  it('useOverlayScope의 scoped handle은 scopeId/scopeToken을 자동 바인딩하며 종료 후 open과 close가 상태를 변경하지 못한다', () => {
    let savedHandle: ScopedOverlayHandle | undefined;

    function ScopedHandleComponent({ onReady }: { onReady: (handle: ReturnType<typeof useOverlayScope>) => void }) {
      const handle = useOverlayScope('test-scope');
      return (
        <div>
          <button onClick={() => onReady(handle)}>Capture Handle</button>
          <button onClick={() => handle.open({ type: 'settings' })}>Open Bound Settings</button>
        </div>
      );
    }

    function Container() {
      const [mounted, setMounted] = useState(true);
      const { open } = useOverlay();
      return (
        <div>
          <button onClick={() => setMounted(false)}>Unmount Scope</button>
          <button onClick={() => open({ type: 'profile', data: { name: 'ActiveProfile' } })}>Open Active Profile</button>
          {mounted && <ScopedHandleComponent onReady={(h) => { savedHandle = h; }} />}
          <OverlayOutlet render={(ov) => <TestDialogHost overlay={ov} />} />
        </div>
      );
    }

    render(
      <OverlayProvider>
        <Container />
      </OverlayProvider>,
    );

    // 1. 핸들 캡처 및 자동 바인딩된 open 확인
    fireEvent.click(screen.getByText('Capture Handle'));
    expect(savedHandle).toBeDefined();
    expect(savedHandle?.scopeId).toBe('test-scope');
    expect(savedHandle?.scopeToken).toBeDefined();

    fireEvent.click(screen.getByText('Open Bound Settings'));
    expect(screen.getByTestId('settings-dialog')).toBeDefined();

    // 2. 스코프 언마운트
    fireEvent.click(screen.getByText('Unmount Scope'));
    // 스코프 만료로 settings-dialog는 닫힘
    expect(screen.queryByTestId('settings-dialog')).toBeNull();

    // 3. 만료된 핸들의 open() 호출 -> 상태가 변경되지 않고 다이얼로그가 열리지 않아야 한다
    act(() => {
      savedHandle?.open({ type: 'settings' });
    });
    expect(screen.queryByTestId('settings-dialog')).toBeNull();

    // 4. 새 활성 오버레이(Active Profile) 열기
    fireEvent.click(screen.getByText('Open Active Profile'));
    expect(screen.getByTestId('profile-dialog')).toBeDefined();

    // 5. 만료된 이전 핸들의 close() 호출 -> 새 활성 오버레이를 닫지 못해야 한다!
    act(() => {
      savedHandle?.close();
    });
    expect(screen.getByTestId('profile-dialog')).toBeDefined();
  });
});
