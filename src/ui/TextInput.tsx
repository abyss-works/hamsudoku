import type { InputHTMLAttributes } from 'react';
import { useTextInputDisplay } from './useDisplayServices';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function TextInput({ className = '', ...rest }: TextInputProps) {
  const cls = useTextInputDisplay(className);
  return <input {...rest} className={cls} />;
}
