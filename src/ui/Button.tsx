import type { ButtonHTMLAttributes } from 'react';
import { useButtonAction } from './useButtonAction';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'plain' | 'sticker';
}

export function Button({ variant = 'plain', className = '', type = 'button', onClick, ...rest }: ButtonProps) {
  const cls = `btn ${variant === 'sticker' ? 'btn-sticker ' : ''}${className}`.trim();
  const handleClick = useButtonAction(onClick);
  return <button type={type} {...rest} onClick={handleClick} className={cls} />;
}
