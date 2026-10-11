export interface SetPasswordServiceOptions {
  setPassword: (password: string) => Promise<{ ok: boolean; msg?: string }>;
  onDone: () => void;
}
