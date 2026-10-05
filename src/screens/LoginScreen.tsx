import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { HamsterFace } from '../ui/HamsterFace';

interface AuthFn {
  (email: string, password: string): Promise<{ ok: boolean; msg?: string; code?: string }>;
}

interface LoginScreenProps {
  signup: AuthFn;
  signin: AuthFn;
  reset: (email: string) => Promise<{ ok: boolean; msg?: string }>;
  cloud: boolean;
  onBack: () => void;
  onDone: () => void;
}

// 통합 계정 폼 — 가입·로그인 구분 없이 "이메일로 계속하기" 하나로.
// 승격(signup) 먼저 시도하고, 이미 가입된 이메일이면 확인 후 로그인(signin)으로 전환한다.
export function LoginScreen({ signup, signin, reset, cloud, onBack, onDone }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [confirmLogin, setConfirmLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const doneLater = (message: string) => {
    setOkMessage(message);
    timer.current = setTimeout(() => onDone(), 700);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) {
      setError('이메일과 6자 이상 비밀번호를 입력하세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await signup(email.trim(), password);
      if (r.ok) {
        doneLater('계정이 만들어졌다!');
        return;
      }
      if (r.code === 'email_exists' || r.code === 'user_already_exists') {
        setConfirmLogin(true);
        return;
      }
      setError(r.msg ?? '실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      setError('재설정 메일을 받을 이메일을 입력하세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await reset(email.trim());
      if (r.ok) {
        setOkMessage('재설정 메일을 보냈어요. 받은편지함을 확인하세요.');
      } else {
        setError(r.msg ?? '실패했어요.');
      }
    } finally {
      setBusy(false);
    }
  };
  const login = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await signin(email.trim(), password);
      if (r.ok) {
        doneLater('로그인됐다!');
      } else {
        setError(r.msg ?? '실패했어요.');
      }
    } finally {
      setBusy(false);
    }
  };

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
        <form className="login-form" onSubmit={(e) => void submit(e)}>
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
                <Button variant="sticker" onClick={() => setConfirmLogin(false)} disabled={busy}>
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
