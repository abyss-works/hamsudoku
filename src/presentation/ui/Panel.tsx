import type { ReactNode } from 'react';

interface PanelProps {
  title: string;
  children: ReactNode;
}

export function Panel({ title, children }: PanelProps) {
  return (
    <section className="panel">
      <h3 className="panel-title">{title}</h3>
      {children}
    </section>
  );
}
