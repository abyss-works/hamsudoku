import { LogIn } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Overlay } from '../../ui/Overlay';

interface GuestEndlessDialogProps {
  onClose: () => void;
  onLogin: () => void;
}

export function GuestEndlessDialog({ onClose, onLogin }: GuestEndlessDialogProps) {
  return (
    <Overlay label="로그인 안내">
      <div className="guest-gate">
        <h2 className="guest-gate-title">무한모드는 로그인 후 즐길 수 있어요</h2>
        <p className="guest-gate-sub">공정한 경쟁을 위해 로그인이 필요해요</p>
        <div className="guest-gate-actions">
          <Button variant="sticker" className="btn-primary guest-gate-fill" onClick={onLogin} aria-label="로그인 안내 로그인">
            <LogIn size={20} aria-hidden="true" />
            로그인
          </Button>
          <Button variant="sticker" className="guest-gate-fill" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
