import { RotateCcw } from 'lucide-react';
import { DotMark } from '../ui/HelpCard';
import type { PenColor } from './puzzles';

interface MarkerControlsProps {
  pen: PenColor;
  onSelectPen: (pen: PenColor) => void;
  onClearColor: (color: PenColor) => void;
}

const PENS: { color: PenColor; name: string }[] = [
  { color: 'mark', name: '의심' },
  { color: 'hypo', name: '가설' },
];

// 펜 고르기와 색별 지우기를 한 자리에서 한다.
// 버튼에는 아이콘 하나만 둔다. 고르지 않은 펜은 표시(누르면 선택),
// 고른 펜은 리셋(누르면 그 색만 지우기)으로 보인다.
export function MarkerControls({ pen, onSelectPen, onClearColor }: MarkerControlsProps) {
  return (
    <div className="marker-controls" role="group" aria-label="마커 펜">
      {PENS.map((p) => {
        const selected = pen === p.color;
        return (
          <button
            key={p.color}
            type="button"
            className={`btn pen-btn${selected ? ' selected' : ''}`}
            aria-pressed={selected}
            aria-label={selected ? `${p.name}만 지우기` : `${p.name} 펜으로 바꾸기`}
            onClick={() => (selected ? onClearColor(p.color) : onSelectPen(p.color))}
          >
            {selected ? (
              <RotateCcw size={22} aria-hidden="true" />
            ) : p.color === 'mark' ? (
              <DotMark size={22} />
            ) : (
              <span className="pen-glyph" aria-hidden="true">
                ?
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
