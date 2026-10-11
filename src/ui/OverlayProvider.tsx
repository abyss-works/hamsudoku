import { createContext, useContext, type ReactNode } from 'react';
import type { OverlayRenderer } from './overlayTypes';
import { useOverlayService, type OverlayContextValue } from './useOverlayService';

export type { OverlayContextValue };

const noopContract: OverlayContextValue = {
  current: () => null,
  isOpen: () => false,
  open: () => {},
  close: () => {},
  setScope: () => {},
  expireScope: () => {},
  activeScopeId: null,
  activeScopeToken: null,
};

const OverlayContext = createContext<OverlayContextValue>(noopContract);

export function useOverlay(): OverlayContextValue {
  return useContext(OverlayContext);
}

export interface OverlayProviderProps {
  children: ReactNode;
  initialScopeId?: string;
  renderOverlay?: OverlayRenderer;
}

export function OverlayProvider({ children, initialScopeId, renderOverlay }: OverlayProviderProps) {
  const value = useOverlayService({ defaultScopeId: initialScopeId, renderOverlay });
  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}
