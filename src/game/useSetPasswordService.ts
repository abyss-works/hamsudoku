import { useRef, useState } from 'react';
import type { SetPasswordScreenProps } from './useSetPasswordServiceContracts';
import { useFeedbackLifetime } from './useFeedbackLifetime';
import { validatePassword } from './forms';
export function useSetPasswordService({ setPassword, onDone }: SetPasswordScreenProps) {
  const [password, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { timer, alive } = useFeedbackLifetime();
  const inFlight = useRef(false);


  const submit = async () => {
    const validation = validatePassword(password, confirm);
    if (validation) { setError(validation); return; }
    if (inFlight.current || timer.current || !alive.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await setPassword(password);
      if (!alive.current) return;
      if (r.ok) {
        setOkMessage('비밀번호를 바꿨어요!');
        timer.current = setTimeout(() => { timer.current = null; if (alive.current) onDone(); }, 700);
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

  return { password, setPw, confirm, setConfirm, error, okMessage, busy, submit };
}
