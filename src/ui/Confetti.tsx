import type { CSSProperties } from 'react';

const COLORS = ['#e5484d', '#f5a524', '#46a758', '#3e63dd', '#8e4ec6', '#f76b15'];

export function Confetti({ count = 24 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => ({
    x: `${(i * 41) % 100}%`,
    c: COLORS[i % COLORS.length],
    d: `${1.6 + ((i * 7) % 10) / 10}s`,
  }));
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i key={i} style={{ '--x': p.x, '--c': p.c, '--d': p.d } as CSSProperties} />
      ))}
    </div>
  );
}
