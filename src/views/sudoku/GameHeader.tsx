import type { ReactNode } from 'react';
import { Button } from '../../ui/Button';

export interface GameHeaderProps {
  title: string;
  onBack: () => void;
  extra?: ReactNode;
}

export function GameHeader({ title, onBack, extra }: GameHeaderProps) {
  return (
    <div className="hud">
      <Button variant="sticker" onClick={onBack}>
        뒤로
      </Button>
      <span className="hud-code">{title}</span>
      {extra ?? <span />}
    </div>
  );
}
