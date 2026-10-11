import { useEffect } from 'react';
import { installAudioRecovery, preloadSfx, previewSoundEnabled, setSfxEnabled } from './sound';

export function useSoundPreferences(enabled: boolean): void {
  useEffect(() => {
    preloadSfx();
    return installAudioRecovery();
  }, []);
  useEffect(() => { setSfxEnabled(enabled); }, [enabled]);
}

export function useSoundToggle(enabled: boolean, onToggle: () => void) {
  return () => {
    onToggle();
    if (!enabled) previewSoundEnabled();
  };
}
