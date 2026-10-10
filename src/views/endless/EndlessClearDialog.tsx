import { Button } from '../../ui/Button';
import { Confetti } from '../../ui/Confetti';
import { Overlay } from '../../ui/Overlay';
import type { EndlessClearModel } from '../../features/endless/screenModels';

export interface EndlessClearDialogProps {
  model: EndlessClearModel;
  onNext: () => void;
  onExit: () => void;
}

export function EndlessClearDialog({
  model,
  onNext,
  onExit,
}: EndlessClearDialogProps) {
  return (
    <Overlay label="클리어">
      {model.showConfetti && <Confetti />}
      <p className="clear-title">{model.title}</p>
      {model.note && <p className="home-note">{model.note}</p>}
      <div className="clear-actions">
        <Button variant="sticker" className="btn-primary" onClick={onNext} disabled={model.actionsDisabled}>
          다음 판
        </Button>
        <Button variant="sticker" onClick={onExit} disabled={model.actionsDisabled}>
          나가기
        </Button>
      </div>
    </Overlay>
  );
}
