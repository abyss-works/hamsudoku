import { useLoginService } from './useLoginService';
import type { LoginScreenProps } from './login.types';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../ui/Button';
import { HamsterFace } from '../../ui/HamsterFace';

export function LoginScreen({ signup, signin, reset, cloud, onBack, onDone }: LoginScreenProps) {
  const { email, setEmail, password, setPassword, error, okMessage, confirmLogin, busy, submit, forgot, login, cancelLogin } = useLoginService({ signup, signin, reset, cloud, onBack, onDone });

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
