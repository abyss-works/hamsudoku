import { Pencil, RotateCcw } from 'lucide-react';
import type { PenColor } from './puzzles';

interface MarkerControlsProps {
  pen: PenColor;
  onSelectPen: (pen: PenColor) => void;
  onClearColor: (color: PenColor) => void;
}

const PENS: { color: PenColor; name: string; glyph: string }[] = [
  { color: 'mark', name: '의심', glyph: '✓' },
  { color: 'hypo', name: '가설', glyph: '?' },
];

// 펜 고르기와 색별 지우기를 한 자리에서 한다.
// 고르지 않은 펜은 연필(누르면 선택), 고른 펜은 리셋(누르면 그 색만 지우기)으로 보인다.
export function MarkerControls({ pen, onSelectPen, onClearColor }: MarkerControlsProps) {
  return (
    <div className="marker-controls" role="group" aria-label="마커 펜">
      {PENS.map((p) => {
        const selected = pen === p.color;
        return (
          <div key={p.color} className="pen-slot">
            <button
              type="button"
              className={`btn pen-btn${selected ? ' selected' : ''}`}
              aria-pressed={selected}
              aria-label={selected ? `${p.name}만 지우기` : `${p.name} 펜으로 바꾸기`}
              onClick={() => (selected ? onClearColor(p.color) : onSelectPen(p.color))}
            >
              <span className="pen-glyph" aria-hidden="true">
                {p.glyph}
              </span>
              {selected ? <RotateCcw size={16} aria-hidden="true" /> : <Pencil size={16} aria-hidden="true" />}
            </button>
            <span className="pen-name" aria-hidden="true">
              {p.name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
