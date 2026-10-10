import { Button } from '../../../ui/Button';

export interface BaseSelectionViewProps {
  guestSnapshot: { seeds: number; clears: number } | null;
  deviceLabel: string;
  accountLabel: string;
  deviceRecommended: boolean;
  accountRecommended: boolean;
  busy: boolean;
  selectBase: (chosen: 'device' | 'account') => void;
  pickBase: (chosen: 'device' | 'account') => void | Promise<void>;
}

export function BaseSelectionView({
  guestSnapshot,
  deviceLabel,
  accountLabel,
  deviceRecommended,
  accountRecommended,
  busy,
  selectBase,
  pickBase,
}: BaseSelectionViewProps) {
  return (
    <>
      <p>이미 가입된 이메일이에요. 이 계정으로 로그인할까요?</p>
      {guestSnapshot ? (
        <>
          <Button
            variant="sticker"
            className={deviceRecommended ? 'btn-primary login-base-btn' : 'login-base-btn'}
            onClick={() => selectBase('device')}
            disabled={busy}
          >
            {deviceLabel}
          </Button>
          <Button
            variant="sticker"
            className={accountRecommended ? 'btn-primary login-base-btn' : 'login-base-btn'}
            onClick={() => selectBase('account')}
            disabled={busy}
          >
            {accountLabel}
          </Button>
        </>
      ) : (
        <Button variant="sticker" className="btn-primary" onClick={() => void pickBase('account')} disabled={busy}>
          로그인하기
        </Button>
      )}
    </>
  );
}
