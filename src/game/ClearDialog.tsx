import { Button } from '../ui/Button';
import { Confetti } from '../ui/Confetti';
import { HamsterFace } from '../ui/HamsterFace';
import { Overlay } from '../ui/Overlay';

interface ClearDialogProps {
  onReset: () => void;
  onNextMap: () => void;
}

export function ClearDialog({ onReset, onNextMap }: ClearDialogProps) {
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
      <p className="clear-title">🎉 햄스터 5마리를 다 찾았다!</p>
      <div className="clear-actions">
        <Button onClick={onReset}>다시하기</Button>
        <Button onClick={onNextMap}>다음 맵</Button>
      </div>
    </Overlay>
  );
}
