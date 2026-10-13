import type { ReactNode } from 'react';

export function HelpCard({ label, children, cols = 3 }: { label: string; children: ReactNode; cols?: 2 | 3 }) {
  return (
    <div className={`help-card cols-${cols}`} aria-label={label}>
      {children}
    </div>
  );
}

export function HelpCol({ children }: { children: ReactNode }) {
  return <div className="help-col">{children}</div>;
}
