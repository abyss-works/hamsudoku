export interface CredentialsViewProps {
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  busy: boolean;
}

export function CredentialsView({
  email,
  setEmail,
  password,
  setPassword,
  busy,
}: CredentialsViewProps) {
  return (
    <>
      <label className="login-field">
        <span>이메일</span>
        <input
          type="email"
          aria-label="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          disabled={busy}
        />
      </label>
      <label className="login-field">
        <span>비밀번호</span>
        <input
          type="password"
          aria-label="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={busy}
        />
      </label>
    </>
  );
}
