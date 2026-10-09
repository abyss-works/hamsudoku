import type { ReactNode } from 'react';

export function HelpCard({ label, children, cols = 3 }: { label: string; children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={`help-card cols-${cols}`} aria-label={label}>
      {children}
    </div>
  );
}

export function DotMark({ size = 20 }: { size?: number }) {
  return (
    <svg className="mark-glyph mark-dot" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" fill="currentColor" />
    </svg>
  );
}

export function HelpCol({ children }: { children: ReactNode }) {
  return <div className="help-col">{children}</div>;
}
