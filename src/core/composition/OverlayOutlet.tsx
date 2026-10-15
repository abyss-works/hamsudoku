import type { OverlayRenderer } from '../orchestration/overlayTypes';
import { useOverlay } from '../orchestration/overlayContext';
import { ModalHost } from './ModalHost';

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
    return (
      <ModalHost>
        <div className={className}>{content}</div>
      </ModalHost>
    );
  }

  return <ModalHost>{content}</ModalHost>;
}
