import { useState } from 'react';
import type { Chapter, Stage } from '../api/stagesApi';
import { Button } from '../ui/Button';

interface SelectScreenProps {
  chapters: Chapter[];
  loading: boolean;
  error: string | null;
  initialChapterId?: string | null;
  onSelect: (stage: Stage) => void;
  onBack: () => void;
}

export function SelectScreen({ chapters, loading, error, initialChapterId, onSelect, onBack }: SelectScreenProps) {
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
              {active.stages.map((stage, i) => (
                <Button
                  key={stage.id}
                  variant="sticker"
                  disabled={stage.locked}
                  onClick={() => onSelect(stage)}
                >
                  {i + 1}
                </Button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
