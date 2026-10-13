import type { ReactNode } from 'react';

export function Overlay({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="clear-overlay" role="dialog" aria-label={label}>
      {children}
    </div>
  );
}
