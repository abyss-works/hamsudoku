import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { HamsterFace } from '../ui/HamsterFace';

interface SetPasswordScreenProps {
  setPassword: (password: string) => Promise<{ ok: boolean; msg?: string }>;
  linkError: boolean;
  onDone: () => void;
}

export function SetPasswordScreen({ setPassword, linkError, onDone }: SetPasswordScreenProps) {
  const [password, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('6자 이상 비밀번호를 입력하세요.');
      return;
    }
    if (password !== confirm) {
      setError('비밀번호가 서로 달라요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await setPassword(password);
      if (r.ok) {
        setOkMessage('비밀번호를 바꿨어요!');
        timer.current = setTimeout(() => onDone(), 700);
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
          <form className="login-form" onSubmit={(e) => void submit(e)}>
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
