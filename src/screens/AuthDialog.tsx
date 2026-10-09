import { useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, LogIn } from 'lucide-react';
import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';
export type AuthFn = (
  email: string,
  password: string,
  /** 계정 연동 흐름: 로그인이 성공해도 데이터 교체를 유보한다(기준 선택 후 확정). */
  hold?: boolean,
) => Promise<{ ok: boolean; msg?: string; code?: string }>;

interface AuthDialogProps {
  /** 기준 선택 결과를 상위에 전달. device | account */
  onBase?: (base: 'device' | 'account') => void;
  signup: AuthFn;
  signin: AuthFn;
  reset: (email: string) => Promise<{ ok: boolean; msg?: string }>;
  /** 게스트 기기 값. 로그인 기준 선택 추천에 쓴다. null이면 선택 없이 진행한다. */
  guest: { seeds: number; clears: number } | null;
  /** 계정 지갑의 씨앗 수를 읽어온다(로그인 세션이고 나서). 기준 선택 표시용. */
  fetchAccountSeeds?: () => Promise<number>;
  onBack: () => void;
  onDone: () => void;
}

// 계정 연동 다이얼로그. 이메일·비밀번호로 회원가입을 먼저 시도하고,
// 이미 가입된 이메일이면 로그인을 선행해 기준 선택(기기 기준 / 계정 기준)으로 넘어간다.
// 기준 선택 중 닫으면 상위가 세션 취소(로그아웃)를 결정한다.
export function AuthDialog({ signup, signin, reset, guest, fetchAccountSeeds, onBase, onBack, onDone }: AuthDialogProps) {
  // 열린 시점의 게스트 값을 고정한다(로그인 선행으로 세션이 바뀌어도 기준 비교는 열림 시점 기준).
  const [guestSnapshot] = useState(guest);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [chooseBase, setChooseBase] = useState(false);
  const [accountSeeds, setAccountSeeds] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestReset = async () => {
    if (!email.trim()) {
      setError('이메일을 먼저 입력하세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await reset(email.trim());
      if (r.ok) {
        finishLater('재설정 메일을 보냈어요. 받은편지함을 확인하세요.');
      } else {
        setError(r.msg ?? '재설정 메일 전송에 실패했어요.');
      }
    } finally {
      setBusy(false);
    }
  };

  const finishLater = (message: string) => {
    setOkMessage(message);
    timer.current = setTimeout(() => onDone(), 700);
  };

  // 기준 선택 후 로그인 실행. 선택값은 콜백에 전달해 상위가 데이터 흐름을 정한다.
  const pickBase = async (chosen: 'device' | 'account') => {
    setBusy(true);
    setError(null);
    try {
      void onBase?.(chosen);
      const r = await signin(email.trim(), password);
      if (r.ok) {
        finishLater('로그인됐다!');
      } else {
        setError(r.msg ?? '실패했어요.');
      }
    } finally {
      setBusy(false);
    }
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
      let r;
      try {
        r = await signup(email.trim(), password);
      } catch {
        r = { ok: false, msg: '연결에 실패했어요.' };
      }
      if (r.ok) {
        finishLater('계정이 만들어졌다!');
        return;
      }
      if (r.code === 'email_exists' || r.code === 'user_already_exists') {
        // 정확한 기준 비교를 위해 로그인을 먼저 수행한다(계정 지갑 조회 전제).
        const li = await signin(email.trim(), password);
        if (!li.ok) {
          setError(li.msg ?? '로그인에 실패했어요.');
          return;
        }
        setChooseBase(true);
        // 계정 기준 버튼에 기존 지갑의 씨앗 수를 보여준다.
        await fetchAccountSeeds?.().then(setAccountSeeds).catch(() => setAccountSeeds(null));
        return;
      }
      setError(r.msg ?? '실패했어요.');
    } finally {
      setBusy(false);
    }
  };

  // 실제 로그인은 기준 선택 이후 signin을 호출한다. 추천은 guest 씨앗 수 비교로 정한다.

  return (
    <Overlay label="계정 연동">
      <div className="login-card">
        <div className="login-head">
          <Button variant="sticker" className="btn-icon" aria-label="뒤로" onClick={onBack}>
            <ChevronLeft size={20} aria-hidden="true" />
          </Button>
          <h2 className="login-title">계정 연동</h2>
          <span className="login-mascot" aria-hidden="true">
            <LogIn size={20} />
          </span>
        </div>
        <form className="login-form" onSubmit={(e) => void submit(e)}>
          <label className="login-field">
            <span>이메일</span>
            <input
              type="email"
              aria-label="이메일"
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
              aria-label="비밀번호"
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
          {chooseBase ? (
            <div className="login-confirm">
              <p>이미 가입된 이메일이에요. 이 계정으로 로그인할까요?</p>
              {guestSnapshot && (
                <>
                  <Button
                    variant="sticker"
                    className={(accountSeeds ?? 0) <= guestSnapshot.seeds ? 'btn-primary login-base-btn' : 'login-base-btn'}
                    onClick={() => void pickBase('device')}
                    disabled={busy}
                  >
                    이 기기 기준 (씨앗 {guestSnapshot.seeds}개)
                  </Button>
                  <Button
                    variant="sticker"
                    className={accountSeeds !== null && accountSeeds > guestSnapshot.seeds ? 'btn-primary login-base-btn' : 'login-base-btn'}
                    onClick={() => void pickBase('account')}
                    disabled={busy}
                  >
                    계정 기준{accountSeeds !== null ? ` (씨앗 ${accountSeeds}개)` : ''}
                  </Button>
                </>
              )}
              {!guestSnapshot && (
                <Button variant="sticker" className="btn-primary" onClick={() => void pickBase('account')} disabled={busy}>
                  로그인하기
                </Button>
              )}
            </div>
          ) : (
            <Button variant="sticker" className="btn-primary" type="submit" disabled={busy}>
              이메일로 계속하기
            </Button>
          )}
        </form>
        {!chooseBase && (
          <Button variant="sticker" onClick={() => void requestReset()} disabled={busy}>
            비밀번호를 잊었어요
          </Button>
        )}
        <p className="login-note">처음이면 계정이 만들어지고 지금 기록이 그대로 이어져요.</p>
      </div>
    </Overlay>
  );
}
