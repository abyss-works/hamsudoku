import { useSelectService, type SelectServiceOptions } from '../../../features/stages/service/useSelectService';
import type { Stage } from '../../../features/stages/model/catalog';
import { Button } from '../../ui/Button';
import { ChapterTabs } from './ChapterTabs';
import { StageList } from './StageList';

export interface SelectScreenProps extends SelectServiceOptions {
  showLoading: boolean;
  error: string | null;
  onSelect: (stage: Stage) => void;
  onBack: () => void;
}

export function SelectScreen({ chapters, loading, showLoading, error, clears, initialChapterId, onSelect, onBack }: SelectScreenProps) {
  const { active, chapterTabs, stages, empty, ready, setSelectedId } = useSelectService({
    chapters,
    loading,
    clears,
    initialChapterId,
  });

  return (
    <div className="select">
      <div className="select-head">
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
        <h2 className="select-title">레벨 선택</h2>
      </div>
      {showLoading && <p>불러오는 중…</p>}
      {!loading && error && <p role="alert">{error}</p>}
      {empty && !error && <p>스테이지가 없어요</p>}
      {ready && !error && active && (
        <>
          <ChapterTabs tabs={chapterTabs} onSelect={setSelectedId} />
          <StageList chapterId={active.id} stages={stages} onSelect={onSelect} />
        </>
      )}
    </div>
  );
}
