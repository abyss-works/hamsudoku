import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';

interface ProfileDialogProps {
  email: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onClose: () => void;
}

export function ProfileDialog({ email, onLogin, onLogout, onClose }: ProfileDialogProps) {
  return (
    <Overlay label="프로필">
      <div className="settings">
        <h2 className="settings-title">프로필</h2>
        {email ? (
          <div className="setting-row">
            <span>{email}</span>
            <Button onClick={onLogout}>로그아웃</Button>
          </div>
        ) : (
          <>
            <p className="login-note">지금은 이 기기에만 기록돼요.</p>
            <Button variant="sticker" onClick={onLogin}>
              로그인
            </Button>
          </>
        )}
        <Button variant="sticker" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Overlay>
  );
}
