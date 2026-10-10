import type { MouseEvent } from 'react';
import { useButtonAction } from './useButtonAction';
import { buttonClass, textInputClass } from '../shared/classNames';

export function useButtonDisplay(
  variant: 'plain' | 'sticker',
  className: string,
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void,
) {
  const cls = buttonClass(variant, className);
  const handleClick = useButtonAction(onClick);
  return { cls, handleClick };
}

export function useTextInputDisplay(className: string) {
  return textInputClass(className);
}
