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

function Cross({ x, y, red }: { x: number; y: number; red?: boolean }) {
  const c = red ? '#e5484d' : '#4a3128';
  return (
    <g stroke={c} strokeWidth="2" strokeLinecap="round">
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
        <Cross key={`${x},${y}`} x={x} y={y} />
      ))}
      <Ham x={18} y={18} />
    </MiniFrame>
  );
}

function LineFig() {
  return (
    <MiniFrame>
      <rect x="2" y="12" width="32" height="12" rx="3" fill="#e2eefc" stroke="#4a3128" strokeWidth="1.6" />
      <Ham x={12} y={18} />
      <Cross x={24} y={18} />
    </MiniFrame>
  );
}

const RULES = [
  { fig: <IslandFig />, text: '같은 색 칸에는 한 마리만 숨어 있어요' },
  { fig: <TouchFig />, text: '햄스터 주변 여덟 칸에는 친구가 없어요' },
  { fig: <LineFig />, text: '가로 세로 한 줄에 한 마리씩 찾을 수 있어요' },
];

export function RulesHelp() {
  return (
    <div className="rules-row" aria-label="기본 규칙">
      <p className="help-intro">길잡이 몽이가 알려줘요</p>
      {RULES.map((r) => (
        <div key={r.text} className="rule-card">
          {r.fig}
          <p>{r.text}</p>
        </div>
      ))}
    </div>
  );
}
