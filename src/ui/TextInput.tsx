import type { InputHTMLAttributes } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function TextInput({ className = '', ...rest }: TextInputProps) {
  const cls = `text-input ${className}`.trim();
  return <input {...rest} className={cls} />;
}
