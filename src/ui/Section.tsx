import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section className="panel-section">
      <h4 className="panel-section-title">{title}</h4>
      {children}
    </section>
  );
}
