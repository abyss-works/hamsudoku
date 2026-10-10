import type { EndlessSummaryState } from '../endless/useEndlessSummary';

export interface HomeServiceOptions {
  email: string | null;
  nickname: string | null;
  uid: string | null;
  summary: EndlessSummaryState;
  onSignin: (
    email: string,
    password: string,
    hold?: boolean,
  ) => Promise<{ ok: boolean; msg?: string; code?: string }>;
  onBaseChosen?: () => void;
  onCancelSignin?: () => void;
  onEndless: () => void;
  endlessEnabled: boolean;
  onWarmSession: () => void;
  onLogin: () => void;
}
