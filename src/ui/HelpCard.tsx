import type { ReactNode } from 'react';

export function HelpCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="help-card" aria-label={label}>
      {children}
    </div>
  );
}

export function HelpCol({ children }: { children: ReactNode }) {
  return <div className="help-col">{children}</div>;
}
