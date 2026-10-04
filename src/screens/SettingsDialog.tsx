import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';

export function SettingsDialog({ onClose }: { onClose(): void }) {
  return (
    <Overlay label="설정">
      <div className="settings">
        <h2 className="settings-title">설정</h2>
        <label className="setting-row">
          <span>효과음</span>
          <button type="button" role="switch" aria-checked="false" disabled>
            준비중
          </button>
        </label>
        <label className="setting-row">
          <span>진동</span>
          <button type="button" role="switch" aria-checked="false" disabled>
            준비중
          </button>
        </label>
        <Button variant="sticker" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Overlay>
  );
}
