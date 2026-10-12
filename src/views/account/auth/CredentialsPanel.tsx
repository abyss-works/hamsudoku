import { AccountInput } from '../AccountInput';

export interface CredentialsPanelProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  busy: boolean;
}

export function CredentialsPanel({
  email,
  setEmail,
  password,
  setPassword,
  busy,
}: CredentialsPanelProps) {
  return (
    <>
      <AccountInput
        label="이메일"
        type="email"
        ariaLabel="이메일"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        disabled={busy}
      />
      <AccountInput
        label="비밀번호"
        type="password"
        ariaLabel="비밀번호"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        disabled={busy}
      />
    </>
  );
}
