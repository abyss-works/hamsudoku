interface AuthFn {
  (email: string, password: string): Promise<{ ok: boolean; msg?: string; code?: string }>;
}

export interface LoginScreenProps {
  signup: AuthFn;
  signin: AuthFn;
  reset: (email: string) => Promise<{ ok: boolean; msg?: string }>;
  cloud: boolean;
  onBack: () => void;
  onDone: () => void;
}
