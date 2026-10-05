import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';

const COLORS = ['#e5484d', '#f5a524', '#46a758', '#3e63dd', '#8e4ec6', '#f76b15'];

export function Confetti({ count = 24 }: { count?: number }) {
  const pieces = Array.from({ length: count }, (_, i) => ({
    x: `${(i * 41) % 100}%`,
    c: COLORS[i % COLORS.length],
    d: 1.6 + ((i * 7) % 10) / 10,
  }));
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <motion.i
          key={i}
          style={{ left: p.x, background: p.c } as CSSProperties}
          initial={{ y: -12, rotate: 0 }}
          animate={{ y: '110vh', rotate: 540 }}
          transition={{ duration: p.d, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  );
}
