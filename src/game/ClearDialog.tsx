import { motion } from 'framer-motion';
import { PartyPopper } from 'lucide-react';
import { Button } from '../ui/Button';
import { Confetti } from '../ui/Confetti';
import { HamsterFace } from '../ui/HamsterFace';
import { Overlay } from '../ui/Overlay';

interface ClearDialogProps {
  total: number;
  onReset: () => void;
  onNextMap: () => void;
  onBrowse: () => void;
}

export function ClearDialog({ total, onReset, onNextMap, onBrowse }: ClearDialogProps) {
  return (
    <Overlay label="클리어">
      <Confetti />
      <motion.div
        className="clear-party"
        aria-hidden="true"
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            style={{ display: 'inline-flex' }}
            variants={{ hidden: { scale: 0.3 }, show: { scale: [0.3, 1.25, 1], transition: { duration: 0.35, ease: 'easeOut' } } }}
          >
            <HamsterFace />
          </motion.span>
        ))}
      </motion.div>
      <p className="clear-title">
        <PartyPopper size={26} aria-hidden="true" /> 햄스터 {total}마리를 다 찾았다!
      </p>
      <div className="clear-actions">
        <Button variant="sticker" className="btn-primary" onClick={onNextMap}>
          다음 스테이지
        </Button>
        <Button variant="sticker" onClick={onReset}>
          다시하기
        </Button>
        <Button variant="sticker" onClick={onBrowse}>
          스테이지 목록
        </Button>
      </div>
    </Overlay>
  );
}
