import { useState } from 'react';
import { Button } from '../ui/Button';

interface LoginScreenProps {
  signup: (email: string, password: string) => Promise<{ ok: boolean; msg?: string }>;
  signin: (email: string, password: string) => Promise<{ ok: boolean; msg?: string }>;
  onBack: () => void;
  onDone: () => void;
}

export function LoginScreen({ signup, signin, onBack, onDone }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (kind: 'signup' | 'signin') => {
    const r = kind === 'signup' ? await signup(email, password) : await signin(email, password);
    if (r.ok) {
      onDone();
    } else {
      setError(r.msg ?? '실패했어요.');
    }
  };

  return (
    <div className="login">
      <h2 className="login-title">로그인</h2>
      <label className="login-row">
        <span>이메일</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </label>
      <label className="login-row">
        <span>비밀번호</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <div className="login-actions">
        <Button variant="sticker" onClick={() => void submit('signup')}>
          가입하기
        </Button>
        <Button variant="sticker" className="btn-primary" onClick={() => void submit('signin')}>
          로그인하기
        </Button>
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
      </div>
      <p className="login-note">로그인하면 이 기기의 게스트 기록 대신 계정 기록으로 바뀝니다.</p>
    </div>
  );
}
