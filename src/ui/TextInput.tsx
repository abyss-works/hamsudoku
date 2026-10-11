import type { InputHTMLAttributes } from 'react';
import { textInputClass } from './classNames';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function TextInput({ className = '', ...rest }: TextInputProps) {
  const cls = textInputClass(className);
  return <input {...rest} className={cls} />;
}
