import type { ReactNode } from 'react';

function MiniFrame({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 36 36" className="mini-fig" aria-hidden="true">
      {children}
    </svg>
  );
}

function Ham({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r="4.5" fill="#e8823c" stroke="#4a3128" strokeWidth="1.6" />;
}

function CrossMark({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="#7a5c4d" strokeWidth="2" strokeLinecap="round">
      <line x1={x - 3} y1={y - 3} x2={x + 3} y2={y + 3} />
      <line x1={x + 3} y1={y - 3} x2={x - 3} y2={y + 3} />
    </g>
  );
}

function IslandFig() {
  return (
    <MiniFrame>
      <rect x="2" y="2" width="32" height="32" rx="4" fill="#fff4d6" stroke="#4a3128" strokeWidth="1.6" />
      <Ham x={18} y={18} />
    </MiniFrame>
  );
}

function TouchFig() {
  const cells: [number, number][] = [];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      if (r !== 1 || c !== 1) cells.push([6 + c * 12, 6 + r * 12]);
    }
  }
  return (
    <MiniFrame>
      {cells.map(([x, y]) => (
        <CrossMark key={`${x},${y}`} x={x} y={y} />
      ))}
      <Ham x={18} y={18} />
    </MiniFrame>
  );
}

function LineFig() {
  return (
    <MiniFrame>
      <rect x="2" y="11" width="32" height="14" rx="5" fill="#e2eefc" stroke="#4a3128" strokeWidth="1.6" />
      <Ham x={8} y={18} />
      <CrossMark x={18} y={18} />
      <CrossMark x={28} y={18} />
    </MiniFrame>
  );
}

import { HelpCol } from '../../../ui/HelpCard';

export const RULES = [
  { fig: <IslandFig />, text: '한 색상에 햄스터 1마리' },
  { fig: <TouchFig />, text: '햄스터 주변은 빈칸' },
  { fig: <LineFig />, text: '한 줄에 햄스터 1마리' },
];

export function RulesPage() {
  return (
    <>
      {RULES.map((r) => (
        <HelpCol key={r.text}>
          <span className="help-icon">{r.fig}</span>
          <p>{r.text}</p>
        </HelpCol>
      ))}
    </>
  );
}
