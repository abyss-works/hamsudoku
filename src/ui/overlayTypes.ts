import type { ReactNode } from 'react';

export interface OverlayRequest<T = unknown> {
  type: string;
  slot?: string;
  scopeId?: string;
  scopeToken?: string;
  data?: T;
}

export interface OverlayState {
  activeBySlot: Record<string, OverlayRequest | null>;
  activeScopeId: string | null;
  activeScopeToken: string | null;
  expiredScopes: string[];
  expiredTokens: string[];
}

export interface CloseOverlayOptions {
  type?: string;
  slot?: string;
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

export interface ScopedOverlayHandle {
  scopeId: string;
  scopeToken: string;
  open<T = unknown>(request: ScopedOverlayRequest<T>): void;
  close(target?: string | CloseOverlayOptions): void;
  isOpen(type?: string, slot?: string): boolean;
  current(slot?: string): OverlayRequest | null;
}
