import { Button } from '../../../ui/Button';

export interface LinkConfirmationViewProps {
  busy: boolean;
  confirmBase: () => void | Promise<void>;
  cancelBase: () => void;
}

export function LinkConfirmationView({
  busy,
  confirmBase,
  cancelBase,
}: LinkConfirmationViewProps) {
  return (
    <>
      <p>씨앗이 적은 쪽으로 연동하면 다른 쪽 기록은 되돌릴 수 없어요. 이 기준으로 연동할까요?</p>
      <Button variant="sticker" className="btn-primary login-base-btn" onClick={confirmBase} disabled={busy}>
        연동하기
      </Button>
      <Button variant="sticker" className="login-base-btn" onClick={cancelBase} disabled={busy}>
        다시 선택
      </Button>
    </>
  );
}
