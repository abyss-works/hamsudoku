// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { isOtherDeployment, useDeploymentUpdate } from './useDeploymentUpdate';

describe('isOtherDeployment', () => {
  it('클라이언트 버전을 알 때 서버 버전이 다르면 다른 배포다', () => {
    expect(isOtherDeployment('0.6.0', '0.6.1')).toBe(true);
    expect(isOtherDeployment('0.6.1', '0.6.1')).toBe(false);
    expect(isOtherDeployment('unknown', '0.6.1')).toBe(false);
    expect(isOtherDeployment(undefined, '0.6.1')).toBe(false);
  });
});

describe('useDeploymentUpdate', () => {
  it('다른 버전의 서버 응답을 받으면 업데이트 안내 상태가 된다', () => {
    let emit: (v: string) => void = () => {};
    const watch = (cb: (v: string) => void) => {
      emit = cb;
      return () => {};
    };
    const { result } = renderHook(() => useDeploymentUpdate('0.6.0', watch));

    expect(result.current.updateAvailable).toBe(false);
    act(() => emit('0.6.0'));
    expect(result.current.updateAvailable).toBe(false);
    act(() => emit('0.6.1'));
    expect(result.current.updateAvailable).toBe(true);
  });
});
