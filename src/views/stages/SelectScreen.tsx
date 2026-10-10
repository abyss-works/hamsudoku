import { useSelectService, type SelectServiceOptions } from '../../features/stages/useSelectService';
import type { Stage } from '../../features/stages/catalog';
import { Button } from '../../ui/Button';

export interface SelectScreenProps extends SelectServiceOptions {
  error: string | null;
  onSelect: (stage: Stage) => void;
  onBack: () => void;
}

export function SelectScreen({ chapters, loading, error, clears, initialChapterId, onSelect, onBack }: SelectScreenProps) {
  const { active, chapterTabs, stages, showLoading, empty, ready, setSelectedId } = useSelectService({
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
          <div className="level-rail" role="group" aria-label="레벨 목록">
            {chapterTabs.map((c) => (
              <Button
                key={c.id}
                variant="sticker"
                className={c.active ? 'btn-primary' : ''}
                aria-pressed={c.active}
                onClick={() => setSelectedId(c.id)}
              >
                {c.title}
              </Button>
            ))}
          </div>
          <section key={active.id} className="chapter">
            <div className="stage-list">
              {stages.map(({ stage, number, best, label, locked }) => {
                return (
                  <Button
                    key={stage.id}
                    variant="sticker"
                    className="stage-btn"
                    disabled={locked}
                    onClick={() => onSelect(stage)}
                    aria-label={label}
                  >
                    <span className="stage-num" aria-hidden="true">
                      {number}
                    </span>
                    <span className="stage-best" aria-hidden="true">
                      {best}
                    </span>
                  </Button>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
