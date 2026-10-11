export interface RankItemView {
  userId: string;
  isMe: boolean;
  rankNo: number | string;
  displayName: string;
  score: number | string;
}

export interface RankListProps {
  rows: ReadonlyArray<RankItemView>;
  empty: boolean;
}

export function RankList({ rows, empty }: RankListProps) {
  return (
    <ol className="rank-list rank-scroll">
      {rows.map((row) => (
        <li key={row.userId} className={row.isMe ? 'rank-row me' : 'rank-row'}>
          <span className="rank-no" aria-hidden="true">
            {row.rankNo}
          </span>
          <span className="rank-name">{row.displayName}</span>
          <span className="rank-score">
            {row.score}
            <span className="rank-unit">개</span>
          </span>
        </li>
      ))}
      {empty && <li className="rank-row empty">아직 기록이 없어요</li>}
    </ol>
  );
}
