import { useRef, useState } from 'react';
import type { LoginServiceOptions } from './login.types';
import { useFeedbackLifetime } from './useFeedbackLifetime';
import { validateCredentials, existingEmail, validateResetEmail } from './validation';
export function useLoginService({ signup, signin, reset, onDone }: LoginServiceOptions) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [confirmLogin, setConfirmLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const { timer, alive } = useFeedbackLifetime();
  const inFlight = useRef(false);


  const doneLater = (message: string) => {
    if (!alive.current) return;
    setOkMessage(message);
    timer.current = setTimeout(() => { timer.current = null; if (alive.current) onDone(); }, 700);
  };

  const submit = async () => {
    const validation = validateCredentials(email, password);
    if (validation) {
      setError(validation);
      return;
    }
    if (inFlight.current || timer.current || !alive.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await signup(email.trim(), password);
      if (!alive.current) return;
      if (r.ok) {
        doneLater('계정이 만들어졌다!');
        return;
      }
      if (existingEmail(r.code)) {
        setConfirmLogin(true);
        return;
      }
      setError(r.msg ?? '실패했어요.');
    } catch {
      if (alive.current) setError('연결에 실패했어요.');
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const forgot = async () => {
    if (!validateResetEmail(email)) {
      setError('재설정 메일을 받을 이메일을 입력하세요.');
      return;
    }
    if (inFlight.current || timer.current || !alive.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await reset(email.trim());
      if (!alive.current) return;
      if (r.ok) {
        setOkMessage('재설정 메일을 보냈어요. 받은편지함을 확인하세요.');
      } else {
        setError(r.msg ?? '실패했어요.');
      }
    } catch {
      if (alive.current) setError('연결에 실패했어요.');
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const login = async () => {
    if (inFlight.current || timer.current || !alive.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await signin(email.trim(), password);
      if (!alive.current) return;
      if (r.ok) {
        doneLater('로그인됐다!');
      } else {
        setError(r.msg ?? '실패했어요.');
      }
    } catch {
      if (alive.current) setError('연결에 실패했어요.');
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const cancelLogin = () => setConfirmLogin(false);

  return { email, setEmail, password, setPassword, error, okMessage, confirmLogin, busy, submit, forgot, login, cancelLogin };
}
