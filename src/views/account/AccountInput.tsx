import type { ChangeEvent } from 'react';

export interface AccountInputProps {
  label: string;
  type?: string;
  value: string;
  onChange: (val: string) => void;
  autoComplete?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function AccountInput({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  disabled,
  ariaLabel,
}: AccountInputProps) {
  return (
    <label className="login-field">
      <span>{label}</span>
      <input
        type={type}
        aria-label={ariaLabel}
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        autoComplete={autoComplete}
        disabled={disabled}
      />
    </label>
  );
}
