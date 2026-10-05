import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';

interface SettingsDialogProps {
  email: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onClose: () => void;
}

export function SettingsDialog({ email, onLogin, onLogout, onClose }: SettingsDialogProps) {
  return (
    <Overlay label="설정">
      <div className="settings">
        <h2 className="settings-title">설정</h2>
        {email ? (
          <div className="setting-row">
            <span>{email}</span>
            <Button onClick={onLogout}>로그아웃</Button>
          </div>
        ) : (
          <Button variant="sticker" onClick={onLogin}>
            로그인
          </Button>
        )}
        <label className="setting-row">
          <span>효과음</span>
          <Button role="switch" aria-checked="false" disabled>
            준비중
          </Button>
        </label>
        <label className="setting-row">
          <span>진동</span>
          <Button role="switch" aria-checked="false" disabled>
            준비중
          </Button>
        </label>
        <Button variant="sticker" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Overlay>
  );
}
