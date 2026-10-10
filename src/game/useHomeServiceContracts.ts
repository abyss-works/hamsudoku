import type { EndlessSummaryState } from './useEndlessSummary';
export interface HomeScreenProps {
  /** 계정 연동 확정 — 유보를 풀고 데이터 교체를 진행한다. */
  onBaseChosen?: () => void;
  /** 기준 선택 없이 닫기 — 세션 취소(로그아웃), 데이터 무변경. */
  onCancelSignin?: () => void;
  email: string | null;
  nickname: string | null;
  uid: string | null;
  summary: EndlessSummaryState;
  sound: boolean;
  onToggleSound: () => void;
  onSaveNickname: (name: string) => Promise<{ ok: boolean; msg?: string }>;
  onSignup: (email: string, password: string) => Promise<{ ok: boolean; msg?: string; code?: string }>;
  onSignin: (
    email: string,
    password: string,
    hold?: boolean,
  ) => Promise<{ ok: boolean; msg?: string; code?: string }>;
  onReset: (email: string) => Promise<{ ok: boolean; msg?: string }>;
  onBrowse: () => void;
  onEndless: () => void;
  endlessEnabled: boolean;
  /** 프로필 진입점 예열 — 게스트의 익명 세션을 미리 확보한다. */
  onWarmSession: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

