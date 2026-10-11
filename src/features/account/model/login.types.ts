export type LoginAuthFn = (
  email: string,
  password: string,
) => Promise<{ ok: boolean; msg?: string; code?: string }>;

export interface LoginServiceOptions {
  signup: LoginAuthFn;
  signin: LoginAuthFn;
  reset: (email: string) => Promise<{ ok: boolean; msg?: string }>;
  onDone: () => void;
}
