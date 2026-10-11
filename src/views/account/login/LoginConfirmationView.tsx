import { Button } from '../../../ui/Button';

export interface LoginConfirmationViewProps {
  busy: boolean;
  login: () => void | Promise<void>;
  cancelLogin: () => void;
}

export function LoginConfirmationView({
  busy,
  login,
  cancelLogin,
}: LoginConfirmationViewProps) {
  return (
    <div className="login-confirm">
      <p>이미 가입된 이메일이에요. 이 계정으로 로그인할까요?</p>
      <p>로그인하면 이 기기의 게스트 기록 대신 계정 기록으로 바뀝니다.</p>
      <div className="login-confirm-actions">
        <Button variant="sticker" className="btn-primary" onClick={() => void login()} disabled={busy}>
          로그인하기
        </Button>
        <Button variant="sticker" onClick={cancelLogin} disabled={busy}>
          취소
        </Button>
      </div>
    </div>
  );
}
