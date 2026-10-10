import { ChevronLeft, LogIn } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Overlay } from '../../ui/Overlay';
import { useAuthDialogService } from '../../features/account/useAuthDialogService';
import type { AuthDialogOptions, AuthFn } from '../../features/account/authDialog.types';
import { CredentialsView } from './auth/CredentialsView';
import { BaseSelectionView } from './auth/BaseSelectionView';
import { LinkConfirmationView } from './auth/LinkConfirmationView';

export type { AuthFn };

export interface AuthDialogProps extends AuthDialogOptions {
  onBack: () => void;
}

export function AuthDialog({
  signup,
  signin,
  reset,
  guest,
  fetchAccountSeeds,
  onBase,
  onBack,
  onDone,
}: AuthDialogProps) {
  const {
    guestSnapshot,
    email,
    setEmail,
    password,
    setPassword,
    error,
    okMessage,
    chooseBase,
    pendingBase,
    busy,
    submit,
    requestReset,
    pickBase,
    selectBase,
    confirmBase,
    cancelBase,
    deviceRecommended,
    accountRecommended,
    deviceLabel,
    accountLabel,
  } = useAuthDialogService({ signup, signin, reset, guest, fetchAccountSeeds, onBase, onDone });

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
        <form
          className="login-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <CredentialsView
            email={email}
            setEmail={setEmail}
            password={password}
            setPassword={setPassword}
            busy={busy}
          />
          {error && (
            <p role="alert" className="login-error">
              {error}
            </p>
          )}
          {okMessage && <p className="login-ok">{okMessage}</p>}
          {chooseBase ? (
            <div className="login-confirm">
              {pendingBase === null ? (
                <BaseSelectionView
                  guestSnapshot={guestSnapshot}
                  deviceLabel={deviceLabel}
                  accountLabel={accountLabel}
                  deviceRecommended={deviceRecommended}
                  accountRecommended={accountRecommended}
                  busy={busy}
                  selectBase={selectBase}
                  pickBase={pickBase}
                />
              ) : (
                <LinkConfirmationView
                  busy={busy}
                  confirmBase={confirmBase}
                  cancelBase={cancelBase}
                />
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
