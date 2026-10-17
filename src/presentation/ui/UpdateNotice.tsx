import { Button } from './Button';

export interface UpdateNoticeProps {
  onReload: () => void;
}

/** 새 배포가 있을 때 화면을 막지 않고 새로고침을 안내한다. */
export function UpdateNotice({ onReload }: UpdateNoticeProps) {
  return (
    <div className="update-notice" role="status">
      <p className="update-notice-text">새 버전이 나왔어요. 새로고침하면 적용돼요.</p>
      <Button variant="sticker" className="btn-primary" onClick={onReload}>
        새로고침
      </Button>
    </div>
  );
}
