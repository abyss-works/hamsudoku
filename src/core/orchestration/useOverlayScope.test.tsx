// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { OverlayProvider } from '../composition/OverlayProvider';
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
