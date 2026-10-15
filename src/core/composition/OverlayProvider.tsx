import type { ReactNode } from 'react';
import type { OverlayRenderer } from '../orchestration/overlayTypes';
import { OverlayContext } from '../orchestration/overlayContext';
import { useOverlayService, type OverlayContextValue } from '../orchestration/useOverlayService';

export type { OverlayContextValue };
export { useOverlay } from '../orchestration/overlayContext';

export interface OverlayProviderProps {
  children: ReactNode;
  initialScopeId?: string;
  renderOverlay?: OverlayRenderer;
}

export function OverlayProvider({ children, initialScopeId, renderOverlay }: OverlayProviderProps) {
  const value = useOverlayService({ defaultScopeId: initialScopeId, renderOverlay });
  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}
