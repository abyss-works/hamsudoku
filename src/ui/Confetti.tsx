import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { useConfettiService } from './useConfettiService';

export function Confetti({ count = 24 }: { count?: number }) {
  const pieces = useConfettiService(count);

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <motion.i
          key={p.id}
          style={{ left: p.x, background: p.color } as CSSProperties}
          initial={{ y: -12, rotate: 0 }}
          animate={{ y: '110vh', rotate: 540 }}
          transition={{ duration: p.duration, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  );
}
