import { createContext, useContext } from 'react';
import type { OverlayContextValue } from './useOverlayService';

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

export const OverlayContext = createContext<OverlayContextValue>(noopContract);

export function useOverlay(): OverlayContextValue {
  return useContext(OverlayContext);
}
