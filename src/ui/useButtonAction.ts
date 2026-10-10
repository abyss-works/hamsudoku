import type { MouseEvent } from 'react';
import { playButtonSound } from '../platform/audio/sound';

export function useButtonAction(onClick?: (event: MouseEvent<HTMLButtonElement>) => void) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    playButtonSound();
    onClick?.(event);
  };
}
