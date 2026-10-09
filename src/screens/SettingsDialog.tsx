import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';
import { playSfx, setSfxEnabled } from '../game/sound';

interface SettingsDialogProps {
  sound: boolean;
  onToggleSound: () => void;
  onClose: () => void;
}

export function SettingsDialog({ sound, onToggleSound, onClose }: SettingsDialogProps) {
  const toggleSound = () => {
    onToggleSound();
    if (!sound) {
      // 켜는 순간 미리 듣는다. 엔진 동기화는 App effect가 뒤따라 한다.
      setSfxEnabled(true);
      playSfx('ui-click');
    }
  };
  return (
    <Overlay label="설정">
      <div className="settings">
        <h2 className="settings-title">설정</h2>
        <label className="setting-row">
          <span>효과음</span>
          <Button role="switch" aria-checked={sound} onClick={toggleSound}>
            {sound ? '켬' : '끔'}
          </Button>
        </label>
        <label className="setting-row">
          <span>진동</span>
          <Button role="switch" aria-checked="false" disabled>
            준비중
          </Button>
        </label>
        <Button variant="sticker" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Overlay>
  );
}
