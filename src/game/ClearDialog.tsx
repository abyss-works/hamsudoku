import { PartyPopper } from 'lucide-react';
import { Button } from '../ui/Button';
import { Confetti } from '../ui/Confetti';
import { HamsterFace } from '../ui/HamsterFace';
import { Overlay } from '../ui/Overlay';

interface ClearDialogProps {
  total: number;
  onReset: () => void;
  onNextMap: () => void;
}

export function ClearDialog({ total, onReset, onNextMap }: ClearDialogProps) {
  return (
    <Overlay label="클리어">
      <Confetti />
      <div className="clear-party" aria-hidden="true">
        <HamsterFace />
        <HamsterFace />
        <HamsterFace />
        <HamsterFace />
        <HamsterFace />
      </div>
      <p className="clear-title">
        <PartyPopper size={26} aria-hidden="true" /> 햄스터 {total}마리를 다 찾았다!
      </p>
      <div className="clear-actions">
        <Button variant="sticker" onClick={onReset}>
          다시하기
        </Button>
        <Button variant="sticker" className="btn-primary" onClick={onNextMap}>
          다음 맵
        </Button>
      </div>
    </Overlay>
  );
}
