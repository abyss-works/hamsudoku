import type { ButtonHTMLAttributes, MouseEvent } from 'react';
import { playSfx } from '../game/sound';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'plain' | 'sticker';
}

export function Button({ variant = 'plain', className = '', type = 'button', onClick, ...rest }: ButtonProps) {
  const cls = `btn ${variant === 'sticker' ? 'btn-sticker ' : ''}${className}`.trim();
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    playSfx('ui-click');
    onClick?.(e);
  };
  return <button type={type} {...rest} onClick={handleClick} className={cls} />;
}
