import { Button } from '../../ui/Button';

export interface ChapterTabItem {
  id: string;
  title: string;
  active: boolean;
}

export interface ChapterTabsProps {
  tabs: ReadonlyArray<ChapterTabItem>;
  onSelect: (id: string) => void;
}

export function ChapterTabs({ tabs, onSelect }: ChapterTabsProps) {
  return (
    <div className="level-rail" role="group" aria-label="레벨 목록">
      {tabs.map((c) => (
        <Button
          key={c.id}
          variant="sticker"
          className={c.active ? 'btn-primary' : ''}
          aria-pressed={c.active}
          onClick={() => onSelect(c.id)}
        >
          {c.title}
        </Button>
      ))}
    </div>
  );
}
