import type { MyRankResponse, RankResponse } from '../shared/endless';
import { rankModel } from './screenModels';
export interface RankDialogProps {
  rank: RankResponse | null;
  /** 내 순위 실시간 값. 상위 목록은 스냅샷에서, 내 행은 이 값으로 그린다. */
  myRank?: MyRankResponse | null;
  uid: string | null;
  /** 로그인 사용자 여부. 게스트는 목록만 본다(내 순위 없음). */
  signedIn: boolean;
  onClose: () => void;
}
export function useRankDialogService({ rank, myRank, uid, signedIn }: RankDialogProps) {
  return rankModel(rank, myRank, uid, signedIn);
}
