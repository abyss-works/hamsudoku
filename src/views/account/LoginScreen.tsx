import { ChevronLeft } from 'lucide-react';
import { Button } from '../../ui/Button';
import { HamsterFace } from '../../ui/HamsterFace';
import { useLoginService } from '../../features/account/useLoginService';
import type { LoginServiceOptions } from '../../features/account/login.types';
import { LoginConfirmationView } from './login/LoginConfirmationView';

export interface LoginScreenProps extends LoginServiceOptions {
  cloud: boolean;
  onBack: () => void;
}

export function LoginScreen({ signup, signin, reset, cloud, onBack, onDone }: LoginScreenProps) {
  const { email, setEmail, password, setPassword, error, okMessage, confirmLogin, busy, submit, forgot, login, cancelLogin } =
    useLoginService({ signup, signin, reset, onDone });

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-head">
          <Button variant="sticker" className="btn-icon" aria-label="뒤로" onClick={onBack}>
            <ChevronLeft size={20} aria-hidden="true" />
          </Button>
          <h2 className="login-title">계정</h2>
          <span className="login-mascot" aria-hidden="true">
            <HamsterFace />
          </span>
        </div>
        <form className="login-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <label className="login-field">
            <span>이메일</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={busy}
            />
          </label>
          <label className="login-field">
            <span>비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busy}
            />
          </label>
          {error && (
            <p role="alert" className="login-error">
              {error}
            </p>
          )}
          {okMessage && <p className="login-ok">{okMessage}</p>}
          {confirmLogin ? (
            <LoginConfirmationView
              busy={busy}
              login={login}
              cancelLogin={cancelLogin}
            />
          ) : (
            <Button variant="sticker" className="btn-primary" type="submit" disabled={busy}>
              이메일로 계속하기
            </Button>
          )}
        </form>
        {cloud && (
          <button type="button" className="login-switch" onClick={() => void forgot()} disabled={busy}>
            비밀번호를 잊었어요
          </button>
        )}
        <p className="login-note">처음이면 계정이 만들어지고 지금 기록이 그대로 이어져요.</p>
      </div>
    </div>
  );
}
