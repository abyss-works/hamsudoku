import type { MouseEvent } from 'react';
import { playButtonSound } from '../../platform/audio/sound';

export function buttonAction(onClick?: (event: MouseEvent<HTMLButtonElement>) => void) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    playButtonSound();
    onClick?.(event);
  };
}
