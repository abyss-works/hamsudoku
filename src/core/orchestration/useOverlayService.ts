import { useCallback, useMemo, useState } from 'react';
import type { CloseOverlayOptions, OverlayRenderer, OverlayRequest, OverlayServiceContract } from './overlayTypes';
import {
  createInitialOverlayState,
  openOverlay,
  closeOverlay as closeOverlayState,
  setScope as setScopeState,
  expireScope as expireScopeState,
} from './overlayState';

export interface OverlayContextValue extends OverlayServiceContract {
  renderOverlay?: OverlayRenderer;
}

export interface UseOverlayServiceOptions {
  defaultScopeId?: string;
  defaultScopeToken?: string;
  renderOverlay?: OverlayRenderer;
}

export function useOverlayService(options?: UseOverlayServiceOptions): OverlayContextValue {
  const [state, setState] = useState(() =>
    createInitialOverlayState(options?.defaultScopeId, options?.defaultScopeToken),
  );

  const current = useCallback((slot = 'default'): OverlayRequest | null => {
    return state.activeBySlot[slot] ?? null;
  }, [state.activeBySlot]);

  const isOpen = useCallback((type?: string, slot = 'default'): boolean => {
    const cur = state.activeBySlot[slot];
    if (!cur) return false;
    return type ? cur.type === type : true;
  }, [state.activeBySlot]);

  const open = useCallback(<T,>(request: OverlayRequest<T>): void => {
    setState((prev) => openOverlay(prev, request as OverlayRequest));
  }, []);

  const close = useCallback((target?: string | CloseOverlayOptions): void => {
    setState((prev) => closeOverlayState(prev, target));
  }, []);

  const setScope = useCallback((scopeId: string | null, scopeToken?: string | null): void => {
    setState((prev) => setScopeState(prev, scopeId, scopeToken));
  }, []);

  const expireScope = useCallback((scopeId: string, scopeToken?: string | null): void => {
    setState((prev) => expireScopeState(prev, scopeId, scopeToken));
  }, []);

  const renderOverlay = options?.renderOverlay;

  return useMemo(() => ({
    current,
    isOpen,
    open,
    close,
    setScope,
    expireScope,
    activeScopeId: state.activeScopeId,
    activeScopeToken: state.activeScopeToken,
    renderOverlay,
  }), [
    current,
    isOpen,
    open,
    close,
    setScope,
    expireScope,
    state.activeScopeId,
    state.activeScopeToken,
    renderOverlay,
  ]);
}
