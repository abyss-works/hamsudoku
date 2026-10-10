// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useClears } from '../features/stages/useClears';
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); });
it('StrictMode 설정 액션은 저장을 한 번만 실행한다', () => {
  const { result } = renderHook(useClears, { wrapper: StrictMode });
  const spy = vi.spyOn(Storage.prototype, 'setItem');
  act(() => result.current.setSound(false));
  expect(spy).toHaveBeenCalledTimes(1);
});
