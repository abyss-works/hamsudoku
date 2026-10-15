export interface OverlayRequest<T = unknown> {
  type: string;
  slot?: string;
  data?: T;
}

export interface OverlayCloseOptions {
  type?: string;
  slot?: string;
}

export interface OverlayActions {
  isOpen(type?: string, slot?: string): boolean;
  open<T = unknown>(request: OverlayRequest<T>): void;
  close(target?: string | OverlayCloseOptions): void;
}
