import { Trophy } from 'lucide-react';
import { rankDialogService, type RankDialogOptions } from '../../features/ranking/rankDialogService';
import { Button } from '../../ui/Button';
import { Overlay } from '../../ui/Overlay';
import { RankList } from './RankList';

export interface RankDialogProps extends RankDialogOptions {
  onClose: () => void;
}

export function RankDialog({ rank, myRank, uid, signedIn, onClose }: RankDialogProps) {
  const { season, frozen, rows, empty, myRankSummary } = rankDialogService({ rank, myRank, uid, signedIn });

  return (
    <Overlay label="랭킹">
      <div className="rank-card">
        <p className="rank-title">
          <span className="rank-medal" aria-hidden="true">
            <Trophy size={22} />
          </span>
          주간 랭킹
          {season && <span className="rank-season">{season}</span>}
        </p>
        {frozen && <p className="rank-frozen">집계가 마감됐어요. 새 시즌은 4시에 시작해요.</p>}
        <RankList rows={rows} empty={empty} />
        {myRankSummary && <p className="rank-me">{myRankSummary}</p>}
        <div className="rank-actions">
          <Button variant="sticker" className="btn-primary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
