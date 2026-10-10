export interface SetPasswordScreenProps {
  setPassword: (password: string) => Promise<{ ok: boolean; msg?: string }>;
  linkError: boolean;
  onDone: () => void;
}

