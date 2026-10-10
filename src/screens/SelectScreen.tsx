import { useSelectService, type SelectScreenProps } from '../game/useSelectService';
import { Button } from '../ui/Button';

export function SelectScreen({ chapters, loading, error, clears, initialChapterId, onSelect, onBack }: SelectScreenProps) {
  const { active, stages, showLoading, setSelectedId } = useSelectService({chapters,loading,error,clears,initialChapterId,onSelect,onBack});

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
      {!loading && !error && chapters.length === 0 && <p>스테이지가 없어요</p>}
      {!loading && !error && chapters.length > 0 && (
        <>
          <div className="level-rail" role="group" aria-label="레벨 목록">
            {chapters.map((c) => (
              <Button
                key={c.id}
                variant="sticker"
                className={c.id === active!.id ? 'btn-primary' : ''}
                aria-pressed={c.id === active!.id}
                onClick={() => setSelectedId(c.id)}
              >
                {c.title}
              </Button>
            ))}
          </div>
          <section key={active!.id} className="chapter">
            <div className="stage-list">
              {stages.map(({ stage, number, best, label }) => {
                return (
                  <Button
                    key={stage.id}
                    variant="sticker"
                    className="stage-btn"
                    disabled={stage.locked}
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
