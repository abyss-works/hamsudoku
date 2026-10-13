import type { ReactNode } from 'react';
import type {
  OverlayActions,
  OverlayCloseOptions as CloseOverlayOptions,
  OverlayRequest as BaseOverlayRequest,
} from '../../shared/overlay';

export type { OverlayCloseOptions as CloseOverlayOptions } from '../../shared/overlay';

export interface OverlayRequest<T = unknown> extends BaseOverlayRequest<T> {
  scopeId?: string;
  scopeToken?: string;
}

export interface OverlayState {
  activeBySlot: Record<string, OverlayRequest | null>;
  activeScopeId: string | null;
  activeScopeToken: string | null;
  expiredScopes: string[];
  expiredTokens: string[];
}

export interface OverlayServiceContract {
  current(slot?: string): OverlayRequest | null;
  isOpen(type?: string, slot?: string): boolean;
  open<T = unknown>(request: OverlayRequest<T>): void;
  close(target?: string | CloseOverlayOptions): void;
  setScope(scopeId: string | null, scopeToken?: string | null): void;
  expireScope(scopeId: string, scopeToken?: string | null): void;
  activeScopeId: string | null;
  activeScopeToken: string | null;
}

export type OverlayRenderer = (overlay: OverlayRequest) => ReactNode;

export interface ScopedOverlayRequest<T = unknown> {
  type: string;
  slot?: string;
  data?: T;
}

export interface ScopedOverlayHandle extends OverlayActions {
  scopeId: string;
  scopeToken: string;
  current(slot?: string): OverlayRequest | null;
}
