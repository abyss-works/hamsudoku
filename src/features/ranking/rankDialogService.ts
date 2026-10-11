import type { MyRankResponse, RankResponse } from '../../shared/endless';
import { rankModel } from './rankLogic';

export interface RankDialogOptions {
  rank: RankResponse | null;
  myRank: MyRankResponse | null | undefined;
  uid?: string | null;
  signedIn: boolean;
}

export function rankDialogService({ rank, myRank, uid, signedIn }: RankDialogOptions) {
  return rankModel(rank, myRank, uid ?? null, signedIn);
}

// 하위 호환성을 위해 유지
export const useRankDialogService = rankDialogService;
