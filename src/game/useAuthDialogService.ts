import { useRef, useState } from 'react';
import type { AuthDialogProps } from './useAuthDialogServiceContracts';
import { useFeedbackLifetime } from './useFeedbackLifetime';
import { validateCredentials, recommendedBase, existingEmail, validateResetEmail } from './forms';
export function useAuthDialogService({ signup, signin, reset, guest, fetchAccountSeeds, onBase, onDone }: AuthDialogProps) {
  // 열린 시점의 게스트 값을 고정한다(로그인 선행으로 세션이 바뀌어도 기준 비교는 열림 시점 기준).
  const latestFetchAccountSeeds = useRef(fetchAccountSeeds);
  latestFetchAccountSeeds.current = fetchAccountSeeds;
  const [guestSnapshot] = useState(guest);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [chooseBase, setChooseBase] = useState(false);
  const [accountSeeds, setAccountSeeds] = useState<number | null>(null);
  const [pendingBase, setPendingBase] = useState<'device' | 'account' | null>(null);
  const [busy, setBusy] = useState(false);
  const { timer, alive } = useFeedbackLifetime();
  const inFlight = useRef(false);

  const requestReset = async () => {
    if (!validateResetEmail(email)) {
      setError('이메일을 먼저 입력하세요.');
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
        finishLater('재설정 메일을 보냈어요. 받은편지함을 확인하세요.');
      } else {
        setError(r.msg ?? '재설정 메일 전송에 실패했어요.');
      }
    } catch {
      if (alive.current) setError('연결에 실패했어요.');
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const finishLater = (message: string) => {
    if (!alive.current) return;
    setOkMessage(message);
    timer.current = setTimeout(() => { timer.current = null; if (alive.current) onDone(); }, 700);
  };

  // 기준 선택 후 로그인 실행. 선택값은 콜백에 전달해 상위가 데이터 흐름을 정한다.
  const pickBase = async (chosen: 'device' | 'account') => {
    if (inFlight.current || timer.current || !alive.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      void onBase?.(chosen);
      const r = await signin(email.trim(), password);
      if (!alive.current) return;
      if (r.ok) {
        finishLater('로그인됐다!');
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
      let r;
      try {
        r = await signup(email.trim(), password);
        if (!alive.current) return;
      } catch {
        r = { ok: false, msg: '연결에 실패했어요.' };
      }
      if (r.ok) {
        finishLater('계정이 만들어졌다!');
        return;
      }
      if (existingEmail(r.code)) {
        // 정확한 기준 비교를 위해 로그인을 먼저 수행한다(계정 지갑 조회 전제).
        const li = await signin(email.trim(), password);
        if (!alive.current) return;
        if (!li.ok) {
          setError(li.msg ?? '로그인에 실패했어요.');
          return;
        }
        setChooseBase(true);
        // 계정 기준 버튼에 기존 지갑의 씨앗 수를 보여준다.
        await latestFetchAccountSeeds.current?.().then((seeds) => {if (alive.current) setAccountSeeds(seeds);}).catch(() => {if (alive.current) setAccountSeeds(null);});
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

  // 실제 로그인은 기준 선택 이후 signin을 호출한다. 추천은 guest 씨앗 수 비교로 정한다.
  // 씨앗이 많은 쪽이 추천이며, 적은 쪽을 고르면 되돌릴 수 없음을 먼저 알린다.
  const base = recommendedBase(guestSnapshot, accountSeeds);
  const deviceRecommended = base === null || base === 'device';
  const accountRecommended = base === null || base === 'account';

  const selectBase = (chosen: 'device' | 'account') => {
    if (base === null || base === chosen) {
      void pickBase(chosen);
      return;
    }
    setPendingBase(chosen);
  };

  const confirmBase = async () => {
    const chosen = pendingBase;
    setPendingBase(null);
    if (chosen) await pickBase(chosen);
  };

  const cancelBase = () => setPendingBase(null);

  return { guestSnapshot, email, setEmail, password, setPassword, error, okMessage, chooseBase, accountSeeds, pendingBase, busy, submit, requestReset, pickBase, selectBase, confirmBase, cancelBase, deviceRecommended, accountRecommended };
}
