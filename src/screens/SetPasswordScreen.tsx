import { useSetPasswordService } from '../game/useSetPasswordService';
import type { SetPasswordScreenProps } from '../game/useSetPasswordServiceContracts';
import { Button } from '../ui/Button';
import { HamsterFace } from '../ui/HamsterFace';

export function SetPasswordScreen({ setPassword, linkError, onDone }: SetPasswordScreenProps) {
  const { password, setPw, confirm, setConfirm, error, okMessage, busy, submit } = useSetPasswordService({ setPassword, linkError, onDone });

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-head">
          <span className="login-mascot" aria-hidden="true">
            <HamsterFace />
          </span>
          <h2 className="login-title">새 비밀번호</h2>
          <span />
        </div>
        {linkError ? (
          <>
            <p role="alert" className="login-error">
              링크가 만료됐어요. 재설정 메일을 다시 요청하세요.
            </p>
            <Button variant="sticker" onClick={onDone}>
              홈으로
            </Button>
          </>
        ) : okMessage ? (
          <p className="login-ok">{okMessage}</p>
        ) : (
          <form className="login-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <label className="login-field">
              <span>새 비밀번호</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="new-password"
                disabled={busy}
              />
            </label>
            <label className="login-field">
              <span>새 비밀번호 확인</span>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={busy}
              />
            </label>
            {error && (
              <p role="alert" className="login-error">
                {error}
              </p>
            )}
            <Button variant="sticker" className="btn-primary" type="submit" disabled={busy}>
              비밀번호 바꾸기
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
