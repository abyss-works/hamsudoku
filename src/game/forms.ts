export type AccountBase = 'device' | 'account';
export function validateCredentials(email: string, password: string): string | null {
  return !email.trim() || password.length < 6 ? '이메일과 6자 이상 비밀번호를 입력하세요.' : null;
}
export function validatePassword(password: string, confirm: string): string | null {
  if (password.length < 6)
    return '6자 이상 비밀번호를 입력하세요.';
  return password !== confirm ? '비밀번호가 서로 달라요.' : null;
}
export function recommendedBase(guest: {
  seeds: number;
  clears: number;
} | null, accountSeeds: number | null): AccountBase | null {
  if (!guest)
    return null;
  return accountSeeds !== null && accountSeeds > guest.seeds ? 'account' : 'device';
}
export function existingEmail(code?: string): boolean { return code === 'email_exists' || code === 'user_already_exists'; }
export function validateResetEmail(email: string): boolean { return email.trim().length > 0; }
