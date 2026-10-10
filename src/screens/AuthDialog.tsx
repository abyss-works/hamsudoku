export type { AuthFn } from '../game/useAuthDialogServiceContracts';
import { useAuthDialogService } from '../game/useAuthDialogService';
import type { AuthDialogProps } from '../game/useAuthDialogServiceContracts';
import { ChevronLeft, LogIn } from 'lucide-react';
import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';
export function AuthDialog({ signup, signin, reset, guest, fetchAccountSeeds, onBase, onBack, onDone }: AuthDialogProps) {
  const { guestSnapshot, email, setEmail, password, setPassword, error, okMessage, chooseBase, accountSeeds, pendingBase, busy, submit, requestReset, pickBase, selectBase, confirmBase, cancelBase, deviceRecommended, accountRecommended } = useAuthDialogService({ signup, signin, reset, guest, fetchAccountSeeds, onBase, onBack, onDone });

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
        <form className="login-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
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
              {pendingBase === null && <p>이미 가입된 이메일이에요. 이 계정으로 로그인할까요?</p>}
              {pendingBase === null ? (
                <>
                  {guestSnapshot && (
                    <>
                      <Button
                        variant="sticker"
                        className={deviceRecommended ? 'btn-primary login-base-btn' : 'login-base-btn'}
                        onClick={() => selectBase('device')}
                        disabled={busy}
                      >
                        이 기기 기준 (씨앗 {guestSnapshot.seeds}개)
                      </Button>
                      <Button
                        variant="sticker"
                        className={accountRecommended ? 'btn-primary login-base-btn' : 'login-base-btn'}
                        onClick={() => selectBase('account')}
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
                </>
              ) : (
                <>
                  <p>씨앗이 적은 쪽으로 연동하면 다른 쪽 기록은 되돌릴 수 없어요. 이 기준으로 연동할까요?</p>
                  <Button variant="sticker" className="btn-primary login-base-btn" onClick={confirmBase} disabled={busy}>
                    연동하기
                  </Button>
                  <Button variant="sticker" className="login-base-btn" onClick={cancelBase} disabled={busy}>
                    다시 선택
                  </Button>
                </>
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
