import { Trophy } from 'lucide-react';
import { mergeRankEntries } from '../shared/rankMerge';
import type { MyRankResponse, RankResponse } from '../shared/endless';
import { Button } from '../ui/Button';
import { Overlay } from '../ui/Overlay';

interface RankDialogProps {
  rank: RankResponse | null;
  /** 내 순위 실시간 값. 상위 목록은 스냅샷에서, 내 행은 이 값으로 그린다. */
  myRank?: MyRankResponse | null;
  uid: string | null;
  /** 로그인 사용자 여부. 게스트는 목록만 본다(내 순위 없음). */
  signedIn: boolean;
  onClose: () => void;
}

export function RankDialog({ rank, myRank, uid, signedIn, onClose }: RankDialogProps) {
  const live = myRank ? { score: myRank.score, nickname: myRank.nickname } : undefined;
  const merged = rank && uid && signedIn ? mergeRankEntries(rank, uid, live) : null;
  const entries = merged?.entries ?? rank?.top ?? [];
  const myScore = myRank?.score ?? rank?.me.score ?? 0;
  const fallbackNo = rank?.me.rank ?? null;
  const myRankNo = myRank ? myRank.rank : fallbackNo === null ? null : (merged?.meRank ?? fallbackNo);

  return (
    <Overlay label="랭킹">
      <div className="rank-card">
        <p className="rank-title">
          <span className="rank-medal" aria-hidden="true">
            <Trophy size={22} />
          </span>
          주간 랭킹
          {rank && <span className="rank-season">{rank.season}</span>}
        </p>
        {rank?.frozen && <p className="rank-frozen">집계가 마감됐어요. 새 시즌은 4시에 시작해요.</p>}
        <ol className="rank-list rank-scroll">
          {entries.map((e, i) => (
            <li key={e.userId} className={e.userId === uid ? 'rank-row me' : 'rank-row'}>
              <span className="rank-no" aria-hidden="true">
                {i + 1}
              </span>
              <span className="rank-name">{e.nickname ?? '게스트'}</span>
              <span className="rank-score">
                {e.score}
                <span className="rank-unit">개</span>
              </span>
            </li>
          ))}
          {rank && entries.length === 0 && <li className="rank-row empty">아직 기록이 없어요</li>}
        </ol>
        {rank && signedIn && <p className="rank-me">내 순위: {myRankNo === null ? '아직 없음' : `${myRankNo}위`} · {myScore}개</p>}
        <div className="rank-actions">
          <Button variant="sticker" className="btn-primary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Overlay>
  );
}
