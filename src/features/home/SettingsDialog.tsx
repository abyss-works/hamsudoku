import { Button } from '../../ui/Button';
import { Overlay } from '../../ui/Overlay';
import { useSoundToggle } from '../../platform/audio/useSoundPreferences';

interface SettingsDialogProps {
  sound: boolean;
  onToggleSound: () => void;
  onClose: () => void;
}

export function SettingsDialog({ sound, onToggleSound, onClose }: SettingsDialogProps) {
  const toggleSound = useSoundToggle(sound, onToggleSound);
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
