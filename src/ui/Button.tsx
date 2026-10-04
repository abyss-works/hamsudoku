import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'plain' | 'sticker';
}

export function Button({ variant = 'plain', className = '', type = 'button', ...rest }: ButtonProps) {
  const cls = `btn ${variant === 'sticker' ? 'btn-sticker ' : ''}${className}`.trim();
  return <button type={type} {...rest} className={cls} />;
}
