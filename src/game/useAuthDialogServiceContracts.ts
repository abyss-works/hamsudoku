export type AuthFn = (
  email: string,
  password: string,
  /** 계정 연동 흐름: 로그인이 성공해도 데이터 교체를 유보한다(기준 선택 후 확정). */
  hold?: boolean,
) => Promise<{ ok: boolean; msg?: string; code?: string }>;

export interface AuthDialogProps {
  /** 기준 선택 결과를 상위에 전달. device | account */
  onBase?: (base: 'device' | 'account') => void;
  signup: AuthFn;
  signin: AuthFn;
  reset: (email: string) => Promise<{ ok: boolean; msg?: string }>;
  /** 게스트 기기 값. 로그인 기준 선택 추천에 쓴다. null이면 선택 없이 진행한다. */
  guest: { seeds: number; clears: number } | null;
  /** 계정 지갑의 씨앗 수를 읽어온다(로그인 세션이고 나서). 기준 선택 표시용. */
  fetchAccountSeeds?: () => Promise<number>;
  onBack: () => void;
  onDone: () => void;
}
