import type { ButtonHTMLAttributes } from 'react';
import { buttonClass } from './classNames';
import { buttonAction } from './useButtonAction';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'plain' | 'sticker';
}

export function Button({ variant = 'plain', className = '', type = 'button', onClick, ...rest }: ButtonProps) {
  const cls = buttonClass(variant, className);
  const handleClick = buttonAction(onClick);
  return <button type={type} {...rest} onClick={handleClick} className={cls} />;
}
