import type { ButtonHTMLAttributes } from 'react';
import { useButtonDisplay } from './useDisplayServices';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'plain' | 'sticker';
}

export function Button({ variant = 'plain', className = '', type = 'button', onClick, ...rest }: ButtonProps) {
  const { cls, handleClick } = useButtonDisplay(variant, className, onClick);
  return <button type={type} {...rest} onClick={handleClick} className={cls} />;
}
