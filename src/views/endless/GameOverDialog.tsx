import { Button } from '../../ui/Button';
import { Overlay } from '../../ui/Overlay';

export interface GameOverDialogProps {
  error: string | null;
  onRetry: () => void;
  onExit: () => void;
}

export function GameOverDialog({ error, onRetry, onExit }: GameOverDialogProps) {
  return (
    <Overlay label="게임오버">
      <p className="clear-title">씨앗을 다 썼어요…</p>
      {error && <p className="home-note">{error}</p>}
      <div className="clear-actions">
        <Button variant="sticker" className="btn-primary" onClick={onRetry}>
          재도전
        </Button>
        <Button variant="sticker" onClick={onExit}>
          나가기
        </Button>
      </div>
    </Overlay>
  );
}
