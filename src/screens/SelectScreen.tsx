import { useState } from 'react';
import type { Chapter, Stage } from '../api/stagesApi';
import { formatElapsed } from '../game/useElapsed';
import type { ClearEntry } from '../game/save';
import { Button } from '../ui/Button';

interface SelectScreenProps {
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
  clears: Map<string, ClearEntry>;
  initialChapterId?: string | null;
  onSelect: (stage: Stage) => void;
  onBack: () => void;
}

export function SelectScreen({ chapters, loading, error, clears, initialChapterId, onSelect, onBack }: SelectScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(initialChapterId ?? null);
  const active = chapters.find((c) => c.id === selectedId) ?? chapters[0];

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
      {!loading && !error && chapters.length > 0 && (
        <>
          <div className="level-rail" role="group" aria-label="레벨 목록">
            {chapters.map((c) => (
              <Button
                key={c.id}
                variant="sticker"
                className={c.id === active.id ? 'btn-primary' : ''}
                aria-pressed={c.id === active.id}
                onClick={() => setSelectedId(c.id)}
              >
                {c.title}
              </Button>
            ))}
          </div>
          <section key={active.id} className="chapter">
            <div className="stage-list">
              {active.stages.map((stage, i) => {
                const entry = clears.get(stage.code);
                return (
                  <Button
                    key={stage.id}
                    variant="sticker"
                    className="stage-btn"
                    disabled={stage.locked}
                    onClick={() => onSelect(stage)}
                    aria-label={entry ? `${i + 1}, 베스트 ${formatElapsed(entry.elapsedSec)}` : String(i + 1)}
                  >
                    <span className="stage-num" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="stage-best" aria-hidden="true">
                      {entry ? formatElapsed(entry.elapsedSec) : '-'}
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
