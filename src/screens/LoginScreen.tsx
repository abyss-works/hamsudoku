import { useState, type FormEvent } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { HamsterFace } from '../ui/HamsterFace';

interface LoginScreenProps {
  signup: (email: string, password: string) => Promise<{ ok: boolean; msg?: string }>;
  signin: (email: string, password: string) => Promise<{ ok: boolean; msg?: string }>;
  onBack: () => void;
  onDone: () => void;
}

export function LoginScreen({ signup, signin, onBack, onDone }: LoginScreenProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = mode === 'signup' ? await signup(email, password) : await signin(email, password);
      if (r.ok) {
        onDone();
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
          <h2 className="login-title">{mode === 'signup' ? '가입하기' : '로그인'}</h2>
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
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              disabled={busy}
            />
          </label>
          {error && (
            <p role="alert" className="login-error">
              {error}
            </p>
          )}
          <Button variant="sticker" className="btn-primary" type="submit" disabled={busy}>
            {mode === 'signup' ? '가입하기' : '로그인하기'}
          </Button>
        </form>
        <button type="button" className="login-switch" onClick={switchMode} disabled={busy}>
          {mode === 'signup' ? '이미 계정이 있나요? 로그인하기' : '처음 오셨나요? 계정 만들기'}
        </button>
        <p className="login-note">로그인하면 게스트 기록 대신 계정 기록으로 바뀝니다.</p>
      </div>
    </div>
  );
}
