import type { OverlayRenderer } from './overlayTypes';
import { useOverlay } from './OverlayProvider';

export interface OverlayOutletProps {
  slot?: string;
  className?: string;
  render?: OverlayRenderer;
  children?: OverlayRenderer;
}

export function OverlayOutlet({ slot = 'default', className, render, children }: OverlayOutletProps) {
  const { current, renderOverlay: contextRenderer } = useOverlay();
  const overlay = current(slot);

  if (!overlay) {
    return null;
  }

  const renderer = render ?? children ?? contextRenderer;
  if (!renderer) {
    return null;
  }

  const content = renderer(overlay);
  if (!content) {
    return null;
  }

  if (className) {
    return <div className={className}>{content}</div>;
  }

  return <>{content}</>;
}
