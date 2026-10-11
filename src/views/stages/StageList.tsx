import { Button } from '../../ui/Button';
import type { Stage } from '../../features/stages/catalog';

export interface StageItemView {
  stage: Stage;
  number: number | string;
  best: string;
  label: string;
  locked: boolean;
}

export interface StageListProps {
  chapterId: string;
  stages: ReadonlyArray<StageItemView>;
  onSelect: (stage: Stage) => void;
}

export function StageList({ chapterId, stages, onSelect }: StageListProps) {
  return (
    <section key={chapterId} className="chapter">
      <div className="stage-list">
        {stages.map(({ stage, number, best, label, locked }) => (
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
        ))}
      </div>
    </section>
  );
}
