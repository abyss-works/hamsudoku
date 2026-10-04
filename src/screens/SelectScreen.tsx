import type { Chapter, Stage } from '../api/stagesApi';
import { Button } from '../ui/Button';

interface SelectScreenProps {
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
  onSelect: (stage: Stage) => void;
  onBack: () => void;
}

export function SelectScreen({ chapters, loading, error, onSelect, onBack }: SelectScreenProps) {
  return (
    <div className="select">
      <div className="select-head">
        <Button variant="sticker" onClick={onBack}>
          뒤로
        </Button>
        <h2 className="select-title">레벨 선택</h2>
      </div>
      {loading && <p>불러오는 중…</p>}
      {!loading && error && <p role="alert">{error}</p>}
      {!loading && !error && chapters.length === 0 && <p>스테이지가 없어요</p>}
      {!loading &&
        !error &&
        chapters.map((chapter) => (
          <section key={chapter.id} className="chapter">
            <h3 className="chapter-title">{chapter.title}</h3>
            <div className="stage-list">
              {chapter.stages.map((stage) => (
                <Button
                  key={stage.id}
                  variant="sticker"
                  disabled={stage.locked}
                  onClick={() => onSelect(stage)}
                >
                  {stage.code}
                </Button>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
